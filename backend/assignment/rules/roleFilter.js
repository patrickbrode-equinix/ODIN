/* ================================================ */
/* Assignment Engine — Role-Based Filtering         */
/* ================================================ */

import { STAFF_ROLES, EXCLUDED_ROLES, MS_24H } from '../constants.js';

/**
 * Apply role-based filtering rules per spec:
 *
 *   Dispatcher      → no normal tickets; receives OtherTeams handovers only
 *   Large Order     → receives no additional tickets
 *   Project         → receives no tickets
 *   Leads           → receives no tickets
 *   Deutsche Börse  → TroubleTickets only; CrossConnect only if remaining > 24h
 *   Cross Connect   → only CrossConnect tickets
 *   Buddy/Neustarter→ informational only (treated as normal)
 *   Support         → secondary worker role (not assigned as owner)
 *   Normal          → eligible for all ticket types
 *
 * @param {object} worker - Worker with .role property
 * @param {object} ticket - Normalized ticket with .type, .handoverType, .dueAt
 * @param {number} [now]  - Current time ms (for testing)
 * @returns {{ eligible: boolean, rule: string, reason: string }}
 */
export function applyRoleFilter(worker, ticket, now = Date.now()) {
  const role = (worker.role || 'normal').toLowerCase().trim();

  // Project, Leads, Large Order → never receive tickets
  if (EXCLUDED_ROLES.has(role)) {
    return {
      eligible: false,
      rule: 'roleFilter',
      reason: `Role "${role}" does not receive auto-assigned tickets`,
    };
  }

  // Dispatcher → only receives OtherTeams handovers
  if (role === STAFF_ROLES.DISPATCHER) {
    if (ticket.handoverType === 'other_teams') {
      return {
        eligible: true,
        rule: 'roleFilter',
        reason: 'Dispatcher receives OtherTeams handover',
      };
    }
    return {
      eligible: false,
      rule: 'roleFilter',
      reason: 'Dispatcher does not receive normal tickets',
    };
  }

  // OtherTeams handover → ONLY goes to dispatcher, never to normal staff
  if (ticket.handoverType === 'other_teams') {
    return {
      eligible: false,
      rule: 'roleFilter',
      reason: 'OtherTeams handover can only be assigned to Dispatcher',
    };
  }

  // Deutsche Börse → only TroubleTicket or CrossConnect with remaining > 24h
  if (role === STAFF_ROLES.DEUTSCHE_BOERSE) {
    if (ticket.type === 'TroubleTicket') {
      return {
        eligible: true,
        rule: 'roleFilter',
        reason: 'Deutsche Börse may receive Trouble Tickets',
      };
    }
    if (ticket.type === 'CrossConnect') {
      const remainingMs = ticket.dueAt ? new Date(ticket.dueAt).getTime() - now : null;
      if (remainingMs !== null && remainingMs > MS_24H) {
        return {
          eligible: true,
          rule: 'roleFilter',
          reason: `Deutsche Börse may receive Cross Connect (remaining: ${Math.round(remainingMs / 3600000)}h > 24h)`,
        };
      }
      return {
        eligible: false,
        rule: 'roleFilter',
        reason: `Deutsche Börse cannot receive Cross Connect with remaining time <= 24h`,
      };
    }
    return {
      eligible: false,
      rule: 'roleFilter',
      reason: `Deutsche Börse does not receive "${ticket.type}" tickets`,
    };
  }

  // Cross Connect Role → only Cross Connect tickets
  if (role === STAFF_ROLES.CROSS_CONNECT) {
    if (ticket.type === 'CrossConnect') {
      return {
        eligible: true,
        rule: 'roleFilter',
        reason: 'Cross Connect role receives Cross Connect tickets',
      };
    }
    return {
      eligible: false,
      rule: 'roleFilter',
      reason: `Cross Connect role does not receive "${ticket.type}" tickets`,
    };
  }

  // Support → secondary worker role, not assigned as ticket owner
  if (role === STAFF_ROLES.SUPPORT) {
    return {
      eligible: false,
      rule: 'roleFilter',
      reason: 'Support is a secondary worker role — not assigned as ticket owner',
    };
  }

  // Buddy / Neustarter → informational only, treated as normal worker
  // (no restriction applied)

  // Normal workers → eligible for all ticket types
  return {
    eligible: true,
    rule: 'roleFilter',
    reason: `Role "${role}" is eligible for ticket assignment`,
  };
}
