/* ================================================ */
/* Assignment Engine — Module Barrel Export          */
/* ================================================ */

// Config
export { TYPE_ALIASES, STATUS_ALIASES, PRIORITY_ALIASES } from './config.js';

// Constants
export {
  TICKET_TYPES, SUPPORTED_TICKET_TYPES,
  TICKET_STATUSES, ACTIVE_STATUSES, CLOSED_STATUSES,
  PRIORITIES, PRIORITY_ORDER,
  DECISION_RESULTS, ENGINE_MODES, RUN_STATUSES,
  TYPE_SORT_ORDER, SETTINGS_KEYS,
} from './constants.js';

// Errors
export { AssignmentError, NormalizationError, ValidationError, DecisionConflictError } from './errors.js';

// Normalization
export { normalizeTicket, validateNormalizedTicket, mapType, mapStatus, mapPriority, mapSite, mapDates, mapResponsibility, mapTicketId } from './normalization/normalizeTicket.js';

// Relevance
export { checkRelevance } from './relevance/checkRelevance.js';

// Candidates
export { loadCandidateWorkers, buildCandidatePool } from './candidates/loadCandidates.js';

// Eligibility
export {
  applyEligibilityRules,
  isWorkerAutoAssignable, isAvailable, isNotOnBreak, isNotAbsent,
  isShiftActive, matchesSite, matchesResponsibility,
} from './eligibility/rules.js';

// Priority / Selection
export { sortTickets, selectWorker, resolveWorkerTie } from './priority/sortAndSelect.js';

// Logging
export { buildDecisionLog, buildRunSummary, buildTicketExplanation } from './logging/decisionLog.js';

// Persistence
export { persistAssignmentRun, persistTicketDecision, persistWorkerRotation, applyLiveAssignment } from './persistence/persist.js';

// Repositories
export {
  assignmentRunRepository,
  assignmentDecisionRepository,
  assignmentSettingsRepository,
  assignmentOverrideRepository,
  assignmentRotationRepository,
} from './repositories/index.js';

// Services
export { assignmentSettingsService, assignmentExplanationService } from './services/index.js';

// Engine
export { runAssignmentCycle } from './engine/runAssignmentCycle.js';
export { processTicket } from './engine/processTicket.js';
