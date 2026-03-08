/* ================================================ */
/* Assignment Engine — Constants                    */
/* ================================================ */

export const TICKET_TYPES = ['TroubleTicket', 'SmartHands', 'CrossConnect', 'Scheduled', 'Other', 'Unknown'];
export const SUPPORTED_TICKET_TYPES = ['TroubleTicket', 'SmartHands', 'CrossConnect', 'Scheduled', 'Other'];

export const TICKET_STATUSES = ['open', 'active', 'pending', 'closed', 'cancelled', 'unknown'];
export const ACTIVE_STATUSES = ['open', 'active', 'pending'];
export const CLOSED_STATUSES = ['closed', 'cancelled'];

export const PRIORITIES = ['low', 'medium', 'high', 'critical', 'unknown'];
export const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };

export const DECISION_RESULTS = ['assigned', 'manual_review', 'no_candidate', 'not_relevant', 'blocked', 'error', 'crawler_stale'];

export const ENGINE_MODES = ['shadow', 'live', 'dry-run'];

export const RUN_STATUSES = ['running', 'completed', 'failed', 'cancelled'];

/* ---- Handover types ---- */
export const HANDOVER_TYPES = {
  WORKLOAD: 'workload',
  TERMINATED: 'terminated',
  OTHER_TEAMS: 'other_teams',
};

/* ---- Staff roles ---- */
export const STAFF_ROLES = {
  DISPATCHER: 'dispatcher',
  LARGE_ORDER: 'large_order',
  PROJECT: 'project',
  LEADS: 'leads',
  DEUTSCHE_BOERSE: 'deutsche_boerse',
  CROSS_CONNECT: 'cross_connect',
  BUDDY: 'buddy',
  NEUSTARTER: 'neustarter',
  SUPPORT: 'support',
  NORMAL: 'normal',
};

/** Roles that never receive normal auto-assigned tickets */
export const EXCLUDED_ROLES = new Set([
  STAFF_ROLES.LARGE_ORDER,
  STAFF_ROLES.PROJECT,
  STAFF_ROLES.LEADS,
]);

/* ---- Crawler staleness ---- */
export const CRAWLER_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/* ---- System grouping thresholds ---- */
export const MAX_SH_PER_WORKER_PER_SYSTEM = 3;
export const SIMILAR_TIME_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours
export const MS_24H = 24 * 60 * 60 * 1000;

/**
 * Ticket priority tiers for the spec-defined priority order:
 *   1. TroubleTicket High (& Critical)
 *   2. TroubleTicket Medium
 *   3. KPI queues (SmartHands, CrossConnect) sorted by remaining time
 *   4. Scheduled tickets
 *   5. TroubleTicket Low
 *   6. Everything else
 */
export const PRIORITY_TIERS = {
  TT_HIGH: 1,
  TT_MEDIUM: 2,
  KPI_QUEUE: 3,
  SCHEDULED: 4,
  TT_LOW: 5,
  OTHER: 6,
};

/** @deprecated Use PRIORITY_TIERS + getPriorityTier() instead */
export const TYPE_SORT_ORDER = {
  TroubleTicket: 0,
  CrossConnect: 1,
  SmartHands: 2,
  Scheduled: 3,
  Other: 4,
  Unknown: 5,
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
  CRAWLER_MAX_AGE: 'assignment.crawlerMaxAgeMinutes',
  ENABLE_LIVE: 'assignment.enableLiveMode',
  INSUFFICIENT_RESOURCES: 'assignment.insufficientResources',
};
