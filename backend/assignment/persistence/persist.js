/* ================================================ */
/* Assignment Engine — Persistence Layer            */
/* ================================================ */

import {
  assignmentRunRepository,
  assignmentDecisionRepository,
  assignmentRotationRepository,
} from '../repositories/index.js';

/**
 * Persist a complete assignment run (header).
 */
export async function persistAssignmentRun(runId, decisions, status = 'completed') {
  const counts = { assigned: 0, manual_review: 0, no_candidate: 0, not_relevant: 0, blocked: 0, error: 0 };
  for (const d of decisions) {
    if (counts[d.result] !== undefined) counts[d.result]++;
  }

  const summary = {
    totalDecisions: decisions.length,
    ...counts,
    finishedAt: new Date().toISOString(),
  };

  return assignmentRunRepository.finish(runId, {
    status,
    totalTickets: decisions.length + counts.not_relevant,
    relevant: decisions.length - counts.not_relevant,
    assigned: counts.assigned,
    manualReview: counts.manual_review,
    noCandidate: counts.no_candidate,
    notRelevant: counts.not_relevant,
    blocked: counts.blocked,
    errors: counts.error,
    summary,
  });
}

/**
 * Persist a single ticket decision.
 */
export async function persistTicketDecision(runId, decisionLog) {
  return assignmentDecisionRepository.create({
    runId,
    ticketId: decisionLog.ticketId,
    externalId: decisionLog.externalId,
    ticketType: decisionLog.ticketType,
    ticketStatus: decisionLog.ticketStatus,
    ticketPriority: decisionLog.ticketPriority,
    ticketSite: decisionLog.ticketSite,
    result: decisionLog.result,
    assignedWorkerId: decisionLog.assignedWorkerId,
    assignedWorkerName: decisionLog.assignedWorkerName,
    selectionReason: decisionLog.selectionReason,
    shortReason: decisionLog.shortReason,
    rulePath: decisionLog.rulePath,
    initialCandidates: decisionLog.initialCandidates,
    excludedCandidates: decisionLog.excludedCandidates,
    remainingCandidates: decisionLog.remainingCandidates,
    normalizationWarnings: decisionLog.normalizationWarnings,
    normalizedTicket: decisionLog.normalizedTicket,
    rawTicket: decisionLog.rawTicket,
    errorMessage: decisionLog.errorMessage,
  });
}

/**
 * Update the rotation state after an assignment.
 */
export async function persistWorkerRotation(site, workerId) {
  return assignmentRotationRepository.update(site || '_global', workerId);
}

/**
 * In live mode: apply actual ticket assignment.
 * In Phase 1 (shadow): this is a no-op.
 */
export async function applyLiveAssignment(ticket, worker, mode) {
  if (mode !== 'live') {
    // Shadow mode — no live side effect
    return { applied: false, reason: 'Shadow mode — no live assignment' };
  }

  // Phase 1: Even in live mode, we do NOT write to the production ticket system.
  // This placeholder ensures the architecture is ready for Phase 2.
  console.warn(`[ASSIGNMENT] Live assignment requested for ticket ${ticket.id} -> worker ${worker.name}, but Phase 1 does not apply live assignments.`);
  return { applied: false, reason: 'Phase 1 — live assignment not implemented yet' };
}
