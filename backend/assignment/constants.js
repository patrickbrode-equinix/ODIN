/* ================================================ */
/* Assignment Engine — Constants                    */
/* ================================================ */

export const TICKET_TYPES = ['TroubleTicket', 'SmartHands', 'CrossConnect', 'Other', 'Unknown'];
export const SUPPORTED_TICKET_TYPES = ['TroubleTicket', 'SmartHands', 'CrossConnect', 'Other'];

export const TICKET_STATUSES = ['open', 'active', 'pending', 'closed', 'cancelled', 'unknown'];
export const ACTIVE_STATUSES = ['open', 'active', 'pending'];
export const CLOSED_STATUSES = ['closed', 'cancelled'];

export const PRIORITIES = ['low', 'medium', 'high', 'critical', 'unknown'];
export const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };

export const DECISION_RESULTS = ['assigned', 'manual_review', 'no_candidate', 'not_relevant', 'blocked', 'error'];

export const ENGINE_MODES = ['shadow', 'live', 'dry-run'];

export const RUN_STATUSES = ['running', 'completed', 'failed', 'cancelled'];

/** Ticket type priority for sorting (lower = higher priority) */
export const TYPE_SORT_ORDER = {
  TroubleTicket: 0,
  CrossConnect: 1,
  SmartHands: 2,
  Other: 3,
  Unknown: 4,
};

/** Default settings keys */
export const SETTINGS_KEYS = {
  MODE: 'assignment.mode',
  SITE_STRICTNESS: 'assignment.siteStrictness',
  RESPONSIBILITY_STRICTNESS: 'assignment.responsibilityStrictness',
  ENABLE_ROTATION: 'assignment.enableRotationTieBreaker',
  FALLBACK_TIE: 'assignment.fallbackTieBreaker',
  PLANNING_WINDOW: 'assignment.planningWindowHours',
  MAX_TICKETS: 'assignment.maxTicketsPerRun',
  STOP_ON_ERROR: 'assignment.stopOnCriticalError',
  SUPPORTED_TYPES: 'assignment.supportedTicketTypes',
};
