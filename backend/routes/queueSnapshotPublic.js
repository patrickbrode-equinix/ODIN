/* ------------------------------------------------ */
/* QUEUE SNAPSHOT INGEST (PUBLIC VIA INGEST KEY)     */
/* Ports Brodinho Queue Snapshot -> PostgreSQL       */
/* ------------------------------------------------ */

import express from "express";
import db from "../db.js";
import { config } from "../config/index.js";

const router = express.Router();

/* ---------------- Helpers ---------------- */

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj && obj[k] !== undefined && obj[k] !== null ? String(obj[k]).trim() : "";
    if (v) return v;
  }
  return "";
}

function normalizeGroupFromQueueType(queueType) {
  if (queueType === "SmartHands") return "FR2-Smart hands";
  if (queueType === "CCInstalls") return "FR2-Cross Connects";
  if (queueType === "TroubleTickets") return "Trouble Tickets";
  return "";
}

function canonicalizeQueueType(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  // Allow a few legacy/alt spellings from older extension builds
  if (s === "SMART_HANDS" || s.toLowerCase() === "smarthands") return "SmartHands";
  if (s === "CC_INSTALLS" || s.toLowerCase() === "ccinstalls") return "CCInstalls";
  if (s === "TROUBLE_TICKETS" || s.toLowerCase() === "troubletickets") return "TroubleTickets";
  return s;
}

function isClosedStatus(status) {
  const s = String(status || "").toLowerCase();
  return (
    s.includes("closed") ||
    s.includes("completed") ||
    s.includes("cancelled") ||
    s.includes("canceled")
  );
}

function parseCommitDateToMs(v) {
  if (!v) return null;
  const txt = String(v).trim();
  if (!txt) return null;

  // DE: DD.MM.YYYY [HH:MM[:SS]]
  const de = txt.match(
    /^([0-9]{1,2})\.([0-9]{1,2})\.([0-9]{4})(?:\s+([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?)?$/
  );
  if (de) {
    const dd = Number(de[1]);
    const mm = Number(de[2]);
    const yyyy = Number(de[3]);
    const hh = Number(de[4] || 0);
    const mi = Number(de[5] || 0);
    const ss = Number(de[6] || 0);
    const d = new Date(yyyy, mm - 1, dd, hh, mi, ss);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  }

  // US: M/d/yyyy, h:mm[:ss] AM/PM  (Jarvis EMEA sends this format)
  const us = txt.match(
    /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4}),?\s+([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?\s*(AM|PM)$/i
  );
  if (us) {
    const mm = Number(us[1]);
    const dd = Number(us[2]);
    const yyyy = Number(us[3]);
    let hh = Number(us[4]);
    const mi = Number(us[5]);
    const ss = Number(us[6] || 0);
    const ampm = (us[7] || "").toUpperCase();
    if (ampm === "PM" && hh < 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    const d = new Date(yyyy, mm - 1, dd, hh, mi, ss);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  }

  // US date-only: M/d/yyyy (no time)
  const usDateOnly = txt.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
  if (usDateOnly) {
    const mm = Number(usDateOnly[1]);
    const dd = Number(usDateOnly[2]);
    const yyyy = Number(usDateOnly[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  }

  // ISO-like: YYYY-MM-DD or YYYY-MM-DD HH:MM[:SS]
  const iso = txt.replace(" ", "T");
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

function parseAnyDateToIso(v) {
  if (!v) return null;
  const txt = String(v).trim();
  if (!txt) return null;

  const ms = parseCommitDateToMs(txt);
  if (ms !== null) {
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }

  const d = new Date(txt);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function formatRemainingFromCommit(commitDate) {
  const ms = parseCommitDateToMs(commitDate);
  if (ms === null) return "";
  const diffMin = Math.round((ms - Date.now()) / 60000);
  const sign = diffMin < 0 ? -1 : 1;
  const abs = Math.abs(diffMin);

  const days = Math.floor(abs / (24 * 60));
  const hours = Math.floor((abs - days * 24 * 60) / 60);
  const mins = abs - days * 24 * 60 - hours * 60;

  const sgn = sign < 0 ? "-" : "";
  return `${sgn}${days} D ${sgn}${hours} H ${sgn}${mins} M`;
}

function remainingHoursFromCommit(commitDate) {
  const ms = parseCommitDateToMs(commitDate);
  if (ms === null) return null;
  return (ms - Date.now()) / 3600000;
}

function mapJarvisRowToDb(queueType, row) {
  const externalId =
    queueType === "TroubleTickets"
      ? pick(row, ["Ticket ID", "TICKET_ID", "TicketID", "ticketId", "ticket_id"])
      : pick(row, [
        "Activity #",
        "ACT_NUM",
        "ACTIVITY_NO",
        "ActivityNo",
        "Order #",
        "ORDER_NUM",
        "ORDER_ID",
        "so_number",
        "SO #",
      ]);

  if (!externalId) return null;

  const commitDate = pick(row, [
    "Commit Date",
    "Commit Day",
    "commit_date",
    "Commit",
    "commit",
    "Commit-Datum",
    "Verbindlicher Termin",
    "Fälligkeitsdatum",
    "Due Date",
  ]);

  const revisedDate = pick(row, ["Revised Date", "revised_date", "Revised Commit Date", "RevisedCommitDate"]);

  const chosenCommit = revisedDate || commitDate;

  const remainingTime = pick(row, ["Remaining Time", "remaining_time", "Restzeit"]) || formatRemainingFromCommit(chosenCommit);
  const remainingHours = remainingHoursFromCommit(chosenCommit);

  const groupKey = normalizeGroupFromQueueType(queueType);
  const subtype = pick(row, ["Sub Type", "Subtype", "subtype"]) || groupKey;

  return {
    queue_type: queueType,
    external_id: externalId,
    group_key: groupKey || subtype || "Unknown",
    so_number: pick(row, ["SO #", "SO", "SO#", "so_number", "Sales Order #", "Sales Order#"]),
    status: pick(row, ["Status", "activity_status", "Activity Status"]),
    owner: pick(row, ["Owner", "owner", "Besitzer", "Verantwortlich"]),
    severity: pick(row, ["Severity", "severity"]),
    commit_date: parseAnyDateToIso(commitDate),
    revised_commit_date: parseAnyDateToIso(revisedDate),
    dispatch_date: parseAnyDateToIso(pick(row, ["Dispatch Date", "Dispatch Day", "dispatch_date"])),
    sched_start: parseAnyDateToIso(pick(row, [
      "Sched. Start",
      "Sched Start",
      "Sched. Start ",
      "SchedStart",
      "sched_start",
      "Geplanter Start",
      "Startzeit",
      "Scheduled Start",
      "Start Date",
    ])),
    remaining_time_text: remainingTime || null,
    remaining_hours: remainingHours,
    subtype,
    system_name: pick(row, ["System Name", "SystemName", "System", "system_name"]),
    account_name: pick(row, ["Account Name", "AccountName", "account_name"]),
    customer_trouble_type: pick(row, [
      "Customer Trouble Type",
      "customer_trouble_type",
      "Activity Sub Type",
      "activity_sub_type",
    ]),
    raw_json: row || {},
  };
}

function pickFromMany(sources, keys) {
  for (const src of sources) {
    const v = pick(src, keys);
    if (v) return v;
  }
  return "";
}

function mapIngestItemToDb(queueType, groupKeyFromPayload, item) {
  if (!item) return null;

  const queueTypeCanon = canonicalizeQueueType(queueType);
  if (!queueTypeCanon) return null;

  const externalId = String(item.ticketKey || item.external_id || item.externalId || "").trim();
  if (!externalId) return null;

  const rawLabels = item?.rawJson?.labels || item?.raw_json?.labels || null;
  const rawColIds = item?.rawJson?.colIds || item?.raw_json?.colIds || null;
  const sources = [rawLabels, rawColIds, item.labels, item.colIds].filter(Boolean);

  const commitDateTxt = String(item.commitDate || "").trim() || pickFromMany(sources, [
    "Commit Date",
    "Commit Day",
    "commit_date",
    "Due Date",
    "Fälligkeitsdatum",
    "Verbindlicher Termin",
  ]);

  const revisedDateTxt = String(item.revisedCommitDate || "").trim() || pickFromMany(sources, [
    "Revised Commit Date",
    "Revised Date",
    "revised_date",
    "RevisedCommitDate",
  ]);

  const chosenCommit = revisedDateTxt || commitDateTxt;

  const remainingTimeTxt = String(item.remainingTimeText || "").trim() || pickFromMany(sources, [
    "Remaining Time",
    "remaining_time",
    "Restzeit",
    "Time Remaining",
    "SLA Remaining",
  ]) || formatRemainingFromCommit(chosenCommit);

  const remainingHours =
    (item.remainingHours !== undefined && item.remainingHours !== null && Number.isFinite(Number(item.remainingHours)))
      ? Number(item.remainingHours)
      : remainingHoursFromCommit(chosenCommit);

  const owner = String(item.owner || "").trim() || pickFromMany(sources, ["Owner", "owner", "Assigned To", "Assignee", "Besitzer", "Verantwortlich"]);
  const status = String(item.status || "").trim() || pickFromMany(sources, ["Status", "activity_status", "Activity Status", "State"]);
  const severity = pickFromMany(sources, ["Severity", "severity"]);

  const schedStartTxt = String(item.schedStart || "").trim() || pickFromMany(sources, [
    "Sched. Start",
    "Sched Start",
    "Scheduled Start",
    "Start Date",
    "sched_start",
    "Geplanter Start",
  ]);

  const dispatchTxt = pickFromMany(sources, ["Dispatch Date", "Dispatch Day", "dispatch_date"]);

  const subtype = pickFromMany(sources, ["Sub Type", "Subtype", "subtype", "ACTIVITY", "Activity", "activity", "Activity Type", "ActivityType"]) || normalizeGroupFromQueueType(queueTypeCanon) || String(groupKeyFromPayload || "").trim();

  const group_key = normalizeGroupFromQueueType(queueTypeCanon) || subtype || String(groupKeyFromPayload || "").trim() || "Unknown";

  const soNumber = pickFromMany(sources, ["SO #", "SO", "SO#", "so_number", "Sales Order #", "Sales Order#"]);
  const systemName = pickFromMany(sources, ["System Name", "SystemName", "System", "system_name", "SYSTEM_NAME", "SYSTEMNAME", "Systemname"]);
  const accountName = pickFromMany(sources, ["Account Name", "AccountName", "account_name"]);
  const customerTroubleType = pickFromMany(sources, [
    "Customer Trouble Type",
    "customer_trouble_type",
    "Activity Sub Type",
    "activity_sub_type",
  ]);

  return {
    queue_type: queueTypeCanon,
    external_id: externalId,
    group_key,
    so_number: soNumber,
    status,
    owner,
    severity,
    commit_date: parseAnyDateToIso(commitDateTxt),
    revised_commit_date: parseAnyDateToIso(revisedDateTxt),
    dispatch_date: parseAnyDateToIso(dispatchTxt),
    sched_start: parseAnyDateToIso(schedStartTxt),
    remaining_time_text: remainingTimeTxt,
    remaining_hours: remainingHours,
    subtype,
    system_name: systemName,
    account_name: accountName,
    customer_trouble_type: customerTroubleType,
    raw_json: {
      ...((item.rawJson && typeof item.rawJson === "object") ? item.rawJson : {}),
      __ingest_meta: {
        receivedAt: new Date().toISOString(),
      }
    }
  };
}

function requireIngestKey(req, res) {
  const expected = config.QUEUE_INGEST_KEY ? String(config.QUEUE_INGEST_KEY).trim() : "";

  if (!expected) {
    // No key configured:
    //  - Production: always reject (key is mandatory)
    //  - Development: reject unless ALLOW_INSECURE_INGEST=true is explicitly set
    if (config.isProd) {
      console.error("[SEC] QUEUE_INGEST_KEY is not set in production — rejecting ingest");
      res.status(401).json({ ok: false, error: "Ingest key not configured on server" });
      return false;
    }
    if (process.env.ALLOW_INSECURE_INGEST !== "true") {
      console.warn("[SEC] No QUEUE_INGEST_KEY set. Set ALLOW_INSECURE_INGEST=true to permit keyless ingest in dev.");
      res.status(401).json({ ok: false, error: "Ingest key required. Set ALLOW_INSECURE_INGEST=true in dev to bypass." });
      return false;
    }
    console.warn("[SEC] ALLOW_INSECURE_INGEST=true — accepting keyless ingest (dev only)");
    return true;
  }

  const rawHeader = req.header("X-OES-INGEST-KEY");
  const got = String(rawHeader || "").trim();
  const missingHeader = rawHeader === undefined || rawHeader === null || String(rawHeader).trim() === "";
  if (!got || got !== expected) {
    console.warn(
      `[SEC] Ingest key rejected — ip=${req.ip} missingHeader=${missingHeader} receivedLen=${got.length} expectedLen=${expected.length}`
    );
    res.status(401).json({
      ok: false,
      error: "Unauthorized ingest",
      missingHeader,
      headerKeyLength: got.length,
      expectedKeySet: !!expected,
    });
    return false;
  }
  return true;
}


/* ---------------- Routes ---------------- */

/* POST /api/queue/snapshot  (public via ingest key) */
router.post("/snapshot", async (req, res) => {
  if (!requireIngestKey(req, res)) return;

  const body = req.body || {};
  const queuesInput = body.queues;

  const nowIso = String(body.jarvisSeenAt || new Date().toISOString());

  console.log(`\n[CRAWLER INGEST] Received payload. Keys:`, Object.keys(body));
  if (queuesInput && typeof queuesInput === "object" && !Array.isArray(queuesInput)) {
    console.log(`[CRAWLER INGEST] (Old Format) Queue Keys:`, Object.keys(queuesInput));
    for (const k of Object.keys(queuesInput)) {
      console.log(`  -> ${k}: ${Array.isArray(queuesInput[k]) ? queuesInput[k].length : 0} rows`);
    }
  } else if (Array.isArray(queuesInput)) {
    console.log(`[CRAWLER INGEST] (New array Format) Array len:`, queuesInput.length);
    for (const q of queuesInput) {
      console.log(`  -> ${q.queueType}: ${Array.isArray(q.items) ? q.items.length : 0} rows`);
    }
  } else {
    console.log(`[CRAWLER INGEST] WARNING: Payload has no valid 'queues' property.`);
  }

  // Normalize input to a flat list of items with queueType/groupKey
  // Support BOTH Array (new) and Object (old) formats
  let itemsToUpsert = [];
  let completeTypesToCheck = new Set(); // Strings: "SmartHands", etc.

  if (Array.isArray(queuesInput)) {
    // NEW Format: [{ groupKey, queueType, complete, expected, actual, items: [...] }]
    for (const q of queuesInput) {
      const qType = canonicalizeQueueType(q?.queueType);
      if (!qType) continue;

      // Only mark missing/deactivation for queue types that were scraped completely
      if (q?.complete === true) completeTypesToCheck.add(qType);

      const gKey = String(q?.groupKey || "").trim();
      if (Array.isArray(q.items)) {
        for (const item of q.items) {
          const m = mapIngestItemToDb(qType, gKey, item);
          if (m) itemsToUpsert.push(m);
        }
      }
    }
  } else if (typeof queuesInput === "object" && queuesInput) {
    // OLD Format: { smartHands: [...], ... }
    const types = ["smartHands", "ccInstalls", "troubleTickets"];
    const typeMap = { "smartHands": "SmartHands", "ccInstalls": "CCInstalls", "troubleTickets": "TroubleTickets" };

    for (const k of types) {
      if (Array.isArray(queuesInput[k])) {
        const qType = typeMap[k];
        completeTypesToCheck.add(qType);
        for (const r of queuesInput[k]) {
          const m = mapJarvisRowToDb(qType, r);
          if (m) itemsToUpsert.push(m);
          else {
            console.log(`[CRAWLER INGEST] WARNING: Failed to map a legacy row in queue ${k}. Missing external ID?`, pick(r, ["Act_No", "Activity #", "TICKET_ID", "Ticket ID"]));
          }
        }
      }
    }
  }

  const completeTypes = Array.from(completeTypesToCheck); // e.g. ["SmartHands", "CCInstalls"]

  try {
    await db.query("BEGIN");

    // 1. Snapshot Current Active State (Before)
    const beforeRes = await db.query(
      `SELECT queue_type, external_id
       FROM queue_items
       WHERE active = true AND is_final_closed = false`
    );
    const beforeSet = new Set(beforeRes.rows.map((r) => `${r.queue_type}::${r.external_id}`));
    const seenSet = new Set();

    // 2. Upsert New Items
    const upsertSql = `
      INSERT INTO queue_items (
        queue_type, external_id, group_key,
        so_number, status, owner, severity,
        commit_date, revised_commit_date,
        dispatch_date, sched_start,
        remaining_time_text, remaining_hours,
        subtype, system_name, account_name, customer_trouble_type,
        raw_json,
        active, missing_count, closed_at, inactive_reason, is_final_closed,
        first_seen_at, last_seen_at, jarvis_seen_at, updated_at
      ) VALUES (
        $1,$2,$3,
        $4,$5,$6,$7,
        $8,$9,
        $10,$11,
        $12,$13,
        $14,$15,$16,$17,
        $18::jsonb,
        true,0,NULL,NULL,false,
        NOW(),NOW(),NOW(),NOW()
      )
      ON CONFLICT (queue_type, external_id) DO UPDATE SET
        group_key = EXCLUDED.group_key,
        so_number = COALESCE(NULLIF(EXCLUDED.so_number,''), queue_items.so_number),
        status = COALESCE(NULLIF(EXCLUDED.status,''), queue_items.status),
        owner = COALESCE(NULLIF(EXCLUDED.owner,''), queue_items.owner),
        severity = COALESCE(NULLIF(EXCLUDED.severity,''), queue_items.severity),
        commit_date = COALESCE(EXCLUDED.commit_date, queue_items.commit_date),
        revised_commit_date = COALESCE(EXCLUDED.revised_commit_date, queue_items.revised_commit_date),
        dispatch_date = COALESCE(EXCLUDED.dispatch_date, queue_items.dispatch_date),
        sched_start = COALESCE(EXCLUDED.sched_start, queue_items.sched_start),
        remaining_time_text = COALESCE(NULLIF(EXCLUDED.remaining_time_text,''), queue_items.remaining_time_text),
        remaining_hours = COALESCE(EXCLUDED.remaining_hours, queue_items.remaining_hours),
        subtype = COALESCE(NULLIF(EXCLUDED.subtype,''), queue_items.subtype),
        system_name = COALESCE(NULLIF(EXCLUDED.system_name,''), queue_items.system_name),
        account_name = COALESCE(NULLIF(EXCLUDED.account_name,''), queue_items.account_name),
        customer_trouble_type = COALESCE(NULLIF(EXCLUDED.customer_trouble_type,''), queue_items.customer_trouble_type),
        raw_json = COALESCE(EXCLUDED.raw_json, queue_items.raw_json),
        active = true,
        missing_count = 0,
        closed_at = NULL,
        inactive_reason = NULL,
        is_final_closed = false,
        last_seen_at = NOW(),
        jarvis_seen_at = NOW(),
        updated_at = NOW()
    `;

    for (const it of itemsToUpsert) {
      const key = `${it.queue_type}::${it.external_id}`;
      seenSet.add(key);

      await db.query(upsertSql, [
        it.queue_type,
        it.external_id,
        it.group_key,
        it.so_number || "",
        it.status || "",
        it.owner || "",
        it.severity || "",
        it.commit_date,
        it.revised_commit_date,
        it.dispatch_date,
        it.sched_start,
        it.remaining_time_text || "",
        it.remaining_hours,
        it.subtype || "",
        it.system_name || "",
        it.account_name || "",
        it.customer_trouble_type || "",
        JSON.stringify(it.raw_json || {})
      ]);
    }

    // Mark missing (only for complete types)
    const completeSet = new Set(completeTypes.map(String));
    const candidatesRes = await db.query(
      `SELECT queue_type, external_id, status, missing_count,
              commit_date, revised_commit_date,
              owner, group_key,
              first_seen_at, last_seen_at,
              remaining_time_text,
              raw_json
       FROM queue_items
       WHERE is_final_closed = false`
    );

    let goneCount = 0;
    for (const r of candidatesRes.rows) {
      if (!completeSet.has(String(r.queue_type))) continue;
      const k = `${r.queue_type}::${r.external_id}`;
      if (seenSet.has(k)) continue;

      const newMissing = Number(r.missing_count || 0) + 1;
      const shouldClose = isClosedStatus(r.status) || newMissing >= 2;
      const inactive_reason = isClosedStatus(r.status) ? "CLOSED" : "TICKET_GONE";

      await db.query(
        `UPDATE queue_items
         SET active = false,
             missing_count = $1,
             closed_at = COALESCE(closed_at, NOW()),
             inactive_reason = $2,
             is_final_closed = $3
         WHERE queue_type = $4 AND external_id = $5`,
        [newMissing, inactive_reason, shouldClose, r.queue_type, r.external_id]
      );
      goneCount++;

      // Expired archive (commit exceeded)
      const commitMs =
        (r.revised_commit_date && new Date(r.revised_commit_date).getTime()) ||
        (r.commit_date && new Date(r.commit_date).getTime()) ||
        null;

      if (commitMs !== null && Number.isFinite(commitMs) && commitMs < Date.now()) {
        await db.query(
          `INSERT INTO expired_tickets (
             queue_type, external_id, group_name, owner, status,
             commit_date, revised_commit_date, remaining_time_text,
             first_seen_at, last_seen_at, resolved_at, raw_json
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11::jsonb
           )
           ON CONFLICT (queue_type, external_id) DO UPDATE SET
             group_name = EXCLUDED.group_name,
             owner = EXCLUDED.owner,
             status = EXCLUDED.status,
             commit_date = EXCLUDED.commit_date,
             revised_commit_date = EXCLUDED.revised_commit_date,
             remaining_time_text = EXCLUDED.remaining_time_text,
             last_seen_at = EXCLUDED.last_seen_at,
             raw_json = EXCLUDED.raw_json`,
          [
            r.queue_type,
            r.external_id,
            r.group_key,
            r.owner,
            r.status,
            r.commit_date,
            r.revised_commit_date,
            r.remaining_time_text,
            r.first_seen_at,
            r.last_seen_at,
            JSON.stringify(r.raw_json || {}),
          ]
        );
      }
    }

    // Run log + deltas
    const afterSet = new Set(seenSet);
    const newItems = [];
    for (const k of afterSet) if (!beforeSet.has(k)) newItems.push(k);
    const goneItems = [];
    for (const k of beforeSet) if (!afterSet.has(k)) goneItems.push(k);

    const runRes = await db.query(
      `INSERT INTO crawler_runs (snapshot_at, complete_types_json, total_active, new_count, gone_count, success, error_message)
       VALUES ($1, $2::jsonb, $3, $4, $5, true, NULL)
       RETURNING id`,
      [nowIso, JSON.stringify(completeTypes), itemsToUpsert.length, newItems.length, goneItems.length]
    );
    const runId = runRes.rows?.[0]?.id;

    if (runId) {
      for (const k of newItems) {
        const [queue_type, external_id] = k.split("::");
        const group_name = normalizeGroupFromQueueType(queue_type);
        await db.query(
          `INSERT INTO crawler_run_deltas (run_id, delta_type, queue_type, external_id, group_name)
           VALUES ($1,'NEW',$2,$3,$4)`,
          [runId, queue_type, external_id, group_name]
        );
      }
      for (const k of goneItems) {
        const [queue_type, external_id] = k.split("::");
        const group_name = normalizeGroupFromQueueType(queue_type);
        await db.query(
          `INSERT INTO crawler_run_deltas (run_id, delta_type, queue_type, external_id, group_name)
           VALUES ($1,'GONE',$2,$3,$4)`,
          [runId, queue_type, external_id, group_name]
        );
      }
    }

    await db.query("COMMIT");
    console.log(`[CRAWLER INGEST] OK: ${itemsToUpsert.length} items upserted, ${newItems.length} new, ${goneCount} gone. Types: ${completeTypes.join(", ")}`);
    res.json({ ok: true, processed: itemsToUpsert.length, active_seen: seenSet.size, new_count: newItems.length, gone_count: goneCount, complete_types: completeTypes });
  } catch (e) {
    try {
      await db.query("ROLLBACK");
    } catch {
      // ignore
    }

    // Try to record failed run
    try {
      await db.query(
        `INSERT INTO crawler_runs (snapshot_at, complete_types_json, total_active, new_count, gone_count, success, error_message)
         VALUES ($1, $2::jsonb, 0, 0, 0, false, $3)`,
        [new Date().toISOString(), JSON.stringify(completeTypes), String(e?.message || e)]
      );
    } catch {
      // ignore
    }

    console.error("QUEUE SNAPSHOT ERROR:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

export default router;
