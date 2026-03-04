/* ------------------------------------------------ */
/* services/queueIngest.service.js                  */
/* Business logic for queue snapshot ingestion.     */
/* Maps crawler payloads → DB rows, runs upserts.   */
/* ------------------------------------------------ */

import pool from "../db.js";
import {
  pick,
  pickFromMany,
  canonicalizeQueueType,
  normalizeGroupFromQueueType,
  isClosedStatus,
} from "../lib/queueNormalizer.js";
import {
  parseAnyDateToIso,
  formatRemainingFromCommit,
  remainingHoursFromCommit,
} from "../lib/dateParser.js";

/* ------------------------------------------------ */
/* ROW MAPPERS                                       */
/* ------------------------------------------------ */

/**
 * Map a row from the legacy (old-format object) payload to a DB record.
 * Old format: body.queues = { smartHands: [...], ccInstalls: [...], ... }
 */
export function mapJarvisRowToDb(queueType, row) {
  const externalId =
    queueType === "TroubleTickets"
      ? pick(row, ["Ticket ID", "TICKET_ID", "TicketID", "ticketId", "ticket_id"])
      : pick(row, [
          "Activity #", "ACT_NUM", "ACTIVITY_NO", "ActivityNo",
          "Order #", "ORDER_NUM", "ORDER_ID", "so_number", "SO #",
        ]);

  if (!externalId) return null;

  const commitDate  = pick(row, [
    "Commit Date", "Commit Day", "commit_date", "Commit", "commit",
    "Commit-Datum", "Verbindlicher Termin", "Fälligkeitsdatum", "Due Date",
  ]);
  const revisedDate = pick(row, ["Revised Date", "revised_date", "Revised Commit Date", "RevisedCommitDate"]);
  const chosenCommit = revisedDate || commitDate;

  const remainingTime  = pick(row, ["Remaining Time", "remaining_time", "Restzeit"]) || formatRemainingFromCommit(chosenCommit);
  const remainingHours = remainingHoursFromCommit(chosenCommit);
  const groupKey       = normalizeGroupFromQueueType(queueType);
  const subtype        = pick(row, ["Sub Type", "Subtype", "subtype"]) || groupKey;

  return {
    queue_type:             queueType,
    external_id:            externalId,
    group_key:              groupKey || subtype || "Unknown",
    so_number:              pick(row, ["SO #", "SO", "SO#", "so_number", "Sales Order #", "Sales Order#"]),
    status:                 pick(row, ["Status", "activity_status", "Activity Status"]),
    owner:                  pick(row, ["Owner", "owner", "Besitzer", "Verantwortlich"]),
    severity:               pick(row, ["Severity", "severity"]),
    commit_date:            parseAnyDateToIso(commitDate),
    revised_commit_date:    parseAnyDateToIso(revisedDate),
    dispatch_date:          parseAnyDateToIso(pick(row, ["Dispatch Date", "Dispatch Day", "dispatch_date"])),
    sched_start:            parseAnyDateToIso(pick(row, [
      "Sched. Start", "Sched Start", "Sched. Start ", "SchedStart", "sched_start",
      "Geplanter Start", "Startzeit", "Scheduled Start", "Start Date",
    ])),
    remaining_time_text:    remainingTime || null,
    remaining_hours:        remainingHours,
    subtype,
    system_name:            pick(row, ["System Name", "SystemName", "System", "system_name"]),
    account_name:           pick(row, ["Account Name", "AccountName", "account_name"]),
    customer_trouble_type:  pick(row, [
      "Customer Trouble Type", "customer_trouble_type",
      "Activity Sub Type", "activity_sub_type",
    ]),
    raw_json: row || {},
  };
}

/**
 * Map a new-format ingest item to a DB record.
 * New format: body.queues = [{ queueType, groupKey, items: [...] }]
 */
export function mapIngestItemToDb(queueType, groupKeyFromPayload, item) {
  if (!item) return null;

  const queueTypeCanon = canonicalizeQueueType(queueType);
  if (!queueTypeCanon) return null;

  const externalId = String(item.ticketKey || item.external_id || item.externalId || "").trim();
  if (!externalId) return null;

  const rawLabels  = item?.rawJson?.labels   || item?.raw_json?.labels  || null;
  const rawColIds  = item?.rawJson?.colIds   || item?.raw_json?.colIds  || null;
  const sources    = [rawLabels, rawColIds, item.labels, item.colIds].filter(Boolean);

  const commitDateTxt = String(item.commitDate || "").trim() || pickFromMany(sources, [
    "Commit Date", "Commit Day", "commit_date", "Due Date", "Fälligkeitsdatum", "Verbindlicher Termin",
  ]);

  const revisedDateTxt = String(item.revisedCommitDate || "").trim() || pickFromMany(sources, [
    "Revised Commit Date", "Revised Date", "revised_date", "RevisedCommitDate",
  ]);

  const chosenCommit = revisedDateTxt || commitDateTxt;

  const remainingTimeTxt =
    String(item.remainingTimeText || "").trim() ||
    pickFromMany(sources, ["Remaining Time", "remaining_time", "Restzeit", "Time Remaining", "SLA Remaining"]) ||
    formatRemainingFromCommit(chosenCommit);

  const remainingHours =
    item.remainingHours !== undefined && item.remainingHours !== null && Number.isFinite(Number(item.remainingHours))
      ? Number(item.remainingHours)
      : remainingHoursFromCommit(chosenCommit);

  const owner    = String(item.owner || "").trim() || pickFromMany(sources, ["Owner", "owner", "Assigned To", "Assignee", "Besitzer", "Verantwortlich"]);
  const status   = String(item.status || "").trim() || pickFromMany(sources, ["Status", "activity_status", "Activity Status", "State"]);
  const severity = pickFromMany(sources, ["Severity", "severity"]);

  const schedStartTxt = String(item.schedStart || "").trim() || pickFromMany(sources, [
    "Sched. Start", "Sched Start", "Scheduled Start", "Start Date", "sched_start", "Geplanter Start",
  ]);

  const dispatchTxt = pickFromMany(sources, ["Dispatch Date", "Dispatch Day", "dispatch_date"]);

  const subtype = pickFromMany(sources, [
    "Sub Type", "Subtype", "subtype", "ACTIVITY", "Activity", "activity", "Activity Type", "ActivityType",
  ]) || normalizeGroupFromQueueType(queueTypeCanon) || String(groupKeyFromPayload || "").trim();

  const group_key = normalizeGroupFromQueueType(queueTypeCanon) || subtype || String(groupKeyFromPayload || "").trim() || "Unknown";

  return {
    queue_type:             queueTypeCanon,
    external_id:            externalId,
    group_key,
    so_number:              pickFromMany(sources, ["SO #", "SO", "SO#", "so_number", "Sales Order #", "Sales Order#"]),
    status,
    owner,
    severity,
    commit_date:            parseAnyDateToIso(commitDateTxt),
    revised_commit_date:    parseAnyDateToIso(revisedDateTxt),
    dispatch_date:          parseAnyDateToIso(dispatchTxt),
    sched_start:            parseAnyDateToIso(schedStartTxt),
    remaining_time_text:    remainingTimeTxt,
    remaining_hours:        remainingHours,
    subtype,
    system_name:            pickFromMany(sources, ["System Name", "SystemName", "System", "system_name", "SYSTEM_NAME", "Systemname"]),
    account_name:           pickFromMany(sources, ["Account Name", "AccountName", "account_name"]),
    customer_trouble_type:  pickFromMany(sources, ["Customer Trouble Type", "customer_trouble_type", "Activity Sub Type", "activity_sub_type"]),
    raw_json: {
      ...((item.rawJson && typeof item.rawJson === "object") ? item.rawJson : {}),
      __ingest_meta: { receivedAt: new Date().toISOString() },
    },
  };
}

/* ------------------------------------------------ */
/* PAYLOAD NORMALIZER                               */
/* ------------------------------------------------ */

/**
 * Normalize the snapshot payload into a flat array of items + completeTypes set.
 * Supports both old (object) and new (array) format.
 */
export function normalizePayload(body) {
  const queuesInput     = body.queues;
  const itemsToUpsert   = [];
  const completeTypesSet = new Set();

  if (Array.isArray(queuesInput)) {
    for (const q of queuesInput) {
      const qType = canonicalizeQueueType(q?.queueType);
      if (!qType) continue;
      if (q?.complete === true) completeTypesSet.add(qType);
      const gKey = String(q?.groupKey || "").trim();
      if (Array.isArray(q.items)) {
        for (const item of q.items) {
          const m = mapIngestItemToDb(qType, gKey, item);
          if (m) itemsToUpsert.push(m);
        }
      }
    }
  } else if (typeof queuesInput === "object" && queuesInput) {
    const typeMap = { smartHands: "SmartHands", ccInstalls: "CCInstalls", troubleTickets: "TroubleTickets" };
    for (const [k, qType] of Object.entries(typeMap)) {
      if (Array.isArray(queuesInput[k])) {
        completeTypesSet.add(qType);
        for (const r of queuesInput[k]) {
          const m = mapJarvisRowToDb(qType, r);
          if (m) itemsToUpsert.push(m);
        }
      }
    }
  }

  return {
    itemsToUpsert,
    completeTypes: Array.from(completeTypesSet),
  };
}

/* ------------------------------------------------ */
/* DB UPSERT                                        */
/* ------------------------------------------------ */

const UPSERT_SQL = `
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
    $1,$2,$3, $4,$5,$6,$7, $8,$9, $10,$11, $12,$13,
    $14,$15,$16,$17, $18::jsonb,
    true,0,NULL,NULL,false,
    NOW(),NOW(),NOW(),NOW()
  )
  ON CONFLICT (queue_type, external_id) DO UPDATE SET
    group_key              = EXCLUDED.group_key,
    so_number              = COALESCE(NULLIF(EXCLUDED.so_number,''),              queue_items.so_number),
    status                 = COALESCE(NULLIF(EXCLUDED.status,''),                 queue_items.status),
    owner                  = COALESCE(NULLIF(EXCLUDED.owner,''),                  queue_items.owner),
    severity               = COALESCE(NULLIF(EXCLUDED.severity,''),               queue_items.severity),
    commit_date            = COALESCE(EXCLUDED.commit_date,                       queue_items.commit_date),
    revised_commit_date    = COALESCE(EXCLUDED.revised_commit_date,               queue_items.revised_commit_date),
    dispatch_date          = COALESCE(EXCLUDED.dispatch_date,                     queue_items.dispatch_date),
    sched_start            = COALESCE(EXCLUDED.sched_start,                       queue_items.sched_start),
    remaining_time_text    = COALESCE(NULLIF(EXCLUDED.remaining_time_text,''),    queue_items.remaining_time_text),
    remaining_hours        = COALESCE(EXCLUDED.remaining_hours,                   queue_items.remaining_hours),
    subtype                = COALESCE(NULLIF(EXCLUDED.subtype,''),                queue_items.subtype),
    system_name            = COALESCE(NULLIF(EXCLUDED.system_name,''),            queue_items.system_name),
    account_name           = COALESCE(NULLIF(EXCLUDED.account_name,''),           queue_items.account_name),
    customer_trouble_type  = COALESCE(NULLIF(EXCLUDED.customer_trouble_type,''),  queue_items.customer_trouble_type),
    raw_json               = COALESCE(EXCLUDED.raw_json,                          queue_items.raw_json),
    active                 = true,
    missing_count          = 0,
    closed_at              = NULL,
    inactive_reason        = NULL,
    is_final_closed        = false,
    last_seen_at           = NOW(),
    jarvis_seen_at         = NOW(),
    updated_at             = NOW()
`;

/**
 * Persist a queue snapshot to the database.
 * Handles upserts, mark-missing logic, expired archive, and run log.
 *
 * @param {object[]} itemsToUpsert - mapped DB rows
 * @param {string[]} completeTypes - queue types that were fully scraped
 * @param {string}   nowIso        - snapshot timestamp ISO string
 * @returns {{ processed, active_seen, new_count, gone_count, complete_types }}
 */
export async function persistSnapshot(itemsToUpsert, completeTypes, nowIso) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Snapshot active state before upserts
    const beforeRes = await client.query(
      `SELECT queue_type, external_id FROM queue_items WHERE active = true AND is_final_closed = false`
    );
    const beforeSet = new Set(beforeRes.rows.map((r) => `${r.queue_type}::${r.external_id}`));
    const seenSet   = new Set();

    // Upsert all items
    for (const it of itemsToUpsert) {
      seenSet.add(`${it.queue_type}::${it.external_id}`);
      await client.query(UPSERT_SQL, [
        it.queue_type, it.external_id, it.group_key,
        it.so_number || "", it.status || "", it.owner || "", it.severity || "",
        it.commit_date, it.revised_commit_date,
        it.dispatch_date, it.sched_start,
        it.remaining_time_text || "", it.remaining_hours,
        it.subtype || "", it.system_name || "", it.account_name || "", it.customer_trouble_type || "",
        JSON.stringify(it.raw_json || {}),
      ]);
    }

    // Mark missing (only for complete types)
    const completeSet    = new Set(completeTypes.map(String));
    const candidatesRes  = await client.query(
      `SELECT queue_type, external_id, status, missing_count,
              commit_date, revised_commit_date,
              owner, group_key, first_seen_at, last_seen_at,
              remaining_time_text, raw_json
       FROM queue_items WHERE is_final_closed = false`
    );

    let goneCount = 0;
    for (const r of candidatesRes.rows) {
      if (!completeSet.has(String(r.queue_type))) continue;
      const k = `${r.queue_type}::${r.external_id}`;
      if (seenSet.has(k)) continue;

      const newMissing      = Number(r.missing_count || 0) + 1;
      const shouldClose     = isClosedStatus(r.status) || newMissing >= 2;
      const inactive_reason = isClosedStatus(r.status) ? "CLOSED" : "TICKET_GONE";

      await client.query(
        `UPDATE queue_items SET active = false, missing_count = $1, closed_at = COALESCE(closed_at, NOW()),
                inactive_reason = $2, is_final_closed = $3
         WHERE queue_type = $4 AND external_id = $5`,
        [newMissing, inactive_reason, shouldClose, r.queue_type, r.external_id]
      );
      goneCount++;

      // Archive to expired_tickets if commit exceeded
      const commitMs =
        (r.revised_commit_date && new Date(r.revised_commit_date).getTime()) ||
        (r.commit_date && new Date(r.commit_date).getTime()) ||
        null;

      if (commitMs !== null && Number.isFinite(commitMs) && commitMs < Date.now()) {
        await client.query(
          `INSERT INTO expired_tickets (
             queue_type, external_id, group_name, owner, status,
             commit_date, revised_commit_date, remaining_time_text,
             first_seen_at, last_seen_at, resolved_at, raw_json
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11::jsonb)
           ON CONFLICT (queue_type, external_id) DO UPDATE SET
             group_name = EXCLUDED.group_name, owner = EXCLUDED.owner, status = EXCLUDED.status,
             commit_date = EXCLUDED.commit_date, revised_commit_date = EXCLUDED.revised_commit_date,
             remaining_time_text = EXCLUDED.remaining_time_text,
             last_seen_at = EXCLUDED.last_seen_at, raw_json = EXCLUDED.raw_json`,
          [
            r.queue_type, r.external_id, r.group_key, r.owner, r.status,
            r.commit_date, r.revised_commit_date, r.remaining_time_text,
            r.first_seen_at, r.last_seen_at, JSON.stringify(r.raw_json || {}),
          ]
        );
      }
    }

    // Run log + deltas
    const newItems  = [...seenSet].filter((k) => !beforeSet.has(k));
    const goneItems = [...beforeSet].filter((k) => !seenSet.has(k));

    const runRes = await client.query(
      `INSERT INTO crawler_runs (snapshot_at, complete_types_json, total_active, new_count, gone_count, success, error_message)
       VALUES ($1, $2::jsonb, $3, $4, $5, true, NULL) RETURNING id`,
      [nowIso, JSON.stringify(completeTypes), itemsToUpsert.length, newItems.length, goneItems.length]
    );
    const runId = runRes.rows?.[0]?.id;

    if (runId) {
      for (const k of newItems) {
        const [queue_type, external_id] = k.split("::");
        await client.query(
          `INSERT INTO crawler_run_deltas (run_id, delta_type, queue_type, external_id, group_name)
           VALUES ($1,'NEW',$2,$3,$4)`,
          [runId, queue_type, external_id, normalizeGroupFromQueueType(queue_type)]
        );
      }
      for (const k of goneItems) {
        const [queue_type, external_id] = k.split("::");
        await client.query(
          `INSERT INTO crawler_run_deltas (run_id, delta_type, queue_type, external_id, group_name)
           VALUES ($1,'GONE',$2,$3,$4)`,
          [runId, queue_type, external_id, normalizeGroupFromQueueType(queue_type)]
        );
      }
    }

    await client.query("COMMIT");

    console.log(
      `[CRAWLER INGEST] OK: ${itemsToUpsert.length} upserted, ${newItems.length} new, ${goneCount} gone. Types: ${completeTypes.join(", ")}`
    );

    return {
      processed:      itemsToUpsert.length,
      active_seen:    seenSet.size,
      new_count:      newItems.length,
      gone_count:     goneCount,
      complete_types: completeTypes,
    };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }

    // Record failed run
    try {
      await pool.query(
        `INSERT INTO crawler_runs (snapshot_at, complete_types_json, total_active, new_count, gone_count, success, error_message)
         VALUES ($1, $2::jsonb, 0, 0, 0, false, $3)`,
        [new Date().toISOString(), JSON.stringify(completeTypes), String(err?.message || err)]
      );
    } catch { /* ignore */ }

    throw err;
  } finally {
    client.release();
  }
}
