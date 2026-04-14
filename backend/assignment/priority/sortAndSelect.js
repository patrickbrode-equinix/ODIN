/* ================================================ */
/* Assignment Engine — Ticket Sorting & Worker      */
/*                     Selection (Deterministic)    */
/* ================================================ */

import { PRIORITY_ORDER, PRIORITY_TIERS } from '../constants.js';
import { evaluateSystemGrouping } from '../rules/systemGrouping.js';
import { checkQueuePurity } from '../rules/queuePurity.js';
import { getAssignmentRuntimeRules } from '../services/runtimeRules.js';
import pool from '../../db.js';

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
  const runtimeRules = getAssignmentRuntimeRules();
  const ticketType = String(ticket.type || '').trim();
  const ticketPriority = String(ticket.priority || 'unknown').trim().toLowerCase();

  for (const rule of runtimeRules.priorityTiers || []) {
    const typeMatch = (rule.types || []).includes(ticketType);
    const priorityMatch = !rule.priorities || rule.priorities.length === 0 || rule.priorities.includes(ticketPriority);
    if (typeMatch && priorityMatch) {
      return rule.tier;
    }
  }

  if (ticketType === 'TroubleTicket') return PRIORITY_TIERS.TT_LOW;
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
 * Load the preferred-colleague graph relevant to a set of candidate workers.
 * Returns a Map<workerId, Set<workerId>> where each entry lists the candidate IDs
 * that the worker has nominated as Wunschkollegen.
 * Only mutual or one-directional links within the candidate pool are returned.
 *
 * @param {object[]} candidates - array of worker objects with id
 * @returns {Promise<Map<number, Set<number>>>}
 */
async function loadColleaguePreferences(candidates) {
  const prefMap = new Map();
  if (!candidates || candidates.length === 0) return prefMap;

  try {
    const candidateIds = candidates.map(c => c.id);
    const nameToId = new Map();
    for (const c of candidates) {
      if (c.name) nameToId.set(c.name.trim(), c.id);
    }

    const { rows } = await pool.query(
      `SELECT user_id, preferred_employee_name FROM preferred_colleagues WHERE user_id = ANY($1)`,
      [candidateIds]
    );

    for (const r of rows) {
      const preferredId = nameToId.get(r.preferred_employee_name?.trim());
      if (preferredId != null && preferredId !== r.user_id) {
        if (!prefMap.has(r.user_id)) prefMap.set(r.user_id, new Set());
        prefMap.get(r.user_id).add(preferredId);
      }
    }
  } catch {
    // Table may not exist yet — ignore, preferences are purely soft
  }

  return prefMap;
}

/**
 * Select the best worker from eligible candidates deterministically.
 *
 * Tie-breaker order (per spec):
 *   1. Existing grouped system name (worker already has tickets for this system)
 *   2. Queue purity (worker's queue matches ticket type)
 *   3. Least active workload (fewest current tickets)
 *   4. Preferred colleague bonus (soft — Wunschkollegen)
 *   5. Worker ID (deterministic fallback)
 *
 * @param {object[]} candidates        - Eligible worker objects
 * @param {object}   ticket            - Normalized ticket
 * @param {object}   settings          - Engine settings
 * @param {Map}      workerTicketsMap  - Map<workerId, ticket[]> of current assignments
 * @param {boolean}  insufficientResources - Whether resources are insufficient
 * @param {number}   [now]             - Current time ms
 * @returns {Promise<{ worker: object|null, reason: string, tieBreaker: string|null }>}
 */
export async function selectWorker(candidates, ticket, settings, workerTicketsMap = new Map(), insufficientResources = false, now = Date.now()) {
  const runtimeRules = getAssignmentRuntimeRules();
  if (!candidates || candidates.length === 0) {
    return { worker: null, reason: 'No eligible candidates', tieBreaker: null };
  }

  if (candidates.length === 1) {
    return { worker: candidates[0], reason: 'Only one eligible candidate', tieBreaker: null };
  }

  // Load preferred-colleague graph for soft tie-breaking
  const prefMap = await loadColleaguePreferences(candidates);

  // Build a set of already-assigned worker IDs (from workerTicketsMap) for colleague proximity
  const assignedWorkerIds = new Set();
  for (const [wId, tickets] of workerTicketsMap.entries()) {
    if (tickets && tickets.length > 0) assignedWorkerIds.add(wId);
  }

  // Score each candidate on the tie-breaking criteria
  const scored = candidates.map(c => {
    const currentTickets = workerTicketsMap.get(c.id) || [];

    // 1. System name grouping score
    const grouping = evaluateSystemGrouping(c, ticket, currentTickets, now);

    // 2. Queue purity score
    const purity = checkQueuePurity(c, ticket, currentTickets, insufficientResources, now);

    // 3. Workload (negative: fewer = better)
    const workload = currentTickets.length;

    // 4. Preferred colleague score (soft)
    //    Count how many of this worker's preferred colleagues are actively assigned.
    //    Higher = slight preference (but never overrides hard rules above).
    let colleagueScore = 0;
    const myPrefs = prefMap.get(c.id);
    if (myPrefs) {
      for (const prefId of myPrefs) {
        if (assignedWorkerIds.has(prefId)) colleagueScore++;
      }
    }
    // Also count reverse: how many other assigned workers nominated this candidate
    for (const [otherId, otherPrefs] of prefMap.entries()) {
      if (otherId !== c.id && otherPrefs.has(c.id) && assignedWorkerIds.has(otherId)) {
        colleagueScore++;
      }
    }

    return {
      candidate: c,
      groupingScore: grouping.score,
      groupingGrouped: grouping.grouped,
      groupingBlocked: grouping.blocked || false,
      purityPure: purity.pure,
      workload,
      colleagueScore,
      // For debugging
      _groupingReason: grouping.reason,
      _purityReason: purity.reason,
      maxTicketsReached: Number(runtimeRules.maxTicketsPerWorker || 0) > 0 && currentTickets.length >= Number(runtimeRules.maxTicketsPerWorker || 0),
    };
  });

  // Respect hard caps before applying softer tie-breakers.
  const withinTicketCap = scored.filter((entry) => !entry.maxTicketsReached);
  if (Number(runtimeRules.maxTicketsPerWorker || 0) > 0 && withinTicketCap.length === 0) {
    return {
      worker: null,
      reason: `All eligible candidates reached the configured ticket cap (${runtimeRules.maxTicketsPerWorker})`,
      tieBreaker: 'max-tickets-per-worker',
    };
  }

  // Remove candidates blocked by system grouping (e.g., SH max 3)
  const unblocked = withinTicketCap.filter(s => !s.groupingBlocked);
  const sortPool = unblocked.length > 0 ? unblocked : withinTicketCap;

  // Sort by tie-breaking criteria
  sortPool.sort((a, b) => {
    // 1. Existing grouped system name (higher score = better)
    if (a.groupingScore !== b.groupingScore) return b.groupingScore - a.groupingScore;

    // 2. Queue purity (pure before impure)
    if (a.purityPure !== b.purityPure) return a.purityPure ? -1 : 1;

    // 3. Least active workload (fewer tickets = better)
    if (runtimeRules.loadBalancing?.enabled !== false && runtimeRules.loadBalancing?.mode === 'least_workload' && a.workload !== b.workload) {
      return a.workload - b.workload;
    }

    // 4. Preferred colleague bonus (higher = better, soft tiebreaker)
    if (a.colleagueScore !== b.colleagueScore) return b.colleagueScore - a.colleagueScore;

    // 5. Worker ID (deterministic)
    return a.candidate.id - b.candidate.id;
  });

  const winner = sortPool[0];
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
  if (winner.colleagueScore > 0) {
    reasons.push(`colleague preference: ${winner.colleagueScore}`);
    if (tieBreaker === 'worker-id') tieBreaker = 'colleague-preference';
  }
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
