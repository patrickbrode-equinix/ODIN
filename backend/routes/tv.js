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

/* ------------------------------------------------ */
/* GET /api/tv/projects                             */
/* Mirrors /api/projects – read-only, no auth       */
/* ------------------------------------------------ */
router.get("/projects", async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, name, responsible, expected_done, progress, description, status, creator, created_at
       FROM projects
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[TV] /projects error:", err.message);
    res.json([]); // never 500 for TV
  }
});

/* ------------------------------------------------ */
/* GET /api/tv/schedules/today                      */
/* Returns today's shift assignments (early/late/   */
/* night) directly from DB – no auth, self-         */
/* hydrating for TV screen on fresh browser.        */
/* ------------------------------------------------ */
const GERMAN_MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** Shift categories known to TV (matches frontend shiftTypes). */
const TV_SHIFT_TYPES = {
  E1: { label: "E1", color: "bg-orange-500", name: "Frühschicht",  time: "06:30-15:30" },
  E2: { label: "E2", color: "bg-orange-600", name: "Frühschicht",  time: "07:00-16:00" },
  L1: { label: "L1", color: "bg-yellow-500", name: "Spätschicht",  time: "13:00-22:00" },
  L2: { label: "L2", color: "bg-yellow-600", name: "Spätschicht",  time: "15:00-00:00" },
  N:  { label: "N",  color: "bg-blue-600",   name: "Nachtschicht", time: "21:15-06:45" },
  DBS:    { label: "DBS",    color: "bg-fuchsia-600", name: "DBS",       time: "—" },
  FS:     { label: "FS",     color: "bg-cyan-500",    name: "Freischicht", time: "—" },
  ABW:    { label: "ABW",    color: "bg-gray-500",    name: "Abwesend",   time: "—" },
  SEMINAR:{ label: "S",      color: "bg-purple-600",  name: "Seminar",    time: "08:00-16:00" },
};

router.get("/schedules/today", async (_req, res) => {
  try {
    const today = new Date();
    const day   = today.getDate();
    const monthLabel = `${GERMAN_MONTHS[today.getMonth()]} ${today.getFullYear()}`;

    const result = await query(
      `SELECT employee_name, shift_code
       FROM shifts
       WHERE month = $1 AND day = $2
       ORDER BY employee_name ASC`,
      [monthLabel, day]
    );

    const early = [];
    const late  = [];
    const night = [];

    for (const row of result.rows) {
      const code = row.shift_code;
      const info = TV_SHIFT_TYPES[code];
      if (!info) continue; // skip unknown / FS / ABW for shift panels

      // "Nachname, Vorname" → "Nachname Vorname"
      const name = String(row.employee_name ?? "").replace(",", "").trim();
      const entry = { name, shift: code, time: info.time, info };

      if (code === "E1" || code === "E2") early.push(entry);
      else if (code === "L1" || code === "L2") late.push(entry);
      else if (code === "N") night.push(entry);
    }

    res.json({
      early,
      late,
      night,
      dataFresh: true,
      monthLabel,
      day,
    });
  } catch (err) {
    console.error("[TV] /schedules/today error:", err.message);
    // Return safe default – never 500 for TV
    res.json({ early: [], late: [], night: [], dataFresh: false });
  }
});

export default router;
