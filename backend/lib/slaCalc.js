/**
 * backend/lib/slaCalc.js
 *
 * Pure SLA calculation helpers for backend use (reports, metrics, queue routes).
 * Mirror of frontend/src/utils/ticketColors.ts — no DOM or React dependencies.
 *
 * SLA tiers (matching frontend colour coding):
 *   overdue   hours < 0       ticket already past commit date
 *   critical  0  ≤ hours ≤ 8  needs immediate attention
 *   warning   8  < hours ≤ 15 approaching deadline
 *   soon      15 < hours ≤ 24 within today
 *   ok        hours > 24      plenty of time remaining
 */

/* ------------------------------------------------ */
/* CONSTANTS                                        */
/* ------------------------------------------------ */

const MS_PER_HOUR = 3_600_000;

/** @typedef {"ok"|"soon"|"warning"|"critical"|"overdue"} SlaTier */

/* ------------------------------------------------ */
/* getRemainingMs                                   */
/* ------------------------------------------------ */

/**
 * Returns milliseconds until the commit date deadline.
 * Prefers revised_commit_date; falls back to commit_date.
 * Returns null when no parseable date is present.
 *
 * @param {Record<string, any>} ticket
 * @returns {number|null}
 */
export function getRemainingMs(ticket) {
  const raw =
    ticket?.revised_commit_date ??
    ticket?.revisedCommitDate ??
    ticket?.commit_date ??
    ticket?.commitDate ??
    null;

  if (!raw) return null;

  const target = new Date(raw).getTime();
  if (!Number.isFinite(target)) return null;

  return target - Date.now();
}

/* ------------------------------------------------ */
/* getSlaTier                                       */
/* ------------------------------------------------ */

/**
 * Returns the SLA tier for a given remaining-millisecond value.
 *
 * @param {number|null} ms
 * @returns {SlaTier}
 */
export function getSlaTier(ms) {
  if (ms === null) return "ok";          // no deadline set → not in violation
  const hours = ms / MS_PER_HOUR;
  if (hours < 0)   return "overdue";
  if (hours <= 8)  return "critical";
  if (hours <= 15) return "warning";
  if (hours <= 24) return "soon";
  return "ok";
}

/* ------------------------------------------------ */
/* calcSlaStatus                                    */
/* ------------------------------------------------ */

/**
 * High-level helper: computes SLA status for a ticket object.
 *
 * @param {Record<string, any>} ticket  Raw ticket row from DB or ingest payload
 * @returns {{ tier: SlaTier, hoursRemaining: number|null, msRemaining: number|null }}
 */
export function calcSlaStatus(ticket) {
  const ms = getRemainingMs(ticket);
  return {
    tier:           getSlaTier(ms),
    hoursRemaining: ms === null ? null : +(ms / MS_PER_HOUR).toFixed(2),
    msRemaining:    ms,
  };
}

/* ------------------------------------------------ */
/* formatRemaining                                  */
/* ------------------------------------------------ */

/**
 * Returns a human-readable remaining-time string (e.g. "3h 20m", "-1h 5m").
 * Negative values are prefixed with "-" to indicate overdue.
 *
 * @param {number|null} ms
 * @returns {string}
 */
export function formatRemaining(ms) {
  if (ms === null) return "—";

  const totalMin  = Math.floor(Math.abs(ms) / 60_000);
  let   h         = Math.floor(totalMin / 60);
  const m         = totalMin % 60;
  const prefix    = ms < 0 ? "-" : "";

  if (h >= 24) {
    const d = Math.floor(h / 24);
    h = h % 24;
    return `${prefix}${d}d ${h}h`;
  }
  if (h >= 1) return `${prefix}${h}h ${m}m`;
  return `${prefix}${m}m`;
}

/* ------------------------------------------------ */
/* isCritical / partitionBySla                     */
/* ------------------------------------------------ */

/**
 * Returns true when the ticket is in "critical" or "overdue" SLA tier.
 *
 * @param {Record<string, any>} ticket
 * @returns {boolean}
 */
export function isCritical(ticket) {
  const { tier } = calcSlaStatus(ticket);
  return tier === "critical" || tier === "overdue";
}

/**
 * Partitions an array of tickets into { urgent, normal } buckets.
 * urgent → critical or overdue; normal → everything else.
 *
 * @param {Record<string, any>[]} tickets
 * @returns {{ urgent: Record<string, any>[], normal: Record<string, any>[] }}
 */
export function partitionBySla(tickets) {
  const urgent = [];
  const normal = [];
  for (const t of tickets) {
    (isCritical(t) ? urgent : normal).push(t);
  }
  return { urgent, normal };
}
