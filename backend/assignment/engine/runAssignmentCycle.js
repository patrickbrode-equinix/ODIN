/* ================================================ */
/* Assignment Engine — Run Assignment Cycle         */
/* ================================================ */

import pool from '../../db.js';
import { assignmentRunRepository } from '../repositories/index.js';
import { assignmentSettingsService } from '../services/index.js';
import { normalizeTicket } from '../normalization/normalizeTicket.js';
import { checkRelevance } from '../relevance/checkRelevance.js';
import { sortTickets } from '../priority/sortAndSelect.js';
import { loadCandidateWorkers, buildCandidatePool, loadWorkerCurrentTickets, loadLastCrawlerTimestamp, loadExclusionList } from '../candidates/loadCandidates.js';
import { processTicket } from './processTicket.js';
import { persistAssignmentRun } from '../persistence/persist.js';
import { buildRunSummary } from '../logging/decisionLog.js';
import { checkCrawlerFreshness } from '../rules/crawlerGuard.js';
import { routeHandover } from '../rules/handoverRouter.js';
import { AssignmentError } from '../errors.js';
import { CRAWLER_MAX_AGE_MS } from '../constants.js';

/**
 * Run a complete assignment cycle.
 *
 * Full pipeline:
 *   1.  Create run record
 *   2.  Load settings
 *   3.  CRAWLER STALENESS CHECK (global safety rule)
 *   4.  Load raw tickets
 *   5.  Normalize tickets (incl. handover type, system name, scheduled)
 *   6.  Route handovers (Terminated → Scheduled)
 *   7.  Filter by relevance
 *   8.  Sort by spec priority tiers
 *   9.  Load candidate workers + current workloads
 *   10. Load exclusion list
 *   11. Process each ticket
 *   12. Finalize run
 *
 * Supports ENGINE_MODES: shadow, live, dry-run
 *
 * @param {object} options
 * @param {string} options.triggeredBy - Who triggered this run
 * @param {string} [options.modeOverride] - Override mode
 * @returns {object} Run summary
 */
export async function runAssignmentCycle({ triggeredBy, modeOverride } = {}) {
  let run = null;
  const decisions = [];

  try {
    // 1. Load settings
    const settings = await assignmentSettingsService.getEngineConfig();
    const mode = modeOverride || settings.mode;

    // Live mode safety: only allow if explicitly enabled
    if (mode === 'live') {
      const liveEnabled = settings.enableLiveMode === 'true' || settings.enableLiveMode === true;
      if (!liveEnabled) {
        throw new AssignmentError('Live mode is not enabled. Set assignment.enableLiveMode = true to activate.');
      }
    }

    // 2. Create run
    run = await assignmentRunRepository.create({ mode, triggeredBy: triggeredBy || 'system' });
    console.log(`[ASSIGNMENT] Run #${run.id} started (mode: ${mode}, triggered by: ${triggeredBy || 'system'})`);

    // 3. CRAWLER STALENESS CHECK — Global Safety Rule
    const lastCrawlerTimestamp = await loadLastCrawlerTimestamp();
    const maxAgeMs = (parseInt(settings.crawlerMaxAgeMinutes) || 10) * 60 * 1000;
    const freshness = checkCrawlerFreshness(lastCrawlerTimestamp, Date.now(), maxAgeMs);

    if (!freshness.fresh) {
      console.warn(`[ASSIGNMENT] CRAWLER STALE: ${freshness.reason}`);
      decisions.push({
        ticketId: '_crawler_guard',
        result: 'crawler_stale',
        shortReason: freshness.reason,
      });
      await persistAssignmentRun(run.id, decisions, 'failed');
      return {
        runId: run.id,
        mode,
        status: 'failed',
        crawlerStale: true,
        crawlerReason: freshness.reason,
        totalTickets: 0,
        decisions,
        summary: buildRunSummary(decisions),
      };
    }

    // 4. Load raw tickets from queue_items
    const { rows: rawTickets } = await pool.query(`
      SELECT * FROM queue_items
      WHERE active = true
      ORDER BY id
      LIMIT $1
    `, [parseInt(settings.maxTicketsPerRun) || 500]);

    console.log(`[ASSIGNMENT] Loaded ${rawTickets.length} raw tickets`);

    if (rawTickets.length === 0) {
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

    // 5. Normalize tickets
    const normalized = rawTickets.map(raw => normalizeTicket(raw));

    // 6. Route handovers: Terminated → Scheduled type
    const routed = normalized.map(ticket => {
      const hr = routeHandover(ticket);
      if (hr.action === 'scheduled') {
        return { ...ticket, type: 'Scheduled', _handoverOverride: true };
      }
      return ticket;
    });

    // 7. Filter by relevance (keep not-relevant for logging)
    const relevant = [];
    const notRelevant = [];
    for (const ticket of routed) {
      const rel = checkRelevance(ticket, settings);
      if (rel.relevant) {
        relevant.push(ticket);
      } else {
        notRelevant.push({ ticket, reason: rel.reason });
      }
    }

    console.log(`[ASSIGNMENT] ${relevant.length} relevant, ${notRelevant.length} not relevant`);

    // 8. Sort relevant tickets by spec priority tiers
    const sorted = sortTickets(relevant);

    // 9. Load candidate workers + current workloads
    const allWorkers = await loadCandidateWorkers();
    const candidatePool = buildCandidatePool(allWorkers);
    const workerTicketsMap = await loadWorkerCurrentTickets(candidatePool);

    console.log(`[ASSIGNMENT] ${allWorkers.length} workers loaded, ${candidatePool.length} in candidate pool`);

    // 10. Load exclusion list
    const exclusionList = await loadExclusionList();

    // 11. Process each ticket
    // First, log not-relevant tickets
    for (const { ticket, reason } of notRelevant) {
      decisions.push({
        ticketId: ticket.id,
        result: 'not_relevant',
        shortReason: reason,
      });
    }

    // Process relevant tickets in priority order
    const stopOnError = settings.stopOnCriticalError === 'true';
    for (const ticket of sorted) {
      try {
        const decision = await processTicket(ticket, candidatePool, settings, run.id, workerTicketsMap, exclusionList);
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

    // 12. Finalize run
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
