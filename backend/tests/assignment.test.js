/* ================================================ */
/* Assignment Engine — Unit Tests                   */
/* ================================================ */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Normalization
import {
  mapType, mapStatus, mapPriority, mapSite, mapDates,
  mapResponsibility, mapTicketId, normalizeTicket, validateNormalizedTicket,
} from '../assignment/normalization/normalizeTicket.js';

// Relevance
import { checkRelevance } from '../assignment/relevance/checkRelevance.js';

// Eligibility
import {
  isWorkerAutoAssignable, isAvailable, isNotOnBreak, isNotAbsent,
  isShiftActive, matchesSite, matchesResponsibility, applyEligibilityRules,
} from '../assignment/eligibility/rules.js';

// Priority / Selection
import { sortTickets, selectWorker, resolveWorkerTie } from '../assignment/priority/sortAndSelect.js';

// Logging
import { buildDecisionLog, buildRunSummary, buildTicketExplanation } from '../assignment/logging/decisionLog.js';

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

  it('sorts critical before medium', () => {
    const sorted = sortTickets([
      { id: 'A', priority: 'medium', type: 'SmartHands' },
      { id: 'B', priority: 'critical', type: 'SmartHands' },
    ]);
    assert.equal(sorted[0].id, 'B');
  });

  it('sorts TroubleTicket before SmartHands at same priority', () => {
    const sorted = sortTickets([
      { id: 'A', priority: 'medium', type: 'SmartHands' },
      { id: 'B', priority: 'medium', type: 'TroubleTicket' },
    ]);
    assert.equal(sorted[0].id, 'B');
  });

  it('sorts CrossConnect before SmartHands', () => {
    const sorted = sortTickets([
      { id: 'A', priority: 'medium', type: 'SmartHands' },
      { id: 'B', priority: 'medium', type: 'CrossConnect' },
    ]);
    assert.equal(sorted[0].id, 'B');
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

  it('prefers same-site worker', () => {
    const r = selectWorker(
      [
        { id: 1, name: 'A', site: 'AM3' },
        { id: 2, name: 'B', site: 'FR2' },
      ],
      { site: 'FR2' },
      {}
    );
    assert.equal(r.worker.id, 2);
  });

  it('uses stable-id tie-breaker', () => {
    const r = selectWorker(
      [
        { id: 5, name: 'E' },
        { id: 3, name: 'C' },
      ],
      {},
      { enableRotationTieBreaker: 'false', fallbackTieBreaker: 'stable-id' }
    );
    assert.equal(r.worker.id, 3); // lowest ID
  });
});

/* ================================================ */
/* resolveWorkerTie                                 */
/* ================================================ */
describe('resolveWorkerTie', () => {
  it('uses rotation tie-breaker', () => {
    const r = resolveWorkerTie(
      [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }],
      { enableRotationTieBreaker: 'true' },
      { last_assigned_worker_id: 1 },
      {}
    );
    assert.equal(r.worker.id, 2); // next after 1
  });

  it('wraps around in rotation', () => {
    const r = resolveWorkerTie(
      [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      { enableRotationTieBreaker: 'true' },
      { last_assigned_worker_id: 2 },
      {}
    );
    assert.equal(r.worker.id, 1); // wrap to first
  });

  it('falls back to stable-id', () => {
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
