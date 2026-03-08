/* ================================================ */
/* Assignment Engine — Process Single Ticket        */
/* ================================================ */

import { validateNormalizedTicket } from '../normalization/normalizeTicket.js';
import { checkRelevance } from '../relevance/checkRelevance.js';
import { applyEligibilityRules } from '../eligibility/rules.js';
import { selectWorker } from '../priority/sortAndSelect.js';
import { buildDecisionLog } from '../logging/decisionLog.js';
import { persistTicketDecision, persistWorkerRotation, applyLiveAssignment } from '../persistence/persist.js';
import { assignmentOverrideRepository } from '../repositories/index.js';
import { checkExclusionList } from '../rules/exclusionList.js';
import { routeHandover } from '../rules/handoverRouter.js';
import { analyticsTracker } from '../analytics/tracker.js';

/**
 * Process a single normalized ticket through the full assignment pipeline.
 *
 * Steps:
 *   1. Validate normalized ticket
 *   2. Check relevance
 *   3. Check manual overrides
 *   4. Check exclusion list (system name)
 *   5. Route handover (Workload/Terminated/OtherTeams)
 *   6. Apply eligibility rules (incl. role filter, queue purity)
 *   7. Select worker (system grouping → purity → workload → ID)
 *   8. Build decision log
 *   9. Persist decision + analytics
 *
 * @param {object}  ticket           - NormalizedTicket
 * @param {object[]} candidatePool   - Pre-loaded candidate workers
 * @param {object}  settings         - Engine config
 * @param {number}  runId            - Current run ID
 * @param {Map}     workerTicketsMap - Map<workerId, ticket[]> of current assignments
 * @param {string[]} exclusionList   - System names to exclude
 * @returns {object} Decision log
 */
export async function processTicket(ticket, candidatePool, settings, runId, workerTicketsMap = new Map(), exclusionList = []) {
  const now = Date.now();
  const insufficientResources = settings.insufficientResources === 'true' || settings.insufficientResources === true;

  try {
    // 1. Validate
    const validationIssues = validateNormalizedTicket(ticket);
    if (validationIssues.length > 0) {
      const log = buildDecisionLog({
        ticket,
        result: 'manual_review',
        assignedWorker: null,
        selectionReason: `Validation issues: ${validationIssues.join('; ')}`,
        rulePath: ['validate'],
        initialCandidates: [],
        excludedCandidates: [],
        remainingCandidates: [],
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // 2. Relevance check
    const relevance = checkRelevance(ticket, settings);
    if (!relevance.relevant) {
      const log = buildDecisionLog({
        ticket,
        result: 'not_relevant',
        assignedWorker: null,
        selectionReason: relevance.reason,
        rulePath: ['relevance'],
        initialCandidates: [],
        excludedCandidates: [],
        remainingCandidates: [],
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // 3. Check manual overrides
    const overrides = await assignmentOverrideRepository.findActive(ticket.id);
    if (overrides.length > 0) {
      const override = overrides[0];
      if (override.override_type === 'force_block') {
        const log = buildDecisionLog({
          ticket,
          result: 'blocked',
          assignedWorker: null,
          selectionReason: `Manual override: ${override.reason || 'blocked by operator'}`,
          rulePath: ['relevance', 'override'],
          initialCandidates: [],
          excludedCandidates: [],
          remainingCandidates: [],
        });
        await persistTicketDecision(runId, log);
        return log;
      }
      if (override.override_type === 'force_manual') {
        const log = buildDecisionLog({
          ticket,
          result: 'manual_review',
          assignedWorker: null,
          selectionReason: `Manual override: ${override.reason || 'forced to manual review'}`,
          rulePath: ['relevance', 'override'],
          initialCandidates: [],
          excludedCandidates: [],
          remainingCandidates: [],
        });
        await persistTicketDecision(runId, log);
        return log;
      }
      // force_assign is handled below after eligibility
    }

    // 4. Check exclusion list (system name)
    const exclusionResult = checkExclusionList(ticket, exclusionList);
    if (exclusionResult.excluded) {
      const log = buildDecisionLog({
        ticket,
        result: 'manual_review',
        assignedWorker: null,
        selectionReason: exclusionResult.reason,
        rulePath: ['relevance', 'override-check', 'exclusion-list'],
        initialCandidates: [],
        excludedCandidates: [],
        remainingCandidates: [],
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // 5. Route handover type
    const handoverResult = routeHandover(ticket);
    if (handoverResult.action === 'manual_review') {
      const log = buildDecisionLog({
        ticket,
        result: 'manual_review',
        assignedWorker: null,
        selectionReason: handoverResult.reason,
        rulePath: ['relevance', 'override-check', 'exclusion-list', 'handover-routing'],
        initialCandidates: [],
        excludedCandidates: [],
        remainingCandidates: [],
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // Apply handover effect: Terminated → treat as Scheduled
    if (handoverResult.action === 'scheduled') {
      ticket = { ...ticket, type: 'Scheduled', _handoverOverride: true };
    }

    // Unknown type => manual_review
    if (ticket.type === 'Unknown') {
      const log = buildDecisionLog({
        ticket,
        result: 'manual_review',
        assignedWorker: null,
        selectionReason: `Unknown ticket type "${ticket.rawType}" — cannot auto-assign`,
        rulePath: ['relevance', 'override-check', 'exclusion-list', 'handover-routing', 'type-check'],
        initialCandidates: candidatePool.map(c => ({ id: c.id, name: c.name })),
        excludedCandidates: [],
        remainingCandidates: [],
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // 6. Candidates
    const initialCandidates = [...candidatePool];

    if (initialCandidates.length === 0) {
      const log = buildDecisionLog({
        ticket,
        result: 'no_candidate',
        assignedWorker: null,
        selectionReason: 'No candidate workers available',
        rulePath: ['relevance', 'override-check', 'exclusion-list', 'handover-routing', 'type-check', 'candidates'],
        initialCandidates: [],
        excludedCandidates: [],
        remainingCandidates: [],
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // 7. Apply eligibility rules (includes role filter + queue purity)
    const excludedCandidates = [];
    const eligibleCandidates = [];
    const allRulesChecked = [];

    for (const worker of initialCandidates) {
      const workerTickets = workerTicketsMap.get(worker.id) || [];
      const result = applyEligibilityRules(worker, ticket, settings, workerTickets, insufficientResources, now);
      allRulesChecked.push(...result.checkedRules);
      if (result.eligible) {
        eligibleCandidates.push(worker);
      } else {
        for (const excl of result.exclusions) {
          excludedCandidates.push({ id: worker.id, name: worker.name, reason: excl.reason, rule: excl.rule });
        }
      }
    }

    // Deduplicate rule names
    const rulePath = [
      'relevance', 'override-check', 'exclusion-list', 'handover-routing', 'type-check',
      'eligibility', ...new Set(allRulesChecked),
    ];

    if (eligibleCandidates.length === 0) {
      const log = buildDecisionLog({
        ticket,
        result: 'manual_review',
        assignedWorker: null,
        selectionReason: 'All candidates were excluded by eligibility rules — manual review required',
        rulePath,
        initialCandidates,
        excludedCandidates,
        remainingCandidates: [],
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // 8. Select worker using spec tie-breaking
    const selection = selectWorker(eligibleCandidates, ticket, settings, workerTicketsMap, insufficientResources, now);

    if (!selection.worker) {
      const log = buildDecisionLog({
        ticket,
        result: 'manual_review',
        assignedWorker: null,
        selectionReason: selection.reason || 'Could not determine a unique worker',
        rulePath: [...rulePath, 'worker-selection'],
        initialCandidates,
        excludedCandidates,
        remainingCandidates: eligibleCandidates,
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // 9. Build decision
    const finalRulePath = [...rulePath, 'worker-selection'];
    if (selection.tieBreaker) finalRulePath.push(`tie-breaker:${selection.tieBreaker}`);

    const log = buildDecisionLog({
      ticket,
      result: 'assigned',
      assignedWorker: selection.worker,
      selectionReason: selection.reason,
      rulePath: finalRulePath,
      initialCandidates,
      excludedCandidates,
      remainingCandidates: eligibleCandidates,
    });

    // Persist decision
    await persistTicketDecision(runId, log);

    // Update worker's ticket map (so subsequent tickets see this assignment)
    const workerTickets = workerTicketsMap.get(selection.worker.id) || [];
    workerTickets.push({
      id: ticket.id,
      externalId: ticket.externalId,
      type: ticket.type,
      systemName: ticket.systemName,
      dueAt: ticket.dueAt,
      scheduledStart: ticket.scheduledStart,
    });
    workerTicketsMap.set(selection.worker.id, workerTickets);

    // Apply live assignment (no-op in shadow mode)
    await applyLiveAssignment(ticket, selection.worker, settings.mode);

    // Track analytics
    try {
      await analyticsTracker.trackAssignment({
        ticketId: ticket.id,
        workerId: selection.worker.id,
        workerName: selection.worker.name,
        ticketType: ticket.type,
        result: 'assigned',
      });
    } catch (_) { /* best effort */ }

    return log;

  } catch (err) {
    console.error(`[ASSIGNMENT] Error processing ticket ${ticket?.id}:`, err.message);
    const log = buildDecisionLog({
      ticket: ticket || { id: 'unknown', normalizationWarnings: [], raw: {} },
      result: 'error',
      assignedWorker: null,
      selectionReason: null,
      rulePath: ['error'],
      initialCandidates: [],
      excludedCandidates: [],
      remainingCandidates: [],
      errorMessage: err.message,
    });
    try { await persistTicketDecision(runId, log); } catch (_) { /* best effort */ }
    return log;
  }
}
