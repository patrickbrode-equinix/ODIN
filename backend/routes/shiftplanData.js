import express from "express";
import https from "https";
import db from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

// Scoped TLS agent for api.aladhan.com and api.open-meteo.com.
// These two public APIs occasionally present cert issues in container environments.
// Using a scoped agent isolates the bypass — it does NOT affect any other requests.
const tlsRelaxedAgent = new https.Agent({ rejectUnauthorized: false });

const router = express.Router();

// Helper: Ensure site config exists
async function getSiteConfig() {
    let { rows } = await db.query("SELECT * FROM calendar_site_config WHERE site_name = 'FR2'");
    if (rows.length === 0) {
        // Create default if not present
        const defaultRow = await db.query(`
            INSERT INTO calendar_site_config (site_name, lat, lon, tz, islamic_method)
            VALUES ('FR2', 52.5200, 13.4050, 'Europe/Berlin', 'Diyanet')
            RETURNING *
        `);
        return defaultRow.rows[0];
    }
    return rows[0];
}

// GET /api/shiftplan/site-config
router.get("/site-config", requireAuth, async (req, res) => {
    try {
        const config = await getSiteConfig();
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch site config" });
    }
});

// GET /api/shiftplan/ramadan/meta?year=YYYY
router.get("/ramadan/meta", requireAuth, async (req, res) => {
    const { year } = req.query;
    if (!year) return res.status(400).json({ error: "Year required" });

    const config = await getSiteConfig();
    const site_name = config.site_name;
    const tz = config.tz;

    try {
        // 1. Check Cache
        const { rows: cacheHits } = await db.query(
            `SELECT 
                id, year, site_name, tz, 
                to_char(ramadan_start, 'YYYY-MM-DD') as ramadan_start,
                to_char(ramadan_end, 'YYYY-MM-DD') as ramadan_end,
                to_char(eid_fitr_date, 'YYYY-MM-DD') as eid_fitr_date,
                to_char(eid_adha_date, 'YYYY-MM-DD') as eid_adha_date,
                source, payload
             FROM islamic_calendar_cache 
             WHERE year = $1 AND site_name = $2 AND tz = $3`,
            [parseInt(year), site_name, tz]
        );

        if (cacheHits.length > 0) {
            return res.json(cacheHits[0]);
        }

        // Fetch from AlAdhan — scoped TLS agent only for this request
        const response = await fetch(
            `https://api.aladhan.com/v1/calendarByCity/${year}?city=Berlin&country=Germany&method=13`,
            { agent: tlsRelaxedAgent }
        );
        const data = await response.json();
        if (data.code !== 200) throw new Error("AlAdhan API failure");

        // Scan months for Ramadan (9th month of Hijri)
        let ramadanDays = [];
        let eidFitr = null;
        let eidAdha = null;

        for (const month in data.data) {
            for (const day of data.data[month]) {
                if (day.date.hijri.month.number === 9) {
                    ramadanDays.push(day.date.gregorian.date);
                }
                // Eid al-Fitr: 1st Shawwal
                if (day.date.hijri.month.number === 10 && day.date.hijri.day === "01") {
                    eidFitr = day.date.gregorian.date;
                }
                // Eid al-Adha: 10th Dhu al-Hijjah
                if (day.date.hijri.month.number === 12 && day.date.hijri.day === "10") {
                    eidAdha = day.date.gregorian.date;
                }
            }
        }

        if (ramadanDays.length === 0) throw new Error("Could not find Ramadan in AlAdhan data");

        // Format dates: DD-MM-YYYY -> YYYY-MM-DD
        const toISO = (d) => d.split('-').reverse().join('-');

        const rStart = toISO(ramadanDays[0]);
        const rEnd = toISO(ramadanDays[ramadanDays.length - 1]);
        const eFitr = eidFitr ? toISO(eidFitr) : null;
        const eAdha = eidAdha ? toISO(eidAdha) : null;

        // 3. Store Cache
        const { rows: saved } = await db.query(`
            INSERT INTO islamic_calendar_cache 
            (year, site_name, tz, ramadan_start, ramadan_end, eid_fitr_date, eid_adha_date, source, payload)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING 
                id, year, site_name, tz, 
                to_char(ramadan_start, 'YYYY-MM-DD') as ramadan_start,
                to_char(ramadan_end, 'YYYY-MM-DD') as ramadan_end,
                to_char(eid_fitr_date, 'YYYY-MM-DD') as eid_fitr_date,
                to_char(eid_adha_date, 'YYYY-MM-DD') as eid_adha_date,
                source, payload
        `, [parseInt(year), site_name, tz, rStart, rEnd, eFitr, eAdha, "AlAdhan", JSON.stringify(data)]);

        res.json(saved[0]);

    } catch (err) {
        console.error("Ramadan Meta Fetch Failed:", err);
        res.status(500).json({ error: "Failed to fetch Ramadan metadata", details: err.message });
    }
});

// GET /api/shiftplan/ramadan/suntimes?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/ramadan/suntimes", requireAuth, async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: "Start/End required" });

    const config = await getSiteConfig();
    const { site_name, lat, lon, tz } = config;

    try {
        // 1. Check which dates exist in cache
        const { rows: cacheHits } = await db.query(
            `SELECT 
                to_char(date, 'YYYY-MM-DD') as date, 
                site_name, tz, sunrise, sunset, fajr, maghrib, source 
             FROM sun_times_cache 
             WHERE site_name = $1 AND date >= $2 AND date <= $3 
             ORDER BY date ASC`,
            [site_name, start, end]
        );

        const cachedMap = new Map(cacheHits.map(h => [new Date(h.date).toISOString().split('T')[0], h]));

        // Find missing dates
        let missingDates = [];
        let curr = new Date(start);
        const endDt = new Date(end);
        while (curr <= endDt) {
            const dStr = curr.toISOString().split('T')[0];
            if (!cachedMap.has(dStr)) missingDates.push(dStr);
            curr.setDate(curr.getDate() + 1);
        }

        // 2. If Misses: Fetch from Open-Meteo
        if (missingDates.length > 0) {
            console.log(`[RAMADAN] Cache Miss for sun times: ${missingDates.length} dates. Fetching from Open-Meteo...`);

            // Fetch from Open-Meteo — scoped TLS agent only for this request
            const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=${encodeURIComponent(tz)}&start_date=${start}&end_date=${end}`;
            const omRes = await fetch(omUrl, { agent: tlsRelaxedAgent });
            const omData = await omRes.json();
            if (!omData.daily) throw new Error("Open-Meteo failure");

            for (let i = 0; i < omData.daily.time.length; i++) {
                const date = omData.daily.time[i];
                const sunrise = omData.daily.sunrise[i].split('T')[1];
                const sunset = omData.daily.sunset[i].split('T')[1];

                // Optional: Calc Fajr/Maghrib (Approx -90/+5 min)
                const sDate = new Date(`${date}T${sunrise}`);
                const eDate = new Date(`${date}T${sunset}`);
                const fajr = new Date(sDate.getTime() - 90 * 60000).toTimeString().substring(0, 5);
                const maghrib = new Date(eDate.getTime() + 5 * 60000).toTimeString().substring(0, 5);

                await db.query(`
                    INSERT INTO sun_times_cache 
                    (date, site_name, tz, sunrise, sunset, fajr, maghrib, source, payload)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (date, site_name, tz) DO UPDATE SET
                    sunrise = EXCLUDED.sunrise, sunset = EXCLUDED.sunset, fajr = EXCLUDED.fajr, maghrib = EXCLUDED.maghrib
                `, [date, site_name, tz, sunrise, sunset, fajr, maghrib, "Open-Meteo", JSON.stringify({ sunrise: omData.daily.sunrise[i], sunset: omData.daily.sunset[i] })]);
            }

            // Re-fetch all for consistent response
            const { rows: finalHits } = await db.query(
                `SELECT 
                    to_char(date, 'YYYY-MM-DD') as date, 
                    site_name, tz, sunrise, sunset, fajr, maghrib, source 
                 FROM sun_times_cache 
                 WHERE site_name = $1 AND date >= $2 AND date <= $3 
                 ORDER BY date ASC`,
                [site_name, start, end]
            );
            return res.json(finalHits);
        }

        res.json(cacheHits);

    } catch (err) {
        console.error("Sun Times Fetch Failed:", err);
        res.status(500).json({ error: "Failed to fetch sun times", details: err.message });
    }
});

// GET /api/shiftplan/month-availability?year=YYYY
// Returns object: { "Januar 2026": true, "Februar 2026": false, ... }
router.get("/month-availability", requireAuth, async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember"];

    try {
        const { rows } = await db.query(
            `SELECT DISTINCT month FROM shifts WHERE month LIKE $1`,
            [`% ${year}`]
        );
        const found = new Set(rows.map(r => r.month));
        const result = {};
        for (const name of monthNames) {
            const label = `${name} ${year}`;
            result[label] = found.has(label);
        }
        res.json(result);
    } catch (err) {
        console.error("Month availability error:", err);
        res.status(500).json({ error: "Failed to fetch month availability" });
    }
});

export default router;
