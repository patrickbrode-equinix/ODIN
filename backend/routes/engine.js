/* ------------------------------------------------ */
/* ODIN ENGINE – API ROUTES                         */
/* Shadow run, decision logs, config, exclusions.   */
/* ------------------------------------------------ */

import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { runAssignmentEngine, loadConfig, checkCrawlerStaleness } from "../engine/assignEngine.js";

const router = express.Router();

/* ================================================ */
/* 1. TRIGGER SHADOW RUN                            */
/* ================================================ */

router.post("/run", requireAuth, async (req, res) => {
  try {
    const config = await loadConfig();

    if (!config.enabled && config.enabled !== "true") {
      return res.status(400).json({ ok: false, error: "Engine ist deaktiviert. Bitte in der Konfiguration aktivieren." });
    }

    const result = await runAssignmentEngine({
      triggeredBy: "manual",
      triggeredByUser: req.user?.email || req.user?.username || "unknown",
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[ENGINE] Run endpoint error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ================================================ */
/* 2. GET RUNS (HISTORY)                            */
/* ================================================ */

router.get("/runs", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
    const result = await db.query(
      `SELECT * FROM assignment_runs ORDER BY started_at DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================ */
/* 3. GET DECISIONS FOR A RUN                       */
/* ================================================ */

router.get("/runs/:runId/decisions", requireAuth, async (req, res) => {
  try {
    const { runId } = req.params;
    const result = await db.query(
      `SELECT * FROM assignment_decisions WHERE run_id = $1 ORDER BY priority_score ASC, id ASC`,
      [parseInt(runId, 10)]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================ */
/* 4. EXPLAIN – SINGLE TICKET DECISION              */
/* ================================================ */

router.get("/explain/:ticketExternalId", requireAuth, async (req, res) => {
  try {
    const { ticketExternalId } = req.params;
    const result = await db.query(
      `SELECT ad.*, ar.mode, ar.started_at AS run_started_at
       FROM assignment_decisions ad
       JOIN assignment_runs ar ON ar.id = ad.run_id
       WHERE ad.ticket_external_id = $1
       ORDER BY ad.created_at DESC
       LIMIT 10`,
      [ticketExternalId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================ */
/* 5. ENGINE CONFIG                                 */
/* ================================================ */

router.get("/config", requireAuth, async (req, res) => {
  try {
    const config = await loadConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/config", requireAuth, async (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Payload erwartet: { key: value, ... }" });
    }

    const allowedKeys = [
      "engine_mode", "stale_threshold_minutes",
      "max_tickets_per_person_sh", "similar_remaining_hours_threshold",
      "enabled",
    ];
    const actor = req.user?.email || "unknown";

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys.includes(key)) continue;
      await db.query(
        `INSERT INTO assignment_config (key, value, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_by = $3, updated_at = NOW()`,
        [key, JSON.stringify(value), actor]
      );
    }

    const config = await loadConfig();
    res.json({ ok: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================ */
/* 6. MANUAL EXCLUSIONS                             */
/* ================================================ */

router.get("/exclusions", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM manual_exclusions ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/exclusions", requireAuth, async (req, res) => {
  try {
    const { system_name, reason } = req.body;
    if (!system_name || !system_name.trim()) {
      return res.status(400).json({ error: "system_name ist erforderlich" });
    }

    const actor = req.user?.email || req.user?.username || "unknown";
    const result = await db.query(
      `INSERT INTO manual_exclusions (system_name, reason, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (system_name) DO NOTHING
       RETURNING *`,
      [system_name.trim(), reason || null, actor]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({ error: "System Name bereits auf der Ausnahmeliste" });
    }

    res.status(201).json({ ok: true, exclusion: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/exclusions/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM manual_exclusions WHERE id = $1`, [parseInt(id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================ */
/* 7. CRAWLER STATUS                                */
/* ================================================ */

router.get("/crawler-status", requireAuth, async (req, res) => {
  try {
    const config = await loadConfig();
    const staleness = await checkCrawlerStaleness(config.stale_threshold_minutes);

    // Also get last 5 runs for context
    const runsRes = await db.query(
      `SELECT id, snapshot_at, total_active, new_count, gone_count, success, error_message, created_at
       FROM crawler_runs ORDER BY created_at DESC LIMIT 5`
    );

    res.json({
      ...staleness,
      thresholdMinutes: config.stale_threshold_minutes,
      recentRuns: runsRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================================ */
/* 8. EMPLOYEE SHIFT ROLES                          */
/* ================================================ */

router.get("/roles", requireAuth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date query param erforderlich (YYYY-MM-DD)" });

    const result = await db.query(
      `SELECT * FROM employee_shift_roles WHERE date = $1 ORDER BY employee_name, role_code`,
      [date]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/roles", requireAuth, async (req, res) => {
  try {
    const { employee_name, date, shift_code, role_code, comment } = req.body;

    if (!employee_name || !date || !shift_code || !role_code) {
      return res.status(400).json({ error: "employee_name, date, shift_code, role_code sind erforderlich" });
    }

    const actor = req.user?.email || req.user?.username || "unknown";
    const result = await db.query(
      `INSERT INTO employee_shift_roles (employee_name, date, shift_code, role_code, comment, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (employee_name, date, role_code)
       DO UPDATE SET shift_code = $3, comment = $5, updated_at = NOW()
       RETURNING *`,
      [employee_name.trim(), date, shift_code, role_code, comment || null, actor]
    );

    res.status(201).json({ ok: true, role: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/roles/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM employee_shift_roles WHERE id = $1`, [parseInt(id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Bulk set roles for a date range (used by weekplan context menu) */
router.post("/roles/bulk", requireAuth, async (req, res) => {
  try {
    const { employee_name, dates, shift_code, role_code, comment } = req.body;

    if (!employee_name || !Array.isArray(dates) || !dates.length || !shift_code || !role_code) {
      return res.status(400).json({ error: "employee_name, dates[], shift_code, role_code erforderlich" });
    }

    const actor = req.user?.email || req.user?.username || "unknown";
    const results = [];

    for (const date of dates) {
      const r = await db.query(
        `INSERT INTO employee_shift_roles (employee_name, date, shift_code, role_code, comment, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (employee_name, date, role_code)
         DO UPDATE SET shift_code = $3, comment = $5, updated_at = NOW()
         RETURNING *`,
        [employee_name.trim(), date, shift_code, role_code, comment || null, actor]
      );
      if (r.rows[0]) results.push(r.rows[0]);
    }

    res.status(201).json({ ok: true, count: results.length, roles: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
