/* ================================================ */
/* Assignment Engine — Ticket Sorting & Worker      */
/*                     Selection (Deterministic)    */
/* ================================================ */

import { PRIORITY_ORDER, PRIORITY_TIERS } from '../constants.js';
import { evaluateSystemGrouping } from '../rules/systemGrouping.js';
import { checkQueuePurity } from '../rules/queuePurity.js';

/**
 * Compute the priority tier for a ticket according to the spec:
 *
 *   Tier 1: TroubleTicket High (and Critical)
 *   Tier 2: TroubleTicket Medium
 *   Tier 3: KPI queue tickets (SmartHands, CrossConnect) — sorted by remaining time
 *   Tier 4: Scheduled tickets
 *   Tier 5: TroubleTicket Low
 *   Tier 6: Everything else
 *
 * @param {object} ticket - Normalized ticket
 * @returns {number} Tier number (lower = higher priority)
 */
export function getPriorityTier(ticket) {
  const t = ticket.type;
  const p = ticket.priority;

  if (t === 'TroubleTicket' && (p === 'high' || p === 'critical')) return PRIORITY_TIERS.TT_HIGH;
  if (t === 'TroubleTicket' && p === 'medium') return PRIORITY_TIERS.TT_MEDIUM;
  if (t === 'SmartHands' || t === 'CrossConnect') return PRIORITY_TIERS.KPI_QUEUE;
  if (t === 'Scheduled') return PRIORITY_TIERS.SCHEDULED;
  if (t === 'TroubleTicket' && p === 'low') return PRIORITY_TIERS.TT_LOW;
  if (t === 'TroubleTicket') return PRIORITY_TIERS.TT_LOW; // unknown priority TT defaults to low tier

  return PRIORITY_TIERS.OTHER;
}

/**
 * Sort tickets by the spec-defined deterministic priority rules:
 *
 *   Primary: Priority tier (1-6)
 *   Within same tier:
 *     - Lowest remaining commit time (dueAt - now)
 *     - Earliest scheduled time (scheduledStart)
 *     - Oldest ticket creation (createdAt)
 *   Ultimate fallback: ticket ID (lexicographic)
 *
 * Within tier 1: critical before high
 * Within tier 3 (KPI): lowest remaining time first
 *
 * @param {object[]} tickets - Array of normalized tickets
 * @param {number}   [now]   - Current time ms (for testing)
 * @returns {object[]} Sorted copy of the array
 */
export function sortTickets(tickets, now = Date.now()) {
  return [...tickets].sort((a, b) => {
    // 1. Primary: priority tier
    const aTier = getPriorityTier(a);
    const bTier = getPriorityTier(b);
    if (aTier !== bTier) return aTier - bTier;

    // 2. Within tier 1: critical before high
    if (aTier === PRIORITY_TIERS.TT_HIGH) {
      const aPrio = PRIORITY_ORDER[a.priority] ?? 4;
      const bPrio = PRIORITY_ORDER[b.priority] ?? 4;
      if (aPrio !== bPrio) return aPrio - bPrio;
    }

    // 3. Lowest remaining commit time (due date closest to now first)
    const aRemaining = a.dueAt ? new Date(a.dueAt).getTime() - now : Infinity;
    const bRemaining = b.dueAt ? new Date(b.dueAt).getTime() - now : Infinity;
    if (aRemaining !== bRemaining) return aRemaining - bRemaining;

    // 4. Earliest scheduled time
    const aSched = a.scheduledStart ? new Date(a.scheduledStart).getTime() : Infinity;
    const bSched = b.scheduledStart ? new Date(b.scheduledStart).getTime() : Infinity;
    if (aSched !== bSched) return aSched - bSched;

    // 5. Oldest ticket creation
    if (a.createdAt && b.createdAt) {
      const aCreated = new Date(a.createdAt).getTime();
      const bCreated = new Date(b.createdAt).getTime();
      if (aCreated !== bCreated) return aCreated - bCreated;
    } else if (a.createdAt) {
      return -1;
    } else if (b.createdAt) {
      return 1;
    }

    // 6. Stable fallback: ticket ID (lexicographic)
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Select the best worker from eligible candidates deterministically.
 *
 * Tie-breaker order (per spec):
 *   1. Existing grouped system name (worker already has tickets for this system)
 *   2. Queue purity (worker's queue matches ticket type)
 *   3. Least active workload (fewest current tickets)
 *   4. Worker ID (deterministic fallback)
 *
 * @param {object[]} candidates        - Eligible worker objects
 * @param {object}   ticket            - Normalized ticket
 * @param {object}   settings          - Engine settings
 * @param {Map}      workerTicketsMap  - Map<workerId, ticket[]> of current assignments
 * @param {boolean}  insufficientResources - Whether resources are insufficient
 * @param {number}   [now]             - Current time ms
 * @returns {{ worker: object|null, reason: string, tieBreaker: string|null }}
 */
export function selectWorker(candidates, ticket, settings, workerTicketsMap = new Map(), insufficientResources = false, now = Date.now()) {
  if (!candidates || candidates.length === 0) {
    return { worker: null, reason: 'No eligible candidates', tieBreaker: null };
  }

  if (candidates.length === 1) {
    return { worker: candidates[0], reason: 'Only one eligible candidate', tieBreaker: null };
  }

  // Score each candidate on the 4-tier tie-breaking criteria
  const scored = candidates.map(c => {
    const currentTickets = workerTicketsMap.get(c.id) || [];

    // 1. System name grouping score
    const grouping = evaluateSystemGrouping(c, ticket, currentTickets, now);

    // 2. Queue purity score
    const purity = checkQueuePurity(c, ticket, currentTickets, insufficientResources, now);

    // 3. Workload (negative: fewer = better)
    const workload = currentTickets.length;

    return {
      candidate: c,
      groupingScore: grouping.score,
      groupingGrouped: grouping.grouped,
      groupingBlocked: grouping.blocked || false,
      purityPure: purity.pure,
      workload,
      // For debugging
      _groupingReason: grouping.reason,
      _purityReason: purity.reason,
    };
  });

  // Remove candidates blocked by system grouping (e.g., SH max 3)
  const unblocked = scored.filter(s => !s.groupingBlocked);
  const pool = unblocked.length > 0 ? unblocked : scored; // fallback if all blocked

  // Sort by tie-breaking criteria
  pool.sort((a, b) => {
    // 1. Existing grouped system name (higher score = better)
    if (a.groupingScore !== b.groupingScore) return b.groupingScore - a.groupingScore;

    // 2. Queue purity (pure before impure)
    if (a.purityPure !== b.purityPure) return a.purityPure ? -1 : 1;

    // 3. Least active workload (fewer tickets = better)
    if (a.workload !== b.workload) return a.workload - b.workload;

    // 4. Worker ID (deterministic)
    return a.candidate.id - b.candidate.id;
  });

  const winner = pool[0];
  const reasons = [];
  let tieBreaker = 'worker-id';

  if (winner.groupingGrouped && winner.groupingScore > 0) {
    reasons.push(`system grouping (score: ${winner.groupingScore})`);
    tieBreaker = 'system-grouping';
  }
  if (winner.purityPure) {
    reasons.push('queue purity maintained');
    if (tieBreaker === 'worker-id') tieBreaker = 'queue-purity';
  }
  reasons.push(`workload: ${winner.workload} tickets`);
  reasons.push(`worker ID: ${winner.candidate.id}`);

  return {
    worker: winner.candidate,
    reason: `Selected by: ${reasons.join(', ')}`,
    tieBreaker,
  };
}

/**
 * @deprecated Use selectWorker with workerTicketsMap instead.
 * Kept for backward compatibility during migration.
 */
export function resolveWorkerTie(tiedCandidates, settings, rotationState, ticket) {
  const sorted = [...tiedCandidates].sort((a, b) => a.id - b.id);
  return { worker: sorted[0], reason: 'Legacy stable ID tie-breaker: lowest worker ID', tieBreaker: 'stable-id' };
}
