/**
 * frontend/src/utils/slaCalc.ts
 *
 * Central SLA / remaining-time calculation utilities.
 * Re-exports key functions from commit.logic and ticketColors,
 * plus dashboard-specific helpers.
 *
 * Import from here instead of mixing imports from multiple sources.
 */

// Re-export from commit.logic (excel date parsing + remaining hours)
export { calcCommitHours, parseExcelDate, sortByRemainingTime } from "../components/commit/commit.logic";

// Re-export from ticketColors (millisecond remaining + color tier)
export { getRemainingMs, getColorTier, tierClasses, formatRemainingTime } from "./ticketColors";

/* ------------------------------------------------ */
/* Dashboard-specific SLA helpers                   */
/* ------------------------------------------------ */

/**
 * Returns whether a ticket is "critical" — overdue or due within `thresholdMs`.
 * Default threshold: 2 hours.
 */
export function isCriticalTicket(
  ticket: Record<string, unknown>,
  thresholdMs = 2 * 60 * 60 * 1000
): boolean {
  const rcd =
    (ticket.revised_commit_date as string | null) ??
    (ticket.revisedCommitDate as string | null) ??
    (ticket.commitDate as string | null);

  if (!rcd) return false;
  const ms = new Date(rcd).getTime() - Date.now();
  return ms <= thresholdMs;
}

/**
 * Partition tickets into overdue, due-soon-2h, and scheduled-today buckets.
 */
export function partitionTicketsByUrgency(tickets: Record<string, unknown>[]) {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const overdue:        Record<string, unknown>[] = [];
  const dueSoon2h:      Record<string, unknown>[] = [];
  const scheduledToday: Record<string, unknown>[] = [];

  for (const t of tickets) {
    const rcd =
      (t.revised_commit_date as string | null) ??
      (t.revisedCommitDate as string | null) ??
      (t.commitDate as string | null);

    if (!rcd) continue;
    const ms = new Date(rcd).getTime();

    if (ms < now) {
      overdue.push(t);
    } else if (ms - now <= 2 * 60 * 60 * 1000) {
      dueSoon2h.push(t);
    } else if (ms >= startOfDay.getTime() && ms <= endOfDay.getTime()) {
      scheduledToday.push(t);
    }
  }

  return { overdue, dueSoon2h, scheduledToday };
}
