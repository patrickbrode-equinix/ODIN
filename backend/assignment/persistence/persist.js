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
 * In live mode: apply actual ticket assignment in the DB.
 * In shadow mode: this is a no-op — only logs decisions.
 */
export async function applyLiveAssignment(ticket, worker, mode) {
  if (mode !== 'live') {
    return { applied: false, reason: `${mode} mode — no live assignment written` };
  }

  try {
    // Import pool lazily to avoid circular deps
    const { default: pool } = await import('../../db.js');

    // Update the queue_items row to record the assignment
    await pool.query(
      `UPDATE queue_items
       SET assigned_worker_id = $1, assigned_at = NOW(), owner = $2, updated_at = NOW()
       WHERE id = $3 OR external_id = $3`,
      [worker.id, worker.name, ticket.id]
    );

    console.log(`[ASSIGNMENT] LIVE: Ticket ${ticket.id} assigned to ${worker.name} (ID: ${worker.id})`);
    return { applied: true, reason: `Live assignment: ${ticket.id} → ${worker.name}` };
  } catch (err) {
    console.error(`[ASSIGNMENT] LIVE assignment failed for ticket ${ticket.id}:`, err.message);
    return { applied: false, reason: `Live assignment failed: ${err.message}` };
  }
}
