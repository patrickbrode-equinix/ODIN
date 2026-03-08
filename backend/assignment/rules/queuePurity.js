/* ================================================ */
/* Assignment Engine — Queue Purity (Clean Rule)    */
/* ================================================ */

import { MS_24H } from '../constants.js';

/**
 * Enforce queue purity: ticket types should not mix per worker.
 *
 * Rules:
 *   SmartHands workers   → only SmartHands
 *   CrossConnect workers → only CrossConnect
 *
 * Exception:
 *   If resources are insufficient AND CrossConnect remaining time > 24h,
 *   then the worker may also receive Trouble Tickets.
 *
 * @param {object}   worker               - Worker object
 * @param {object}   ticket               - Normalized ticket
 * @param {object[]} workerCurrentTickets  - Tickets currently assigned to this worker
 * @param {boolean}  insufficientResources - System-wide insufficient resources flag
 * @param {number}   [now]                - Current time ms (for testing)
 * @returns {{ pure: boolean, reason: string }}
 */
export function checkQueuePurity(worker, ticket, workerCurrentTickets = [], insufficientResources = false, now = Date.now()) {
  if (!workerCurrentTickets || workerCurrentTickets.length === 0) {
    return {
      pure: true,
      reason: 'Worker has no current tickets — queue is clean',
    };
  }

  const currentTypes = new Set(workerCurrentTickets.map(t => t.type));

  // Worker currently has SmartHands tickets
  if (currentTypes.has('SmartHands')) {
    if (ticket.type === 'SmartHands') {
      return { pure: true, reason: 'SmartHands worker receives SmartHands ticket — queue pure' };
    }
    return {
      pure: false,
      reason: `Worker has SmartHands tickets — cannot mix with "${ticket.type}"`,
    };
  }

  // Worker currently has CrossConnect tickets
  if (currentTypes.has('CrossConnect')) {
    if (ticket.type === 'CrossConnect') {
      return { pure: true, reason: 'CrossConnect worker receives CrossConnect ticket — queue pure' };
    }

    // Exception: insufficient resources + TroubleTicket + all CC remaining > 24h
    if (insufficientResources && ticket.type === 'TroubleTicket') {
      const allCcHaveTime = workerCurrentTickets
        .filter(t => t.type === 'CrossConnect')
        .every(t => {
          if (!t.dueAt) return true; // no due date → assume time is available
          return new Date(t.dueAt).getTime() - now > MS_24H;
        });

      if (allCcHaveTime) {
        return {
          pure: true,
          reason: 'Exception: insufficient resources, all CC remaining > 24h — accepting TroubleTicket',
        };
      }
    }

    return {
      pure: false,
      reason: `Worker has CrossConnect tickets — cannot mix with "${ticket.type}"`,
    };
  }

  // Worker has TroubleTicket(s) — can also receive Scheduled
  if (currentTypes.has('TroubleTicket')) {
    if (ticket.type === 'TroubleTicket' || ticket.type === 'Scheduled') {
      return { pure: true, reason: `TroubleTicket worker can also receive "${ticket.type}" — queue compatible` };
    }
    return {
      pure: false,
      reason: `Worker has TroubleTicket — cannot mix with "${ticket.type}"`,
    };
  }

  // Worker has Scheduled tickets — can receive TroubleTicket and Scheduled
  if (currentTypes.has('Scheduled')) {
    if (ticket.type === 'TroubleTicket' || ticket.type === 'Scheduled') {
      return { pure: true, reason: `Scheduled worker can also receive "${ticket.type}"` };
    }
    return {
      pure: false,
      reason: `Worker has Scheduled tickets — cannot mix with "${ticket.type}"`,
    };
  }

  // Default: no conflict detected
  return { pure: true, reason: 'No queue purity conflict detected' };
}
