/* ------------------------------------------------ */
/* HEALTH ROUTE (PUBLIC)                             */
/* ------------------------------------------------ */

import express from "express";
import db from "../db.js";

const router = express.Router();

/* ------------------------------------------------ */
/* GET /api/health                                  */
/* ------------------------------------------------ */

router.get("/", async (req, res) => {
  const start = Date.now();

  let dbStatus = "unknown";
  let dbError = null;

  try {
    await db.query("SELECT 1");
    dbStatus = "ok";
  } catch (err) {
    // IMPORTANT: Health should be reachable even if Postgres is down,
    // otherwise the frontend looks "broken" and Vite shows proxy 500s.
    dbStatus = "error";
    dbError = err?.message || String(err);
    console.error("HEALTH DB ERROR:", err);
  }

  // Always 200: backend is up, database may or may not be.
  res.json({
    backend: "ok",
    database: dbStatus,
    databaseError: dbError,
    latencyMs: Date.now() - start,
    timestamp: new Date().toISOString(),
  });
});

export default router;
