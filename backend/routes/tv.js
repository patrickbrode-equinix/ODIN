/* ------------------------------------------------ */
/* TV PUBLIC ROUTES – /api/tv/*                     */
/* NO AUTH REQUIRED – read-only, kiosk-safe         */
/* ------------------------------------------------ */
/*
 * Security posture:
 *  - All endpoints are GET / read-only.
 *  - No sensitive user/personnel data is exposed.
 *  - Mutating endpoints (POST/PUT/DELETE) are NOT present here.
 *  - The full app remains protected; only /api/tv/* is public.
 *  - Optional: set TV_KEY env var to require X-TV-KEY header
 *    (recommended for corp-network deployments where the TV URL
 *     should not be accessible by anyone without the key).
 */

import express from "express";
import { query } from "../db.js";

const router = express.Router();

/* ------------------------------------------------ */
/* OPTIONAL: TV_KEY secret header guard             */
/* If TV_KEY env var is set, all /api/tv/* requests */
/* must include header:  X-TV-KEY: <value>          */
/* ------------------------------------------------ */
const TV_KEY = process.env.TV_KEY || null;

function tvKeyGuard(req, res, next) {
  if (!TV_KEY) return next(); // no key configured → open
  const provided = req.headers["x-tv-key"] || req.query["tv_key"];
  if (provided === TV_KEY) return next();
  return res.status(403).json({ error: "TV_KEY required" });
}

router.use(tvKeyGuard);

/* ------------------------------------------------ */
/* GET /api/tv/health                               */
/* ------------------------------------------------ */
router.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

/* ------------------------------------------------ */
/* GET /api/tv/tickets                              */
/* Mirrors /api/queue/tickets – read-only           */
/* ------------------------------------------------ */
router.get("/tickets", async (req, res) => {
  try {
    const { queueType, limit } = req.query;

    let sql = `SELECT * FROM queue_items WHERE active = TRUE`;
    const params = [];

    if (queueType) {
      params.push(queueType);
      sql += ` AND queue_type = $${params.length}`;
    }

    sql += ` ORDER BY group_key ASC, id ASC`;

    if (limit) {
      const lim = parseInt(limit, 10);
      if (!isNaN(lim) && lim > 0 && lim <= 500) {
        params.push(lim);
        sql += ` LIMIT $${params.length}`;
      }
    }

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("[TV] /tickets error:", err.message);
    res.json([]); // never 500 for TV – return empty array
  }
});

/* ------------------------------------------------ */
/* GET /api/tv/info-entries                         */
/* Mirrors /api/dashboard/info-entries – read-only  */
/* ------------------------------------------------ */
router.get("/info-entries", async (_req, res) => {
  try {
    const result = await query(
      `SELECT * FROM dashboard_info_entries
       WHERE delete_at IS NULL OR delete_at > NOW()
       ORDER BY created_at DESC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error("[TV] /info-entries error:", err.message);
    res.json({ data: [] }); // never 500 for TV
  }
});

export default router;
