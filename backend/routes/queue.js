import express from "express";
import { query } from "../db.js";
import { config } from "../config/index.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ------------------------------------------------ */
/* 1. SNAPSHOT INGESTION (THE CRITICAL PART)        */
/* ------------------------------------------------ */

router.post("/snapshot", async (req, res) => {
  // Extract with defaults to null safety
  const { queue_type, expected_count, actual_count, complete, items, timestamp } = req.body;

  // SAFETY GATE: Reject if queue_type is missing
  if (!queue_type) {
    console.error("[ODIN][SNAPSHOT] Reject: missing queue_type");
    return res.status(400).json({ ok: false, error: "MISSING_QUEUE_TYPE" });
  }

  // 0. Ingest key security check
  const ingestKey = config.QUEUE_INGEST_KEY ? String(config.QUEUE_INGEST_KEY).trim() : "";
  if (!ingestKey) {
    if (config.isProd) {
      console.error("[SEC] QUEUE_INGEST_KEY not set in production — rejecting ingest");
      return res.status(401).json({ ok: false, error: "Ingest key not configured" });
    }
    if (process.env.ALLOW_INSECURE_INGEST !== "true") {
      return res.status(401).json({ ok: false, error: "Ingest key required. Set ALLOW_INSECURE_INGEST=true in dev to bypass." });
    }
    console.warn("[SEC] ALLOW_INSECURE_INGEST=true — accepting keyless ingest (dev only)");
  } else {
    const headerKey = req.headers["x-oes-ingest-key"];
    if (!headerKey || headerKey !== ingestKey) {
      console.warn(`[SEC] Invalid ingest key from ${req.ip}`);
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
  }

  // DIAGNOSTICS
  const payloadSize = JSON.stringify(req.body).length;
  console.log(`[ODIN][SNAPSHOT] Ingest type=${queue_type} items=${items?.length || 0} Size: ${payloadSize}b`);

  const client = await import("../db.js").then((mod) => mod.default.connect());

  try {
    await client.query("BEGIN");

    // 1. Insert Snapshot Record
    const snapRes = await client.query(
      `INSERT INTO snapshots (queue_type, expected_count, actual_count, complete, raw_data, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [queue_type, expected_count, actual_count, complete, JSON.stringify({ itemCount: items?.length }), timestamp || new Date()]
    );
    const snapshotId = snapRes.rows[0].id;

    console.log(`    -> Inserted Snapshot ID: ${snapshotId}`);

    // 2. Process Items (Upsert)
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        // STRICT EXTERNAL ID LOGIC
        // Prefer: item.ticketId, item["Activity #"], item["Ticket"]
        // Fallback: item.id (if stable!)
        // REJECT unstable/random IDs
        const externalId = item.ticketId || item["Activity #"] || item["Ticket"] || (item.id && !item.id.startsWith("UNKNOWN") ? item.id : null);

        if (!externalId) {
          console.warn("[ODIN][SNAPSHOT] Skipping item missing stable ID:", JSON.stringify(item).substring(0, 50));
          continue;
        }

        await client.query(
          `INSERT INTO queue_items (
             external_id, queue_type, group_key, status, subtype, owner, 
             sched_start, commit_date, revised_commit_date, account, system_name, 
             details, active, last_seen, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, 
             $7, $8, $9, $10, $11, 
             $12, TRUE, NOW(), NOW(), NULL
           )
           ON CONFLICT (external_id, queue_type) DO UPDATE SET
             group_key = COALESCE(EXCLUDED.group_key, queue_items.group_key),
             status = COALESCE(EXCLUDED.status, queue_items.status),
             subtype = COALESCE(EXCLUDED.subtype, queue_items.subtype),
             owner = COALESCE(EXCLUDED.owner, queue_items.owner),
             sched_start = COALESCE(EXCLUDED.sched_start, queue_items.sched_start),
             commit_date = COALESCE(EXCLUDED.commit_date, queue_items.commit_date),
             revised_commit_date = COALESCE(EXCLUDED.revised_commit_date, queue_items.revised_commit_date),
             account = COALESCE(EXCLUDED.account, queue_items.account),
             system_name = COALESCE(EXCLUDED.system_name, queue_items.system_name),
             details = COALESCE(EXCLUDED.details, queue_items.details),
             active = TRUE,
             last_seen = NOW(),
             updated_at = NOW(),
             closed_at = NULL`,
          [
            externalId,
            queue_type,
            item.groupKey || "Unassigned",
            item.status,
            item.subtype,
            item.owner,
            item.schedStart ? new Date(item.schedStart) : null,
            item.commitDate ? new Date(item.commitDate) : null,
            item.revisedCommitDate ? new Date(item.revisedCommitDate) : null,
            item.account,
            item.systemName,
            item.details || {},
          ]
        );
      }
    }

    // 3. Deactivation Logic (Only if snapshot is COMPLETE)
    if (complete === true) {
      await client.query(
        `UPDATE queue_items 
         SET active = FALSE, updated_at = NOW(), closed_at = NOW()
         WHERE queue_type = $1 
         AND active = TRUE 
         AND last_seen < NOW() - INTERVAL '30 seconds'`,
        [queue_type]
      );
    }

    await client.query("COMMIT");

    // STABLE JSON RESPONSE
    res.status(200).json({
      ok: true,
      success: true,
      snapshotId: snapshotId,
      id: snapshotId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Snapshot Ingest Failed:", err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

/* ------------------------------------------------ */
/* 2. GET TICKETS (FOR GRID)                        */
/* ------------------------------------------------ */

router.get("/tickets", requireAuth, async (req, res) => {
  try {
    const { queueType } = req.query;
    let sql = `
      SELECT * FROM queue_items 
      WHERE active = TRUE
    `;
    const params = [];

    if (queueType) {
      sql += ` AND queue_type = $1`;
      params.push(queueType);
    }

    sql += ` ORDER BY group_key ASC, id ASC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Get Tickets Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ------------------------------------------------ */
/* 3. GET GROUPS (FOR SIDEBAR)                      */
/* ------------------------------------------------ */

router.get("/groups", requireAuth, async (req, res) => {
  try {
    const sql = `
      SELECT 
        queue_type, 
        group_key, 
        COUNT(*) as count 
      FROM queue_items 
      WHERE active = TRUE 
      GROUP BY queue_type, group_key 
      ORDER BY queue_type, group_key`;

    const result = await query(sql);

    // Transform for easier frontend consumption
    // { "SmartHands": [ { name: "Group A", count: 5 } ] }
    const grouped = {};
    result.rows.forEach(row => {
      if (!grouped[row.queue_type]) grouped[row.queue_type] = [];
      grouped[row.queue_type].push({ name: row.group_key, count: parseInt(row.count) });
    });

    res.json(grouped);
  } catch (err) {
    console.error("Get Groups Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ------------------------------------------------ */
/* 4. STATS / DEBUG                                 */
/* ------------------------------------------------ */

router.get("/debug/last-snapshot", requireAuth, async (req, res) => {
  try {
    const result = await query("SELECT * FROM snapshots ORDER BY id DESC LIMIT 5");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
