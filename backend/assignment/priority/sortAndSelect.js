/* ================================================ */
/* Assignment Engine — Ticket Sorting & Worker      */
/*                     Selection (Deterministic)    */
/* ================================================ */

import { PRIORITY_ORDER, TYPE_SORT_ORDER } from '../constants.js';

/**
 * Sort tickets by deterministic priority rules:
 * 1. Overdue first
 * 2. Critical tickets before others
 * 3. Earlier due/commit time first
 * 4. TroubleTicket > CrossConnect > SmartHands > Other > Unknown
 * 5. Older tickets (by createdAt) first at equal rank
 */
export function sortTickets(tickets) {
  const now = Date.now();

  return [...tickets].sort((a, b) => {
    // 1. Overdue first
    const aOverdue = a.dueAt && new Date(a.dueAt).getTime() < now ? 1 : 0;
    const bOverdue = b.dueAt && new Date(b.dueAt).getTime() < now ? 1 : 0;
    if (bOverdue !== aOverdue) return bOverdue - aOverdue; // overdue first (1 before 0)

    // 2. Critical tickets before others
    const aPrio = PRIORITY_ORDER[a.priority] ?? 4;
    const bPrio = PRIORITY_ORDER[b.priority] ?? 4;
    if (aPrio !== bPrio) return aPrio - bPrio; // lower number = higher priority

    // 3. Earlier due time first
    if (a.dueAt && b.dueAt) {
      const aDue = new Date(a.dueAt).getTime();
      const bDue = new Date(b.dueAt).getTime();
      if (aDue !== bDue) return aDue - bDue;
    } else if (a.dueAt) {
      return -1; // tickets with due dates come first
    } else if (b.dueAt) {
      return 1;
    }

    // 4. Type priority
    const aType = TYPE_SORT_ORDER[a.type] ?? 4;
    const bType = TYPE_SORT_ORDER[b.type] ?? 4;
    if (aType !== bType) return aType - bType;

    // 5. Older tickets first (by createdAt)
    if (a.createdAt && b.createdAt) {
      const aCreated = new Date(a.createdAt).getTime();
      const bCreated = new Date(b.createdAt).getTime();
      if (aCreated !== bCreated) return aCreated - bCreated;
    }

    // 6. Stable fallback: by ID
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Select the best worker from eligible candidates deterministically.
 * Returns { worker, reason, tieBreaker }
 *
 * Priority:
 * 1. Same site preferred
 * 2. Matching responsibility preferred
 * 3. Matching default role preferred
 * 4. Rotation tie-breaker (if enabled)
 * 5. Stable ID tie-breaker
 */
export function selectWorker(candidates, ticket, settings, rotationState = null) {
  if (!candidates || candidates.length === 0) {
    return { worker: null, reason: 'No eligible candidates', tieBreaker: null };
  }

  if (candidates.length === 1) {
    return { worker: candidates[0], reason: 'Only one eligible candidate', tieBreaker: null };
  }

  // Score each candidate (not a "scoring model" — just deterministic preference ordering)
  const scored = candidates.map(c => {
    let preference = 0;

    // 1. Same site
    if (ticket.site && c.site && c.site.toLowerCase().trim() === ticket.site.toLowerCase().trim()) {
      preference += 100;
    }

    // 2. Matching responsibility
    if (ticket.responsibility && c.responsibility &&
        c.responsibility.toLowerCase().trim() === ticket.responsibility.toLowerCase().trim()) {
      preference += 50;
    }

    // 3. Matching group/role
    if (ticket.queue && c.group &&
        c.group.toLowerCase().trim() === ticket.queue.toLowerCase().trim()) {
      preference += 25;
    }

    return { candidate: c, preference };
  });

  // Sort by preference descending
  scored.sort((a, b) => b.preference - a.preference);

  // Check if there's a clear winner
  const topPreference = scored[0].preference;
  const tied = scored.filter(s => s.preference === topPreference);

  if (tied.length === 1) {
    const reasons = [];
    if (topPreference >= 100) reasons.push('same site');
    if (topPreference >= 50) reasons.push('matching responsibility');
    if (topPreference >= 25) reasons.push('matching group');
    return {
      worker: tied[0].candidate,
      reason: `Best match: ${reasons.join(', ') || 'highest preference'}`,
      tieBreaker: null,
    };
  }

  // Tie-breaking needed
  return resolveWorkerTie(
    tied.map(t => t.candidate),
    settings,
    rotationState,
    ticket
  );
}

/**
 * Resolve a tie between equally-preferred workers.
 */
export function resolveWorkerTie(tiedCandidates, settings, rotationState, ticket) {
  const enableRotation = settings.enableRotationTieBreaker === 'true' || settings.enableRotationTieBreaker === true;

  if (enableRotation && rotationState) {
    // Round-robin: pick the worker who was least recently assigned
    const lastId = rotationState.last_assigned_worker_id;
    if (lastId != null) {
      // Find the next one after the last assigned in the sorted list
      const sorted = [...tiedCandidates].sort((a, b) => a.id - b.id);
      const lastIdx = sorted.findIndex(c => c.id === lastId);
      if (lastIdx >= 0 && lastIdx < sorted.length - 1) {
        const next = sorted[lastIdx + 1];
        return { worker: next, reason: 'Rotation tie-breaker: next in round-robin', tieBreaker: 'rotation' };
      }
      // Wrap around
      return { worker: sorted[0], reason: 'Rotation tie-breaker: wrapped to first worker', tieBreaker: 'rotation' };
    }
    // No rotation state yet: pick first by stable ID
    const sorted = [...tiedCandidates].sort((a, b) => a.id - b.id);
    return { worker: sorted[0], reason: 'Rotation tie-breaker: first run, selected first by ID', tieBreaker: 'rotation-init' };
  }

  // Stable ID fallback
  const sorted = [...tiedCandidates].sort((a, b) => a.id - b.id);
  return { worker: sorted[0], reason: 'Stable ID tie-breaker: lowest worker ID', tieBreaker: 'stable-id' };
}
