/* ================================================ */
/* Assignment Engine — Eligibility Rules            */
/* ================================================ */

import { applyRoleFilter } from '../rules/roleFilter.js';
import { checkQueuePurity } from '../rules/queuePurity.js';

/**
 * Each rule function returns:
 *   { eligible: boolean, rule: string, reason: string }
 */

export function isWorkerAutoAssignable(worker) {
  if (!worker.autoAssignable) {
    return { eligible: false, rule: 'isWorkerAutoAssignable', reason: `${worker.name} is not auto-assignable` };
  }
  return { eligible: true, rule: 'isWorkerAutoAssignable', reason: 'Worker is auto-assignable' };
}

export function isAvailable(worker) {
  if (worker.blocked) {
    return { eligible: false, rule: 'isAvailable', reason: `${worker.name} is blocked` };
  }
  return { eligible: true, rule: 'isAvailable', reason: 'Worker is available' };
}

export function isNotOnBreak(worker) {
  if (worker.onBreak) {
    return { eligible: false, rule: 'isNotOnBreak', reason: `${worker.name} is on break` };
  }
  return { eligible: true, rule: 'isNotOnBreak', reason: 'Worker is not on break' };
}

export function isNotAbsent(worker) {
  if (worker.absent) {
    return { eligible: false, rule: 'isNotAbsent', reason: `${worker.name} is absent` };
  }
  return { eligible: true, rule: 'isNotAbsent', reason: 'Worker is not absent' };
}

export function isShiftActive(worker) {
  // Use the shift_active column from users table
  if (worker.shiftActive === false) {
    return { eligible: false, rule: 'isShiftActive', reason: `${worker.name} is not on active shift` };
  }
  return { eligible: true, rule: 'isShiftActive', reason: 'Worker is on active shift' };
}

export function matchesSite(worker, ticket, settings) {
  if (settings.siteStrictness !== 'true' && settings.siteStrictness !== true) {
    return { eligible: true, rule: 'matchesSite', reason: 'Site strictness is disabled' };
  }
  if (!ticket.site) {
    return { eligible: true, rule: 'matchesSite', reason: 'Ticket has no site — skipping site check' };
  }
  if (!worker.site) {
    return { eligible: false, rule: 'matchesSite', reason: `${worker.name} has no site assigned (ticket requires ${ticket.site})` };
  }
  const workerSite = worker.site.toLowerCase().trim();
  const ticketSite = ticket.site.toLowerCase().trim();
  if (workerSite !== ticketSite) {
    return { eligible: false, rule: 'matchesSite', reason: `${worker.name} site "${worker.site}" does not match ticket site "${ticket.site}"` };
  }
  return { eligible: true, rule: 'matchesSite', reason: `Site matches: ${worker.site}` };
}

export function matchesResponsibility(worker, ticket, settings) {
  if (settings.responsibilityStrictness !== 'true' && settings.responsibilityStrictness !== true) {
    return { eligible: true, rule: 'matchesResponsibility', reason: 'Responsibility strictness is disabled' };
  }
  if (!ticket.responsibility) {
    return { eligible: true, rule: 'matchesResponsibility', reason: 'Ticket has no responsibility — skipping check' };
  }
  if (!worker.responsibility) {
    return { eligible: false, rule: 'matchesResponsibility', reason: `${worker.name} has no responsibility assigned (ticket requires ${ticket.responsibility})` };
  }
  const wResp = worker.responsibility.toLowerCase().trim();
  const tResp = ticket.responsibility.toLowerCase().trim();
  if (wResp !== tResp) {
    return { eligible: false, rule: 'matchesResponsibility', reason: `${worker.name} responsibility "${worker.responsibility}" does not match ticket "${ticket.responsibility}"` };
  }
  return { eligible: true, rule: 'matchesResponsibility', reason: `Responsibility matches: ${worker.responsibility}` };
}

/**
 * Apply role-based filtering rules.
 * Wraps the spec role filter into the eligibility framework.
 */
export function checkRole(worker, ticket, now = Date.now()) {
  return applyRoleFilter(worker, ticket, now);
}

/**
 * Apply queue purity rule.
 * Wraps the queue purity check into the eligibility framework.
 */
export function checkQueueClean(worker, ticket, workerCurrentTickets = [], insufficientResources = false, now = Date.now()) {
  const result = checkQueuePurity(worker, ticket, workerCurrentTickets, insufficientResources, now);
  return {
    eligible: result.pure,
    rule: 'queuePurity',
    reason: result.reason,
  };
}

/**
 * Apply all eligibility rules to a single worker for a given ticket.
 * Returns { eligible, exclusions: [{rule, reason}] }
 *
 * @param {object} worker               - Worker object (with .role, .shiftActive, etc.)
 * @param {object} ticket               - Normalized ticket
 * @param {object} settings             - Engine config
 * @param {object[]} workerCurrentTickets - Current tickets assigned to this worker
 * @param {boolean} insufficientResources - Global insufficient resources flag
 * @param {number} [now]                 - Current time ms
 */
export function applyEligibilityRules(worker, ticket, settings, workerCurrentTickets = [], insufficientResources = false, now = Date.now()) {
  const rules = [
    () => isWorkerAutoAssignable(worker),
    () => isAvailable(worker),
    () => isNotOnBreak(worker),
    () => isNotAbsent(worker),
    () => isShiftActive(worker),
    () => checkRole(worker, ticket, now),
    () => matchesSite(worker, ticket, settings),
    () => matchesResponsibility(worker, ticket, settings),
    () => checkQueueClean(worker, ticket, workerCurrentTickets, insufficientResources, now),
  ];

  const exclusions = [];
  const checkedRules = [];

  for (const ruleFn of rules) {
    const result = ruleFn();
    checkedRules.push(result.rule);
    if (!result.eligible) {
      exclusions.push({ rule: result.rule, reason: result.reason });
    }
  }

  return {
    eligible: exclusions.length === 0,
    exclusions,
    checkedRules,
  };
}
