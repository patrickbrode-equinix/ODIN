/* ================================================ */
/* Assignment Engine — Config & Mapping Aliases     */
/* ================================================ */

/**
 * Type mapping aliases — maps raw ticket type strings
 * to normalized types.
 */
export const TYPE_ALIASES = {
  // TroubleTicket
  'troubleticket': 'TroubleTicket',
  'trouble_ticket': 'TroubleTicket',
  'trouble ticket': 'TroubleTicket',
  'tt': 'TroubleTicket',
  'incident': 'TroubleTicket',
  // SmartHands
  'smarthands': 'SmartHands',
  'smart_hands': 'SmartHands',
  'smart hands': 'SmartHands',
  'sh': 'SmartHands',
  // CrossConnect
  'crossconnect': 'CrossConnect',
  'cross_connect': 'CrossConnect',
  'cross connect': 'CrossConnect',
  'xconnect': 'CrossConnect',
  'xc': 'CrossConnect',
  'cc': 'CrossConnect',
  // Other
  'other': 'Other',
  'misc': 'Other',
  'general': 'Other',
};

/**
 * Status mapping aliases — maps raw status strings
 * to normalized statuses.
 */
export const STATUS_ALIASES = {
  'open': 'open',
  'new': 'open',
  'created': 'open',
  'active': 'active',
  'in progress': 'active',
  'in_progress': 'active',
  'inprogress': 'active',
  'working': 'active',
  'pending': 'pending',
  'waiting': 'pending',
  'on hold': 'pending',
  'on_hold': 'pending',
  'onhold': 'pending',
  'closed': 'closed',
  'resolved': 'closed',
  'done': 'closed',
  'completed': 'closed',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'rejected': 'cancelled',
  'void': 'cancelled',
};

/**
 * Priority mapping aliases.
 */
export const PRIORITY_ALIASES = {
  'low': 'low',
  'p4': 'low',
  '4': 'low',
  'minor': 'low',
  'medium': 'medium',
  'normal': 'medium',
  'p3': 'medium',
  '3': 'medium',
  'standard': 'medium',
  'high': 'high',
  'p2': 'high',
  '2': 'high',
  'major': 'high',
  'urgent': 'high',
  'critical': 'critical',
  'p1': 'critical',
  '1': 'critical',
  'emergency': 'critical',
  'blocker': 'critical',
};
