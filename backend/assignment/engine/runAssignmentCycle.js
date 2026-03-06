/* ================================================ */
/* Assignment Engine — Run Assignment Cycle         */
/* ================================================ */

import pool from '../../db.js';
import { assignmentRunRepository } from '../repositories/index.js';
import { assignmentSettingsService } from '../services/index.js';
import { normalizeTicket } from '../normalization/normalizeTicket.js';
import { checkRelevance } from '../relevance/checkRelevance.js';
import { sortTickets } from '../priority/sortAndSelect.js';
import { loadCandidateWorkers, buildCandidatePool } from '../candidates/loadCandidates.js';
import { processTicket } from './processTicket.js';
import { persistAssignmentRun } from '../persistence/persist.js';
import { buildRunSummary } from '../logging/decisionLog.js';
import { AssignmentError } from '../errors.js';

/**
 * Run a complete assignment cycle.
 *
 * Pipeline:
 * 1. Create run record
 * 2. Load settings
 * 3. Load raw tickets
 * 4. Normalize tickets
 * 5. Filter by relevance
 * 6. Sort by priority
 * 7. Load candidate workers
 * 8. Process each ticket
 * 9. Finalize run
 *
 * @param {object} options
 * @param {string} options.triggeredBy - Who triggered this run
 * @param {string} [options.modeOverride] - Override mode (e.g., 'dry-run')
 * @returns {object} Run summary
 */
export async function runAssignmentCycle({ triggeredBy, modeOverride } = {}) {
  let run = null;
  const decisions = [];

  try {
    // 1. Load settings
    const settings = await assignmentSettingsService.getEngineConfig();
    const mode = modeOverride || settings.mode;

    // Phase 1 safety: never allow live mode
    if (mode === 'live') {
      throw new AssignmentError('Live mode is not available in Phase 1');
    }

    // 2. Create run
    run = await assignmentRunRepository.create({ mode, triggeredBy: triggeredBy || 'system' });
    console.log(`[ASSIGNMENT] Run #${run.id} started (mode: ${mode}, triggered by: ${triggeredBy || 'system'})`);

    // 3. Load raw tickets from queue_items
    const { rows: rawTickets } = await pool.query(`
      SELECT * FROM queue_items
      WHERE active = true
      ORDER BY id
      LIMIT $1
    `, [parseInt(settings.maxTicketsPerRun) || 500]);

    console.log(`[ASSIGNMENT] Loaded ${rawTickets.length} raw tickets`);

    if (rawTickets.length === 0) {
      // No tickets to process
      await persistAssignmentRun(run.id, [], 'completed');
      return {
        runId: run.id,
        mode,
        status: 'completed',
        totalTickets: 0,
        decisions: [],
        summary: buildRunSummary([]),
      };
    }

    // 4. Normalize tickets
    const normalized = rawTickets.map(raw => normalizeTicket(raw));

    // 5. Filter by relevance (but keep not-relevant for logging)
    const relevant = [];
    const notRelevant = [];
    for (const ticket of normalized) {
      const rel = checkRelevance(ticket, settings);
      if (rel.relevant) {
        relevant.push(ticket);
      } else {
        notRelevant.push({ ticket, reason: rel.reason });
      }
    }

    console.log(`[ASSIGNMENT] ${relevant.length} relevant, ${notRelevant.length} not relevant`);

    // 6. Sort relevant tickets by priority
    const sorted = sortTickets(relevant);

    // 7. Load candidate workers
    const allWorkers = await loadCandidateWorkers();
    const candidatePool = buildCandidatePool(allWorkers);

    console.log(`[ASSIGNMENT] ${allWorkers.length} workers loaded, ${candidatePool.length} in candidate pool`);

    // 8. Process each ticket
    // First, log not-relevant tickets
    for (const { ticket, reason } of notRelevant) {
      decisions.push({
        ticketId: ticket.id,
        result: 'not_relevant',
        shortReason: reason,
      });
    }

    // Process relevant tickets
    const stopOnError = settings.stopOnCriticalError === 'true';
    for (const ticket of sorted) {
      try {
        const decision = await processTicket(ticket, candidatePool, settings, run.id);
        decisions.push(decision);
      } catch (err) {
        console.error(`[ASSIGNMENT] Critical error processing ticket ${ticket.id}:`, err.message);
        decisions.push({ ticketId: ticket.id, result: 'error', errorMessage: err.message });
        if (stopOnError) {
          console.warn(`[ASSIGNMENT] Stopping run due to stopOnCriticalError`);
          break;
        }
      }
    }

    // 9. Finalize run
    const summary = buildRunSummary(decisions);
    await persistAssignmentRun(run.id, decisions, 'completed');

    console.log(`[ASSIGNMENT] Run #${run.id} completed: ${JSON.stringify(summary)}`);

    return {
      runId: run.id,
      mode,
      status: 'completed',
      totalTickets: rawTickets.length,
      relevantTickets: relevant.length,
      decisions,
      summary,
    };

  } catch (err) {
    console.error(`[ASSIGNMENT] Run failed:`, err.message);
    if (run) {
      try {
        await persistAssignmentRun(run.id, decisions, 'failed');
      } catch (_) { /* best effort */ }
    }
    throw err;
  }
}
