import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/ramadan/:year
router.get("/:year", requireAuth, async (req, res) => {
    const { year } = req.params;
    const site_name = 'FR2'; // Default for now, as seeded in migration
    try {
        // 1. Fetch main Ramadan dates
        const { rows: calRows } = await db.query(
            "SELECT * FROM islamic_calendar_cache WHERE year = $1 AND site_name = $2",
            [year, site_name]
        );

        if (calRows.length === 0) {
            return res.json(null);
        }

        const cal = calRows[0];
        const oldData = cal.payload || {}; // Used for end dates not explicitly in columns

        // 2. Fetch all sun times for the Ramadan range
        const { rows: timings } = await db.query(
            `SELECT 
                date::text, 
                sunrise::text, 
                sunset::text, 
                fajr::text, 
                maghrib::text 
             FROM sun_times_cache 
             WHERE site_name = $1 AND date >= $2 AND date <= $3 
             ORDER BY date ASC`,
            [site_name, cal.ramadan_start, cal.ramadan_end]
        );

        // 3. Aggregate for Frontend
        res.json({
            year: cal.year,
            start_date: cal.ramadan_start,
            end_date: cal.ramadan_end,
            eid_al_fitr_start: cal.eid_fitr_date,
            eid_al_fitr_end: oldData.eid_al_fitr_end || cal.eid_fitr_date,
            eid_al_adha_start: cal.eid_adha_date,
            eid_al_adha_end: oldData.eid_al_adha_end || cal.eid_adha_date,
            timings: timings.map(t => ({
                date: t.date,
                sunrise: t.sunrise.substring(0, 5),
                sunset: t.sunset.substring(0, 5),
                fajr: t.fajr ? t.fajr.substring(0, 5) : null,
                maghrib: t.maghrib ? t.maghrib.substring(0, 5) : null
            }))
        });
    } catch (err) {
        console.error("Ramadan fetch error:", err);
        res.status(500).json({ error: "Failed to fetch Ramadan data" });
    }
});

export default router;
