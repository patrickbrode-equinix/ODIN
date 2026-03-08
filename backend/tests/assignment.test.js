/* ================================================ */
/* Assignment Engine — Unit Tests                   */
/* ================================================ */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Normalization
import {
  mapType, mapStatus, mapPriority, mapSite, mapDates,
  mapResponsibility, mapTicketId, normalizeTicket, validateNormalizedTicket,
  mapHandoverType, mapScheduledStart, mapSystemName,
} from '../assignment/normalization/normalizeTicket.js';

// Relevance
import { checkRelevance } from '../assignment/relevance/checkRelevance.js';

// Eligibility
import {
  isWorkerAutoAssignable, isAvailable, isNotOnBreak, isNotAbsent,
  isShiftActive, matchesSite, matchesResponsibility, applyEligibilityRules,
  checkRole, checkQueueClean,
} from '../assignment/eligibility/rules.js';

// Priority / Selection
import { sortTickets, selectWorker, resolveWorkerTie, getPriorityTier } from '../assignment/priority/sortAndSelect.js';

// Logging
import { buildDecisionLog, buildRunSummary, buildTicketExplanation } from '../assignment/logging/decisionLog.js';

// V2 Rules
import { checkCrawlerFreshness } from '../assignment/rules/crawlerGuard.js';
import { applyRoleFilter } from '../assignment/rules/roleFilter.js';
import { checkExclusionList } from '../assignment/rules/exclusionList.js';
import { routeHandover } from '../assignment/rules/handoverRouter.js';
import { checkQueuePurity } from '../assignment/rules/queuePurity.js';
import { evaluateSystemGrouping } from '../assignment/rules/systemGrouping.js';
import { PRIORITY_TIERS, CRAWLER_MAX_AGE_MS } from '../assignment/constants.js';

/* ================================================ */
/* mapType                                          */
/* ================================================ */
describe('mapType', () => {
  it('maps "troubleticket" -> TroubleTicket', () => {
    const r = mapType('troubleticket');
    assert.equal(r.value, 'TroubleTicket');
    assert.equal(r.warning, null);
  });
  it('maps "TT" -> TroubleTicket', () => {
    assert.equal(mapType('TT').value, 'TroubleTicket');
  });
  it('maps "SmartHands" -> SmartHands', () => {
    assert.equal(mapType('SmartHands').value, 'SmartHands');
  });
  it('maps "crossconnect" -> CrossConnect', () => {
    assert.equal(mapType('crossconnect').value, 'CrossConnect');
  });
  it('maps "xc" -> CrossConnect', () => {
    assert.equal(mapType('xc').value, 'CrossConnect');
  });
  it('maps "other" -> Other', () => {
    assert.equal(mapType('other').value, 'Other');
  });
  it('returns Unknown for unknown types', () => {
    const r = mapType('foobar');
    assert.equal(r.value, 'Unknown');
    assert.ok(r.warning);
  });
  it('returns Unknown with warning for null', () => {
    const r = mapType(null);
    assert.equal(r.value, 'Unknown');
    assert.ok(r.warning);
  });
});

/* ================================================ */
/* mapStatus                                        */
/* ================================================ */
describe('mapStatus', () => {
  it('maps "open" -> open', () => {
    assert.equal(mapStatus('open').value, 'open');
  });
  it('maps "new" -> open', () => {
    assert.equal(mapStatus('new').value, 'open');
  });
  it('maps "in progress" -> active', () => {
    assert.equal(mapStatus('in progress').value, 'active');
  });
  it('maps "resolved" -> closed', () => {
    assert.equal(mapStatus('resolved').value, 'closed');
  });
  it('maps "canceled" -> cancelled', () => {
    assert.equal(mapStatus('canceled').value, 'cancelled');
  });
  it('returns unknown for null', () => {
    assert.equal(mapStatus(null).value, 'unknown');
  });
  it('returns unknown for unexpected value', () => {
    const r = mapStatus('xyz');
    assert.equal(r.value, 'unknown');
    assert.ok(r.warning);
  });
});

/* ================================================ */
/* mapPriority                                      */
/* ================================================ */
describe('mapPriority', () => {
  it('maps "critical" -> critical', () => {
    assert.equal(mapPriority('critical').value, 'critical');
  });
  it('maps "P1" -> critical', () => {
    assert.equal(mapPriority('P1').value, 'critical');
  });
  it('maps "normal" -> medium', () => {
    assert.equal(mapPriority('normal').value, 'medium');
  });
  it('maps "urgent" -> high', () => {
    assert.equal(mapPriority('urgent').value, 'high');
  });
  it('returns unknown for null', () => {
    assert.equal(mapPriority(null).value, 'unknown');
  });
});

/* ================================================ */
/* mapSite                                          */
/* ================================================ */
describe('mapSite', () => {
  it('returns trimmed site', () => {
    assert.equal(mapSite('  FR2  ').value, 'FR2');
  });
  it('returns null for empty', () => {
    const r = mapSite('');
    assert.equal(r.value, null);
  });
  it('returns null for null', () => {
    const r = mapSite(null);
    assert.equal(r.value, null);
  });
});

/* ================================================ */
/* mapDates                                         */
/* ================================================ */
describe('mapDates', () => {
  it('parses valid dates', () => {
    const r = mapDates('2026-03-01T10:00:00Z', '2026-02-28T08:00:00Z');
    assert.ok(r.dueAt);
    assert.ok(r.createdAt);
    assert.equal(r.warnings.length, 0);
  });
  it('returns null for invalid dueAt with warning', () => {
    const r = mapDates('not-a-date', null);
    assert.equal(r.dueAt, null);
    assert.equal(r.warnings.length, 1);
  });
});

/* ================================================ */
/* normalizeTicket                                  */
/* ================================================ */
describe('normalizeTicket', () => {
  it('normalizes a standard ticket', () => {
    const nt = normalizeTicket({
      id: 42,
      type: 'TroubleTicket',
      status: 'open',
      priority: 'high',
      site: 'FR2',
      due_at: '2026-03-10T12:00:00Z',
      created_at: '2026-03-01T08:00:00Z',
    });
    assert.equal(nt.id, '42');
    assert.equal(nt.type, 'TroubleTicket');
    assert.equal(nt.status, 'open');
    assert.equal(nt.priority, 'high');
    assert.equal(nt.site, 'FR2');
    assert.equal(nt.manualHold, false);
    assert.equal(nt.autoAssignable, true);
  });

  it('captures warnings for unknown fields', () => {
    const nt = normalizeTicket({ id: 1, type: 'foobar', status: 'xyz' });
    assert.ok(nt.normalizationWarnings.length > 0);
    assert.equal(nt.type, 'Unknown');
    assert.equal(nt.status, 'unknown');
  });

  it('preserves raw data', () => {
    const raw = { id: 99, custom: 'value' };
    const nt = normalizeTicket(raw);
    assert.equal(nt.raw, raw);
  });
});

/* ================================================ */
/* validateNormalizedTicket                          */
/* ================================================ */
describe('validateNormalizedTicket', () => {
  it('returns no issues for valid ticket', () => {
    const issues = validateNormalizedTicket({
      id: '1', type: 'TroubleTicket', status: 'open',
      rawType: 'TroubleTicket', rawStatus: 'open'
    });
    assert.equal(issues.length, 0);
  });

  it('returns issues for missing ID', () => {
    const issues = validateNormalizedTicket({ id: '', type: 'TroubleTicket', status: 'open' });
    assert.ok(issues.length > 0);
  });
});

/* ================================================ */
/* checkRelevance                                   */
/* ================================================ */
describe('checkRelevance', () => {
  it('marks open tickets as relevant', () => {
    const r = checkRelevance({ id: '1', status: 'open', type: 'TroubleTicket', manualHold: false, autoAssignable: true });
    assert.equal(r.relevant, true);
  });

  it('marks closed tickets as not relevant', () => {
    const r = checkRelevance({ id: '1', status: 'closed', type: 'TroubleTicket', manualHold: false, autoAssignable: true });
    assert.equal(r.relevant, false);
  });

  it('marks cancelled tickets as not relevant', () => {
    const r = checkRelevance({ id: '1', status: 'cancelled', type: 'TroubleTicket', manualHold: false, autoAssignable: true });
    assert.equal(r.relevant, false);
  });

  it('marks manual hold tickets as not relevant', () => {
    const r = checkRelevance({ id: '1', status: 'open', type: 'TroubleTicket', manualHold: true, autoAssignable: true });
    assert.equal(r.relevant, false);
  });

  it('marks non-auto-assignable as not relevant', () => {
    const r = checkRelevance({ id: '1', status: 'open', type: 'TroubleTicket', manualHold: false, autoAssignable: false });
    assert.equal(r.relevant, false);
  });

  it('marks Unknown type as relevant (for manual_review)', () => {
    const r = checkRelevance({ id: '1', status: 'active', type: 'Unknown', manualHold: false, autoAssignable: true });
    assert.equal(r.relevant, true);
  });

  it('respects planning window', () => {
    const futureDate = new Date(Date.now() + 100 * 60 * 60 * 1000).toISOString(); // 100h from now
    const r = checkRelevance(
      { id: '1', status: 'open', type: 'TroubleTicket', manualHold: false, autoAssignable: true, dueAt: futureDate },
      { planningWindowHours: '72' }
    );
    assert.equal(r.relevant, false);
  });
});

/* ================================================ */
/* Eligibility Rules                                */
/* ================================================ */
describe('Eligibility Rules', () => {
  const baseWorker = { id: 1, name: 'Test', autoAssignable: true, blocked: false, onBreak: false, absent: false, site: 'FR2', responsibility: 'c-ops' };
  const baseTicket = { id: '1', site: 'FR2', responsibility: 'c-ops', queue: 'c-ops' };
  const baseSettings = { siteStrictness: 'true', responsibilityStrictness: 'false' };

  it('isWorkerAutoAssignable passes for assignable worker', () => {
    assert.ok(isWorkerAutoAssignable(baseWorker).eligible);
  });
  it('isWorkerAutoAssignable fails for non-assignable', () => {
    assert.ok(!isWorkerAutoAssignable({ ...baseWorker, autoAssignable: false }).eligible);
  });
  it('isAvailable passes for non-blocked', () => {
    assert.ok(isAvailable(baseWorker).eligible);
  });
  it('isAvailable fails for blocked', () => {
    assert.ok(!isAvailable({ ...baseWorker, blocked: true }).eligible);
  });
  it('isNotOnBreak passes', () => {
    assert.ok(isNotOnBreak(baseWorker).eligible);
  });
  it('isNotOnBreak fails', () => {
    assert.ok(!isNotOnBreak({ ...baseWorker, onBreak: true }).eligible);
  });
  it('isNotAbsent passes', () => {
    assert.ok(isNotAbsent(baseWorker).eligible);
  });
  it('isNotAbsent fails', () => {
    assert.ok(!isNotAbsent({ ...baseWorker, absent: true }).eligible);
  });

  it('matchesSite passes when sites match', () => {
    assert.ok(matchesSite(baseWorker, baseTicket, baseSettings).eligible);
  });
  it('matchesSite fails when sites differ', () => {
    assert.ok(!matchesSite({ ...baseWorker, site: 'AM3' }, baseTicket, baseSettings).eligible);
  });
  it('matchesSite passes when strictness disabled', () => {
    assert.ok(matchesSite({ ...baseWorker, site: 'AM3' }, baseTicket, { siteStrictness: 'false' }).eligible);
  });

  it('matchesResponsibility passes when disabled', () => {
    assert.ok(matchesResponsibility(baseWorker, baseTicket, baseSettings).eligible);
  });
  it('matchesResponsibility works when enabled', () => {
    const s = { responsibilityStrictness: 'true' };
    assert.ok(matchesResponsibility(baseWorker, baseTicket, s).eligible);
    assert.ok(!matchesResponsibility({ ...baseWorker, responsibility: 'f-ops' }, baseTicket, s).eligible);
  });

  it('applyEligibilityRules returns eligible for good worker', () => {
    const r = applyEligibilityRules(baseWorker, baseTicket, baseSettings);
    assert.ok(r.eligible);
    assert.equal(r.exclusions.length, 0);
  });
  it('applyEligibilityRules returns exclusions for blocked worker', () => {
    const r = applyEligibilityRules({ ...baseWorker, blocked: true }, baseTicket, baseSettings);
    assert.ok(!r.eligible);
    assert.ok(r.exclusions.length > 0);
  });
});

/* ================================================ */
/* sortTickets                                      */
/* ================================================ */
describe('sortTickets', () => {
  it('sorts overdue tickets first', () => {
    const pastDue = new Date(Date.now() - 3600000).toISOString();
    const futureDue = new Date(Date.now() + 3600000).toISOString();
    const sorted = sortTickets([
      { id: 'A', priority: 'medium', type: 'SmartHands', dueAt: futureDue },
      { id: 'B', priority: 'medium', type: 'SmartHands', dueAt: pastDue },
    ]);
    assert.equal(sorted[0].id, 'B'); // overdue first
  });

  it('sorts SmartHands in same KPI tier regardless of internal priority', () => {
    // In V2, SmartHands are all tier 3 (KPI). Within tier, sort by remaining time then ID.
    const sorted = sortTickets([
      { id: 'A', priority: 'medium', type: 'SmartHands' },
      { id: 'B', priority: 'critical', type: 'SmartHands' },
    ]);
    // Without due dates, falls to ID comparison: 'A' < 'B'
    assert.equal(sorted[0].id, 'A');
  });

  it('sorts TroubleTicket before SmartHands at same priority', () => {
    const sorted = sortTickets([
      { id: 'A', priority: 'medium', type: 'SmartHands' },
      { id: 'B', priority: 'medium', type: 'TroubleTicket' },
    ]);
    assert.equal(sorted[0].id, 'B');
  });

  it('sorts CC and SH in same KPI tier — break by ID', () => {
    // In V2, both CrossConnect and SmartHands are tier 3 (KPI).
    // Without due dates, falls to ID comparison: 'A' < 'B'
    const sorted = sortTickets([
      { id: 'A', priority: 'medium', type: 'SmartHands' },
      { id: 'B', priority: 'medium', type: 'CrossConnect' },
    ]);
    assert.equal(sorted[0].id, 'A');
  });

  it('sorts older tickets first at equal rank', () => {
    const sorted = sortTickets([
      { id: 'A', priority: 'medium', type: 'SmartHands', createdAt: '2026-03-02T10:00:00Z' },
      { id: 'B', priority: 'medium', type: 'SmartHands', createdAt: '2026-03-01T10:00:00Z' },
    ]);
    assert.equal(sorted[0].id, 'B');
  });
});

/* ================================================ */
/* selectWorker                                     */
/* ================================================ */
describe('selectWorker', () => {
  it('returns null for empty candidates', () => {
    const r = selectWorker([], { site: 'FR2' }, {});
    assert.equal(r.worker, null);
  });

  it('returns only candidate when one', () => {
    const r = selectWorker([{ id: 1, name: 'A', site: 'FR2' }], { site: 'FR2' }, {});
    assert.equal(r.worker.id, 1);
  });

  it('uses lowest worker ID as final deterministic tie-breaker', () => {
    // In V2 selectWorker, tie-breaking is: system grouping → purity → workload → worker ID
    // With no current tickets, all scores equal → falls to lowest ID
    const r = selectWorker(
      [
        { id: 5, name: 'E' },
        { id: 3, name: 'C' },
      ],
      { type: 'TroubleTicket', systemName: null },
      {}
    );
    assert.equal(r.worker.id, 3); // lowest ID
  });

  it('prefers worker with lower workload', () => {
    const workerTicketsMap = new Map([
      [1, [{ type: 'SmartHands' }, { type: 'SmartHands' }]], // 2 tickets
      [2, [{ type: 'SmartHands' }]],                          // 1 ticket
    ]);
    const r = selectWorker(
      [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ],
      { type: 'SmartHands', systemName: null },
      {},
      workerTicketsMap
    );
    assert.equal(r.worker.id, 2); // fewer tickets
  });
});

/* ================================================ */
/* resolveWorkerTie                                 */
/* ================================================ */
describe('resolveWorkerTie (deprecated)', () => {
  it('always uses stable-id (lowest ID) in V2', () => {
    // resolveWorkerTie is now a deprecated legacy function that simply picks lowest ID
    const r = resolveWorkerTie(
      [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }],
      { enableRotationTieBreaker: 'true' },
      { last_assigned_worker_id: 1 },
      {}
    );
    assert.equal(r.worker.id, 1); // lowest ID — rotation no longer applies
  });

  it('returns lowest ID regardless of rotation state', () => {
    const r = resolveWorkerTie(
      [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      { enableRotationTieBreaker: 'true' },
      { last_assigned_worker_id: 2 },
      {}
    );
    assert.equal(r.worker.id, 1); // lowest ID
  });

  it('returns lowest ID with explicit stable-id setting', () => {
    const r = resolveWorkerTie(
      [{ id: 5, name: 'E' }, { id: 3, name: 'C' }],
      { enableRotationTieBreaker: 'false' },
      null,
      {}
    );
    assert.equal(r.worker.id, 3); // lowest ID
  });
});

/* ================================================ */
/* buildDecisionLog / buildRunSummary               */
/* ================================================ */
describe('buildDecisionLog', () => {
  it('builds a complete decision log', () => {
    const log = buildDecisionLog({
      ticket: { id: '42', type: 'TroubleTicket', status: 'open', priority: 'high', site: 'FR2', normalizationWarnings: [], raw: {} },
      result: 'assigned',
      assignedWorker: { id: 1, name: 'Marco D.' },
      selectionReason: 'Best match',
      rulePath: ['relevance', 'eligibility', 'worker-selection'],
      initialCandidates: [{ id: 1, name: 'Marco D.' }, { id: 2, name: 'Patrick A.' }],
      excludedCandidates: [{ id: 2, name: 'Patrick A.', reason: 'On break' }],
      remainingCandidates: [{ id: 1, name: 'Marco D.' }],
    });
    assert.equal(log.result, 'assigned');
    assert.equal(log.assignedWorkerId, 1);
    assert.equal(log.assignedWorkerName, 'Marco D.');
    assert.ok(log.shortReason.includes('Marco D.'));
    assert.equal(log.initialCandidates.length, 2);
    assert.equal(log.excludedCandidates.length, 1);
  });
});

describe('buildRunSummary', () => {
  it('counts result types correctly', () => {
    const summary = buildRunSummary([
      { result: 'assigned' },
      { result: 'assigned' },
      { result: 'manual_review' },
      { result: 'no_candidate' },
      { result: 'error' },
    ]);
    assert.equal(summary.totalDecisions, 5);
    assert.equal(summary.assigned, 2);
    assert.equal(summary.manual_review, 1);
    assert.equal(summary.no_candidate, 1);
    assert.equal(summary.error, 1);
  });
});

/* ================================================ */
/* buildTicketExplanation                           */
/* ================================================ */
describe('buildTicketExplanation', () => {
  it('builds markdown and structured explanation', () => {
    const decision = {
      ticket_id: '42',
      result: 'assigned',
      short_reason: 'Zugewiesen an Marco D.',
      ticket_type: 'TroubleTicket',
      ticket_status: 'open',
      ticket_priority: 'high',
      ticket_site: 'FR2',
      normalization_warnings: [],
      initial_candidates: [{ id: 1, name: 'Marco D.' }],
      excluded_candidates: [],
      remaining_candidates: [{ id: 1, name: 'Marco D.' }],
      assigned_worker_name: 'Marco D.',
      assigned_worker_id: 1,
      selection_reason: 'Only one eligible candidate',
      rule_path: ['relevance', 'eligibility', 'worker-selection'],
    };
    const exp = buildTicketExplanation(decision);
    assert.ok(exp.markdown.includes('Marco D.'));
    assert.equal(exp.structured.result, 'assigned');
    assert.equal(exp.structured.assignedWorkerName, 'Marco D.');
  });
});

/* ================================================================ */
/* V2 Rules — Crawler Guard                                         */
/* ================================================================ */
describe('Crawler Stale Protection', () => {
  const NOW = new Date('2026-03-08T12:00:00Z').getTime();

  it('rejects missing timestamp', () => {
    const r = checkCrawlerFreshness(null, NOW);
    assert.equal(r.fresh, false);
    assert.match(r.reason, /No crawler timestamp/);
  });

  it('rejects invalid timestamp', () => {
    const r = checkCrawlerFreshness('not-a-date', NOW);
    assert.equal(r.fresh, false);
    assert.match(r.reason, /Invalid/);
  });

  it('accepts fresh data (< 10 min)', () => {
    const fiveMin = new Date(NOW - 5 * 60 * 1000).toISOString();
    const r = checkCrawlerFreshness(fiveMin, NOW);
    assert.equal(r.fresh, true);
  });

  it('rejects stale data (> 10 min)', () => {
    const fifteenMin = new Date(NOW - 15 * 60 * 1000).toISOString();
    const r = checkCrawlerFreshness(fifteenMin, NOW);
    assert.equal(r.fresh, false);
    assert.match(r.reason, /15 minutes/);
  });

  it('rejects data exactly at boundary + 1s', () => {
    const overLimit = new Date(NOW - CRAWLER_MAX_AGE_MS - 1000).toISOString();
    const r = checkCrawlerFreshness(overLimit, NOW);
    assert.equal(r.fresh, false);
  });

  it('accepts data just under 10 min', () => {
    const justUnder = new Date(NOW - CRAWLER_MAX_AGE_MS + 1000).toISOString();
    const r = checkCrawlerFreshness(justUnder, NOW);
    assert.equal(r.fresh, true);
  });

  it('supports custom max age', () => {
    const fiveMin = new Date(NOW - 5 * 60 * 1000).toISOString();
    const r = checkCrawlerFreshness(fiveMin, NOW, 3 * 60 * 1000);
    assert.equal(r.fresh, false);
  });
});

/* ================================================================ */
/* V2 Rules — Role Filter                                           */
/* ================================================================ */
describe('Role Exclusions', () => {
  const NOW = new Date('2026-03-08T12:00:00Z').getTime();
  const ttTicket  = { type: 'TroubleTicket', priority: 'high', handoverType: null, dueAt: null };
  const ccTicket  = { type: 'CrossConnect', priority: 'medium', handoverType: null, dueAt: '2026-03-10T12:00:00Z' };
  const shTicket  = { type: 'SmartHands', priority: 'medium', handoverType: null };
  const otTicket  = { type: 'TroubleTicket', priority: 'medium', handoverType: 'other_teams' };

  it('excludes Dispatcher from normal tickets', () => {
    const r = applyRoleFilter({ role: 'dispatcher' }, ttTicket, NOW);
    assert.equal(r.eligible, false);
    assert.match(r.reason, /Dispatcher.*does not receive normal/);
  });

  it('allows Dispatcher for OtherTeams handover', () => {
    const r = applyRoleFilter({ role: 'dispatcher' }, otTicket, NOW);
    assert.equal(r.eligible, true);
  });

  it('excludes OtherTeams handover from normal staff', () => {
    const r = applyRoleFilter({ role: 'normal' }, otTicket, NOW);
    assert.equal(r.eligible, false);
    assert.match(r.reason, /OtherTeams.*Dispatcher/);
  });

  it('excludes Large Order', () => {
    assert.equal(applyRoleFilter({ role: 'large_order' }, ttTicket, NOW).eligible, false);
  });

  it('excludes Project', () => {
    assert.equal(applyRoleFilter({ role: 'project' }, ttTicket, NOW).eligible, false);
  });

  it('excludes Leads', () => {
    assert.equal(applyRoleFilter({ role: 'leads' }, ttTicket, NOW).eligible, false);
  });

  it('allows Deutsche Börse for TroubleTickets', () => {
    assert.equal(applyRoleFilter({ role: 'deutsche_boerse' }, ttTicket, NOW).eligible, true);
  });

  it('allows Deutsche Börse for CC > 24h', () => {
    assert.equal(applyRoleFilter({ role: 'deutsche_boerse' }, ccTicket, NOW).eligible, true);
  });

  it('excludes Deutsche Börse for CC <= 24h', () => {
    const shortCC = { ...ccTicket, dueAt: '2026-03-09T10:00:00Z' };
    assert.equal(applyRoleFilter({ role: 'deutsche_boerse' }, shortCC, NOW).eligible, false);
  });

  it('excludes Deutsche Börse for SmartHands', () => {
    assert.equal(applyRoleFilter({ role: 'deutsche_boerse' }, shTicket, NOW).eligible, false);
  });

  it('allows Cross Connect role only for CC tickets', () => {
    assert.equal(applyRoleFilter({ role: 'cross_connect' }, ccTicket, NOW).eligible, true);
    assert.equal(applyRoleFilter({ role: 'cross_connect' }, ttTicket, NOW).eligible, false);
    assert.equal(applyRoleFilter({ role: 'cross_connect' }, shTicket, NOW).eligible, false);
  });

  it('excludes Support (secondary worker)', () => {
    const r = applyRoleFilter({ role: 'support' }, ttTicket, NOW);
    assert.equal(r.eligible, false);
    assert.match(r.reason, /secondary/i);
  });

  it('allows Buddy and Neustarter', () => {
    assert.equal(applyRoleFilter({ role: 'buddy' }, ttTicket, NOW).eligible, true);
    assert.equal(applyRoleFilter({ role: 'neustarter' }, ttTicket, NOW).eligible, true);
  });

  it('allows Normal for all tickets', () => {
    assert.equal(applyRoleFilter({ role: 'normal' }, ttTicket, NOW).eligible, true);
  });

  it('defaults to normal if role missing', () => {
    assert.equal(applyRoleFilter({}, ttTicket, NOW).eligible, true);
  });
});

/* ================================================================ */
/* V2 Rules — Exclusion List                                        */
/* ================================================================ */
describe('Exclusion List', () => {
  const list = ['SYS-ALPHA', 'sys-beta', 'GAMMA-PROD'];

  it('excludes matching system name', () => {
    assert.equal(checkExclusionList({ systemName: 'SYS-ALPHA' }, list).excluded, true);
  });

  it('is case-insensitive', () => {
    assert.equal(checkExclusionList({ systemName: 'sys-alpha' }, list).excluded, true);
  });

  it('does not exclude non-matching name', () => {
    assert.equal(checkExclusionList({ systemName: 'SYS-DELTA' }, list).excluded, false);
  });

  it('does not exclude ticket with no system name', () => {
    assert.equal(checkExclusionList({ systemName: null }, list).excluded, false);
  });

  it('does not exclude when list is empty', () => {
    assert.equal(checkExclusionList({ systemName: 'SYS-ALPHA' }, []).excluded, false);
  });
});

/* ================================================================ */
/* V2 Rules — Handover Routing                                      */
/* ================================================================ */
describe('Handover Routing', () => {
  it('treats Workload as normal', () => {
    const r = routeHandover({ type: 'TroubleTicket', handoverType: 'workload' });
    assert.equal(r.action, 'normal');
    assert.equal(r.effectiveType, 'TroubleTicket');
  });

  it('treats Terminated as Scheduled', () => {
    const r = routeHandover({ type: 'TroubleTicket', handoverType: 'terminated' });
    assert.equal(r.action, 'scheduled');
    assert.equal(r.effectiveType, 'Scheduled');
  });

  it('routes OtherTeams to dispatcher_only', () => {
    const r = routeHandover({ type: 'TroubleTicket', handoverType: 'other_teams' });
    assert.equal(r.action, 'dispatcher_only');
  });

  it('treats unknown handover as manual_review', () => {
    const r = routeHandover({ type: 'TroubleTicket', handoverType: 'something_new' });
    assert.equal(r.action, 'manual_review');
  });

  it('treats missing handover as normal', () => {
    const r = routeHandover({ type: 'TroubleTicket', handoverType: null });
    assert.equal(r.action, 'normal');
  });
});

/* ================================================================ */
/* V2 Rules — Queue Purity                                          */
/* ================================================================ */
describe('Queue Purity', () => {
  const NOW = new Date('2026-03-08T12:00:00Z').getTime();

  it('allows any type when worker has no current tickets', () => {
    assert.equal(checkQueuePurity({}, { type: 'SmartHands' }, [], false, NOW).pure, true);
  });

  it('allows SH → SH', () => {
    assert.equal(checkQueuePurity({}, { type: 'SmartHands' }, [{ type: 'SmartHands' }], false, NOW).pure, true);
  });

  it('blocks SH → CC', () => {
    assert.equal(checkQueuePurity({}, { type: 'CrossConnect' }, [{ type: 'SmartHands' }], false, NOW).pure, false);
  });

  it('allows CC → CC', () => {
    assert.equal(checkQueuePurity({}, { type: 'CrossConnect' }, [{ type: 'CrossConnect' }], false, NOW).pure, true);
  });

  it('blocks CC → SH', () => {
    assert.equal(checkQueuePurity({}, { type: 'SmartHands' }, [{ type: 'CrossConnect' }], false, NOW).pure, false);
  });

  it('allows CC worker → TT when insufficient resources + CC > 24h', () => {
    const existing = [{ type: 'CrossConnect', dueAt: '2026-03-10T12:00:00Z' }]; // 48h
    assert.equal(checkQueuePurity({}, { type: 'TroubleTicket' }, existing, true, NOW).pure, true);
  });

  it('blocks CC worker → TT when insufficient resources but CC <= 24h', () => {
    const existing = [{ type: 'CrossConnect', dueAt: '2026-03-09T10:00:00Z' }]; // 22h
    assert.equal(checkQueuePurity({}, { type: 'TroubleTicket' }, existing, true, NOW).pure, false);
  });

  it('blocks CC worker → TT when resources are sufficient', () => {
    const existing = [{ type: 'CrossConnect', dueAt: '2026-03-10T12:00:00Z' }]; // 48h
    assert.equal(checkQueuePurity({}, { type: 'TroubleTicket' }, existing, false, NOW).pure, false);
  });

  it('allows TT → Scheduled', () => {
    assert.equal(checkQueuePurity({}, { type: 'Scheduled' }, [{ type: 'TroubleTicket' }], false, NOW).pure, true);
  });
});

/* ================================================================ */
/* V2 Rules — System Name Grouping                                  */
/* ================================================================ */
describe('System Name Grouping', () => {
  const NOW = new Date('2026-03-08T12:00:00Z').getTime();

  it('returns no grouping for ticket without system name', () => {
    const r = evaluateSystemGrouping({}, { type: 'SmartHands' }, [], NOW);
    assert.equal(r.grouped, false);
    assert.equal(r.score, 0);
  });

  it('returns no grouping when worker has no tickets for that system', () => {
    const r = evaluateSystemGrouping({}, { type: 'SmartHands', systemName: 'SYS-A' }, [], NOW);
    assert.equal(r.grouped, false);
  });

  it('groups SmartHands up to max 3 per worker per system', () => {
    const existing = [
      { systemName: 'SYS-A', type: 'SmartHands' },
      { systemName: 'SYS-A', type: 'SmartHands' },
    ];
    const r = evaluateSystemGrouping({}, { type: 'SmartHands', systemName: 'SYS-A' }, existing, NOW);
    assert.equal(r.grouped, true);
    assert.ok(r.score > 0);
  });

  it('blocks SmartHands at max 3 per worker per system', () => {
    const existing = [
      { systemName: 'SYS-A', type: 'SmartHands' },
      { systemName: 'SYS-A', type: 'SmartHands' },
      { systemName: 'SYS-A', type: 'SmartHands' },
    ];
    const r = evaluateSystemGrouping({}, { type: 'SmartHands', systemName: 'SYS-A' }, existing, NOW);
    assert.equal(r.grouped, false);
    assert.equal(r.blocked, true);
    assert.equal(r.score, -1);
  });

  it('groups CrossConnect with similar remaining times (< 6h)', () => {
    const existing = [
      { systemName: 'SYS-B', type: 'CrossConnect', dueAt: '2026-03-08T16:00:00Z' },
    ];
    const ticket = { type: 'CrossConnect', systemName: 'SYS-B', dueAt: '2026-03-08T18:00:00Z' };
    assert.equal(evaluateSystemGrouping({}, ticket, existing, NOW).grouped, true);
  });

  it('does not group CrossConnect with > 6h time difference', () => {
    const existing = [
      { systemName: 'SYS-B', type: 'CrossConnect', dueAt: '2026-03-08T14:00:00Z' },
    ];
    const ticket = { type: 'CrossConnect', systemName: 'SYS-B', dueAt: '2026-03-09T12:00:00Z' };
    assert.equal(evaluateSystemGrouping({}, ticket, existing, NOW).grouped, false);
  });

  it('is case-insensitive on system name', () => {
    const existing = [{ systemName: 'sys-a', type: 'SmartHands' }];
    assert.equal(evaluateSystemGrouping({}, { type: 'SmartHands', systemName: 'SYS-A' }, existing, NOW).grouped, true);
  });
});

/* ================================================================ */
/* V2 — Priority Tiers                                              */
/* ================================================================ */
describe('Priority Tiers', () => {
  it('returns correct tier for each ticket type/priority combination', () => {
    assert.equal(getPriorityTier({ type: 'TroubleTicket', priority: 'critical' }), PRIORITY_TIERS.TT_HIGH);
    assert.equal(getPriorityTier({ type: 'TroubleTicket', priority: 'high' }), PRIORITY_TIERS.TT_HIGH);
    assert.equal(getPriorityTier({ type: 'TroubleTicket', priority: 'medium' }), PRIORITY_TIERS.TT_MEDIUM);
    assert.equal(getPriorityTier({ type: 'SmartHands', priority: 'medium' }), PRIORITY_TIERS.KPI_QUEUE);
    assert.equal(getPriorityTier({ type: 'CrossConnect', priority: 'low' }), PRIORITY_TIERS.KPI_QUEUE);
    assert.equal(getPriorityTier({ type: 'Scheduled', priority: 'medium' }), PRIORITY_TIERS.SCHEDULED);
    assert.equal(getPriorityTier({ type: 'TroubleTicket', priority: 'low' }), PRIORITY_TIERS.TT_LOW);
    assert.equal(getPriorityTier({ type: 'Other', priority: 'medium' }), PRIORITY_TIERS.OTHER);
  });

  it('sorts TT-High > TT-Medium > KPI > Scheduled > TT-Low in correct order', () => {
    const NOW = new Date('2026-03-08T12:00:00Z').getTime();
    const tickets = [
      { id: 'low', type: 'TroubleTicket', priority: 'low' },
      { id: 'sched', type: 'Scheduled', priority: 'medium' },
      { id: 'sh', type: 'SmartHands', priority: 'medium', dueAt: '2026-03-08T14:00:00Z' },
      { id: 'high', type: 'TroubleTicket', priority: 'high' },
      { id: 'med', type: 'TroubleTicket', priority: 'medium' },
    ];
    const sorted = sortTickets(tickets, NOW);
    assert.deepEqual(sorted.map(t => t.id), ['high', 'med', 'sh', 'sched', 'low']);
  });

  it('sorts KPI tickets by lowest remaining time', () => {
    const NOW = new Date('2026-03-08T12:00:00Z').getTime();
    const tickets = [
      { id: 'sh2', type: 'SmartHands', priority: 'medium', dueAt: '2026-03-08T20:00:00Z' },
      { id: 'cc1', type: 'CrossConnect', priority: 'medium', dueAt: '2026-03-08T14:00:00Z' },
      { id: 'sh1', type: 'SmartHands', priority: 'medium', dueAt: '2026-03-08T18:00:00Z' },
    ];
    const sorted = sortTickets(tickets, NOW);
    assert.equal(sorted[0].id, 'cc1');
    assert.equal(sorted[1].id, 'sh1');
    assert.equal(sorted[2].id, 'sh2');
  });

  it('breaks final ties by ticket ID', () => {
    const NOW = new Date('2026-03-08T12:00:00Z').getTime();
    const sorted = sortTickets([
      { id: 'b', type: 'TroubleTicket', priority: 'high' },
      { id: 'a', type: 'TroubleTicket', priority: 'high' },
    ], NOW);
    assert.equal(sorted[0].id, 'a');
  });
});

/* ================================================================ */
/* V2 — Normalization New Fields                                    */
/* ================================================================ */
describe('Normalization — V2 Fields', () => {
  it('normalizes Scheduled ticket type', () => {
    assert.equal(mapType('scheduled').value, 'Scheduled');
    assert.equal(mapType('Scheduled').value, 'Scheduled');
  });

  it('normalizes handover types', () => {
    assert.equal(mapHandoverType('workload').value, 'workload');
    assert.equal(mapHandoverType('terminated').value, 'terminated');
    assert.equal(mapHandoverType('other_teams').value, 'other_teams');
    assert.equal(mapHandoverType('otherteams').value, 'other_teams');
  });

  it('preserves system name', () => {
    assert.equal(mapSystemName('SYS-ALPHA').value, 'SYS-ALPHA');
    assert.equal(mapSystemName(null).value, null);
    assert.equal(mapSystemName('').value, null);
  });

  it('includes V2 fields in normalizeTicket output', () => {
    const raw = {
      id: 42,
      queue_type: 'SmartHands',
      status: 'open',
      severity: 'medium',
      system_name: 'PROD-DB-01',
      handover_type: 'workload',
      sched_start: '2026-03-09T08:00:00Z',
      commit_date: '2026-03-10T12:00:00Z',
      first_seen_at: '2026-03-07T10:00:00Z',
      remaining_hours: 48,
    };
    const ticket = normalizeTicket(raw);
    assert.equal(ticket.type, 'SmartHands');
    assert.equal(ticket.systemName, 'PROD-DB-01');
    assert.equal(ticket.handoverType, 'workload');
    assert.equal(ticket.remainingHours, 48);
  });
});

/* ================================================================ */
/* V2 — Eligibility with Role + Queue Purity                        */
/* ================================================================ */
describe('Eligibility — V2 Role + Purity', () => {
  const settings = { siteStrictness: 'false', responsibilityStrictness: 'false' };
  const ttTicket = { type: 'TroubleTicket', priority: 'high', handoverType: null, site: null, responsibility: null };

  it('excludes by role filter', () => {
    const w = { name: 'Test', autoAssignable: true, blocked: false, onBreak: false, absent: false, shiftActive: true, role: 'project' };
    const r = applyEligibilityRules(w, ttTicket, settings);
    assert.equal(r.eligible, false);
    assert.ok(r.exclusions.some(e => e.rule === 'roleFilter'));
  });

  it('excludes by queue purity', () => {
    const w = { name: 'Test', autoAssignable: true, blocked: false, onBreak: false, absent: false, shiftActive: true, role: 'normal' };
    const shTicket = { type: 'SmartHands', priority: 'medium', handoverType: null, site: null, responsibility: null };
    const currentTickets = [{ type: 'CrossConnect' }];
    const r = applyEligibilityRules(w, shTicket, settings, currentTickets);
    assert.equal(r.eligible, false);
    assert.ok(r.exclusions.some(e => e.rule === 'queuePurity'));
  });

  it('accepts normal worker with clean queue', () => {
    const w = { name: 'Test', autoAssignable: true, blocked: false, onBreak: false, absent: false, shiftActive: true, role: 'normal' };
    const r = applyEligibilityRules(w, ttTicket, settings, []);
    assert.equal(r.eligible, true);
    assert.equal(r.exclusions.length, 0);
  });
});

/* ================================================================ */
/* V2 — Worker Selection Tie-Breaking                               */
/* ================================================================ */
describe('V2 Worker Selection', () => {
  const NOW = new Date('2026-03-08T12:00:00Z').getTime();

  it('prefers worker with existing system name grouping', () => {
    const candidates = [
      { id: 1, name: 'Worker A' },
      { id: 2, name: 'Worker B' },
    ];
    const wMap = new Map([
      [1, []],
      [2, [{ systemName: 'SYS-A', type: 'SmartHands' }]],
    ]);
    const r = selectWorker(candidates, { type: 'SmartHands', systemName: 'SYS-A', dueAt: '2026-03-08T16:00:00Z' }, {}, wMap, false, NOW);
    assert.equal(r.worker.id, 2);
  });

  it('prefers queue purity when no grouping difference', () => {
    const candidates = [
      { id: 1, name: 'Worker A' },
      { id: 2, name: 'Worker B' },
    ];
    const wMap = new Map([
      [1, [{ type: 'CrossConnect' }]],  // impure for SH
      [2, [{ type: 'SmartHands' }]],     // pure for SH
    ]);
    const r = selectWorker(candidates, { type: 'SmartHands', systemName: null }, {}, wMap, false, NOW);
    assert.equal(r.worker.id, 2);
  });

  it('prefers least workload when grouping and purity equal', () => {
    const candidates = [
      { id: 1, name: 'Worker A' },
      { id: 2, name: 'Worker B' },
    ];
    const wMap = new Map([
      [1, [{ type: 'SmartHands' }, { type: 'SmartHands' }]],
      [2, [{ type: 'SmartHands' }]],
    ]);
    const r = selectWorker(candidates, { type: 'SmartHands', systemName: null }, {}, wMap, false, NOW);
    assert.equal(r.worker.id, 2);
  });

  it('falls back to lowest worker ID', () => {
    const r = selectWorker(
      [{ id: 5, name: 'E' }, { id: 3, name: 'C' }],
      { type: 'SmartHands', systemName: null },
      {},
      new Map([[5, []], [3, []]]),
      false, NOW,
    );
    assert.equal(r.worker.id, 3);
  });

  it('returns the only candidate', () => {
    const r = selectWorker([{ id: 42, name: 'Solo' }], { type: 'SmartHands' }, {}, new Map(), false, NOW);
    assert.equal(r.worker.id, 42);
    assert.match(r.reason, /Only one/);
  });

  it('returns null for no candidates', () => {
    const r = selectWorker([], { type: 'SmartHands' }, {}, new Map(), false, NOW);
    assert.equal(r.worker, null);
  });
});
