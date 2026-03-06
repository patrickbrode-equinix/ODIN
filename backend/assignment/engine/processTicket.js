/* ================================================ */
/* Assignment Engine — Process Single Ticket        */
/* ================================================ */

import { validateNormalizedTicket } from '../normalization/normalizeTicket.js';
import { checkRelevance } from '../relevance/checkRelevance.js';
import { applyEligibilityRules } from '../eligibility/rules.js';
import { selectWorker } from '../priority/sortAndSelect.js';
import { buildDecisionLog } from '../logging/decisionLog.js';
import { persistTicketDecision, persistWorkerRotation, applyLiveAssignment } from '../persistence/persist.js';
import { assignmentOverrideRepository, assignmentRotationRepository } from '../repositories/index.js';
import { AssignmentError } from '../errors.js';

/**
 * Process a single normalized ticket through the assignment pipeline.
 *
 * Steps:
 * 1. Validate
 * 2. Check relevance
 * 3. Check overrides
 * 4. Load candidates (passed in)
 * 5. Apply eligibility rules
 * 6. Select worker
 * 7. Build decision log
 * 8. Persist
 *
 * @param {object} ticket - NormalizedTicket
 * @param {object[]} candidatePool - Pre-loaded candidate workers
 * @param {object} settings - Engine config
 * @param {number} runId - Current run ID
 * @returns {object} Decision log
 */
export async function processTicket(ticket, candidatePool, settings, runId) {
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

    // 3. Check overrides
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

    // Unknown type => manual_review
    if (ticket.type === 'Unknown') {
      const log = buildDecisionLog({
        ticket,
        result: 'manual_review',
        assignedWorker: null,
        selectionReason: `Unknown ticket type "${ticket.rawType}" — cannot auto-assign`,
        rulePath: ['relevance', 'type-check'],
        initialCandidates: candidatePool.map(c => ({ id: c.id, name: c.name })),
        excludedCandidates: [],
        remainingCandidates: [],
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // 4. Candidates already in candidatePool
    const initialCandidates = [...candidatePool];

    if (initialCandidates.length === 0) {
      const log = buildDecisionLog({
        ticket,
        result: 'no_candidate',
        assignedWorker: null,
        selectionReason: 'No candidate workers available',
        rulePath: ['relevance', 'candidates'],
        initialCandidates: [],
        excludedCandidates: [],
        remainingCandidates: [],
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // 5. Apply eligibility rules
    const excludedCandidates = [];
    const eligibleCandidates = [];
    const allRulesChecked = [];

    for (const worker of initialCandidates) {
      const result = applyEligibilityRules(worker, ticket, settings);
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
    const rulePath = ['relevance', 'override-check', 'type-check', 'eligibility', ...new Set(allRulesChecked)];

    if (eligibleCandidates.length === 0) {
      const log = buildDecisionLog({
        ticket,
        result: 'no_candidate',
        assignedWorker: null,
        selectionReason: 'All candidates were excluded by eligibility rules',
        rulePath,
        initialCandidates,
        excludedCandidates,
        remainingCandidates: [],
      });
      await persistTicketDecision(runId, log);
      return log;
    }

    // 6. Select worker
    const rotationSite = ticket.site || '_global';
    const rotationState = await assignmentRotationRepository.getForSite(rotationSite);

    const selection = selectWorker(eligibleCandidates, ticket, settings, rotationState);

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

    // 7. Build decision
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

    // 8. Persist decision
    await persistTicketDecision(runId, log);

    // Update rotation state
    await persistWorkerRotation(rotationSite, selection.worker.id);

    // Apply live assignment (no-op in shadow mode)
    await applyLiveAssignment(ticket, selection.worker, settings.mode);

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
