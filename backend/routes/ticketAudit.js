/* ------------------------------------------------ */
/* TICKET AUDIT – ADMIN ONLY STATISTICS             */
/* Manuelle Übernahmen & Bearbeitungsstatistik       */
/* ------------------------------------------------ */

import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requirePageAccess } from "../middleware/requirePageAccess.js";

const router = express.Router();

router.use(requireAuth);
router.use(requirePageAccess("ticket_audit", "view"));

function buildAssignedDecisionMatchClause(queueAlias = "qi", decisionAlias = "atd") {
  return `(
    ${decisionAlias}.ticket_id = ${queueAlias}.id::text
    OR (
      ${decisionAlias}.external_id IS NOT NULL
      AND ${decisionAlias}.external_id = ${queueAlias}.external_id
      AND (${decisionAlias}.ticket_type IS NULL OR ${decisionAlias}.ticket_type = ${queueAlias}.queue_type)
    )
  )`;
}

/* ------------------------------------------------ */
/* HELPER: Parse time range from query params       */
/* range = day | week | month | year | custom       */
/* from / to = YYYY-MM-DD (for custom)              */
/* ------------------------------------------------ */
function parseDateRange(q) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  if (q.range === "custom" && q.from && q.to) {
    return { from: q.from, to: q.to };
  }

  switch (q.range) {
    case "day":
      return { from: todayStr, to: todayStr };
    case "week": {
      const d = new Date(now);
      const day = d.getDay() || 7; // Mon=1
      d.setDate(d.getDate() - day + 1);
      return { from: d.toISOString().split("T")[0], to: todayStr };
    }
    case "year": {
      return { from: `${now.getFullYear()}-01-01`, to: todayStr };
    }
    case "month":
    default: {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      return { from: `${y}-${m}-01`, to: todayStr };
    }
  }
}

/* ------------------------------------------------ */
/* GET /api/stats/audit/summary                     */
/* KPI summary for the selected time range          */
/* ------------------------------------------------ */
router.get("/summary", async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const assignedDecisionMatch = buildAssignedDecisionMatchClause();

    // 1. Total tickets with owner in range
    const totalOwned = await query(`
      SELECT COUNT(DISTINCT qi.id) AS count
      FROM queue_items qi
      WHERE qi.owner IS NOT NULL AND qi.owner != ''
        AND qi.last_seen_at >= $1::date
        AND qi.first_seen_at < $2::date + INTERVAL '1 day'
    `, [from, to]);

    // 2. Tickets auto-assigned by ODIN in range
    const autoAssigned = await query(`
      SELECT COUNT(DISTINCT COALESCE(NULLIF(atd.external_id, ''), atd.ticket_id)) AS count
      FROM assignment_ticket_decisions atd
      WHERE atd.result = 'assigned'
        AND atd.decided_at >= $1::date
        AND atd.decided_at < $2::date + INTERVAL '1 day'
    `, [from, to]);

    // 3. Tickets with owner but NO auto-assignment (manual takeover)
    const manualTakeover = await query(`
      SELECT COUNT(DISTINCT qi.id) AS count
      FROM queue_items qi
      WHERE qi.owner IS NOT NULL AND qi.owner != ''
        AND qi.last_seen_at >= $1::date
        AND qi.first_seen_at < $2::date + INTERVAL '1 day'
        AND NOT EXISTS (
          SELECT 1 FROM assignment_ticket_decisions atd
          WHERE ${assignedDecisionMatch}
            AND atd.result = 'assigned'
        )
    `, [from, to]);

    // 4. Distinct workers with manual takeovers
    const manualWorkers = await query(`
      SELECT COUNT(DISTINCT qi.owner) AS count
      FROM queue_items qi
      WHERE qi.owner IS NOT NULL AND qi.owner != ''
        AND qi.last_seen_at >= $1::date
        AND qi.first_seen_at < $2::date + INTERVAL '1 day'
        AND NOT EXISTS (
          SELECT 1 FROM assignment_ticket_decisions atd
          WHERE ${assignedDecisionMatch}
            AND atd.result = 'assigned'
        )
    `, [from, to]);

    // 5. Closed tickets in range
    const closedCount = await query(`
      SELECT COUNT(*) AS count
      FROM queue_items
      WHERE closed_at >= $1::date
        AND closed_at < $2::date + INTERVAL '1 day'
    `, [from, to]);

    res.json({
      from,
      to,
      totalOwned: parseInt(totalOwned.rows[0]?.count || 0),
      autoAssigned: parseInt(autoAssigned.rows[0]?.count || 0),
      manualTakeover: parseInt(manualTakeover.rows[0]?.count || 0),
      manualWorkers: parseInt(manualWorkers.rows[0]?.count || 0),
      closedTickets: parseInt(closedCount.rows[0]?.count || 0),
    });
  } catch (err) {
    console.error("AUDIT SUMMARY ERROR:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ------------------------------------------------ */
/* GET /api/stats/audit/manual-takeovers            */
/* Per-worker manual takeover statistics             */
/* ------------------------------------------------ */
router.get("/manual-takeovers", async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);
    const assignedDecisionMatch = buildAssignedDecisionMatchClause();

    const result = await query(`
      SELECT
        qi.owner AS worker,
        COUNT(DISTINCT qi.id) AS count,
        MAX(qi.last_seen_at) AS last_takeover,
        ARRAY_AGG(DISTINCT COALESCE(qi.queue_type, 'Unbekannt')) AS ticket_types
      FROM queue_items qi
      WHERE qi.owner IS NOT NULL AND qi.owner != ''
        AND qi.last_seen_at >= $1::date
        AND qi.first_seen_at < $2::date + INTERVAL '1 day'
        AND NOT EXISTS (
          SELECT 1 FROM assignment_ticket_decisions atd
          WHERE ${assignedDecisionMatch}
            AND atd.result = 'assigned'
        )
      GROUP BY qi.owner
      ORDER BY count DESC
    `, [from, to]);

    // Also get the total per-worker for percentage
    const totalPerWorker = await query(`
      SELECT qi.owner, COUNT(DISTINCT qi.id) AS total
      FROM queue_items qi
      WHERE qi.owner IS NOT NULL AND qi.owner != ''
        AND qi.last_seen_at >= $1::date
        AND qi.first_seen_at < $2::date + INTERVAL '1 day'
      GROUP BY qi.owner
    `, [from, to]);

    const totalMap = {};
    for (const r of totalPerWorker.rows) {
      totalMap[r.owner] = parseInt(r.total);
    }

    const rows = result.rows.map(r => ({
      worker: r.worker,
      count: parseInt(r.count),
      total: totalMap[r.worker] || parseInt(r.count),
      percentage: totalMap[r.worker]
        ? Math.round((parseInt(r.count) / totalMap[r.worker]) * 100)
        : 100,
      lastTakeover: r.last_takeover,
      ticketTypes: r.ticket_types?.filter(t => t) || [],
    }));

    res.json(rows);
  } catch (err) {
    console.error("AUDIT MANUAL TAKEOVERS ERROR:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ------------------------------------------------ */
/* GET /api/stats/audit/worker-activity             */
/* Per-worker ticket activity statistics             */
/* ------------------------------------------------ */
router.get("/worker-activity", async (req, res) => {
  try {
    const { from, to } = parseDateRange(req.query);

    const result = await query(`
      SELECT
        qi.owner AS worker,
        COUNT(DISTINCT qi.id) AS total,
        COUNT(DISTINCT qi.id) FILTER (
          WHERE LOWER(COALESCE(qi.queue_type,'')) LIKE '%smart hand%'
             OR LOWER(COALESCE(qi.queue_type,'') || ' ' || COALESCE(qi.subtype,'')) LIKE '%smarthand%'
        ) AS sh,
        COUNT(DISTINCT qi.id) FILTER (
          WHERE LOWER(COALESCE(qi.queue_type,'')) LIKE '%trouble%'
        ) AS tt,
        COUNT(DISTINCT qi.id) FILTER (
          WHERE LOWER(COALESCE(qi.queue_type,'') || ' ' || COALESCE(qi.subtype,'')) LIKE '%cross%connect%'
        ) AS cc,
        COUNT(DISTINCT qi.id) FILTER (
          WHERE qi.closed_at IS NOT NULL
        ) AS closed
      FROM queue_items qi
      WHERE qi.owner IS NOT NULL AND qi.owner != ''
        AND qi.last_seen_at >= $1::date
        AND qi.first_seen_at < $2::date + INTERVAL '1 day'
      GROUP BY qi.owner
      ORDER BY total DESC
    `, [from, to]);

    const rows = result.rows.map(r => ({
      worker: r.worker,
      total: parseInt(r.total),
      sh: parseInt(r.sh),
      tt: parseInt(r.tt),
      cc: parseInt(r.cc),
      closed: parseInt(r.closed),
    }));

    res.json(rows);
  } catch (err) {
    console.error("AUDIT WORKER ACTIVITY ERROR:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
