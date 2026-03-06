/* ================================================ */
/* Assignment Engine — Frontend Type Definitions     */
/* ================================================ */

/* ---- Enums / Literal Types ---- */

export type AssignmentMode = 'shadow' | 'live' | 'dry-run';
export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type DecisionResult = 'assigned' | 'manual_review' | 'no_candidate' | 'not_relevant' | 'blocked' | 'error';
export type TicketType = 'TroubleTicket' | 'SmartHands' | 'CrossConnect' | 'Other' | 'Unknown';
export type TicketStatus = 'open' | 'active' | 'pending' | 'closed' | 'cancelled' | 'unknown';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical' | 'unknown';
export type OverrideType = 'force_assign' | 'force_block' | 'force_manual';

/* ---- Settings ---- */

export interface AssignmentSettings {
  'assignment.mode': AssignmentMode;
  'assignment.siteStrictness': string;
  'assignment.responsibilityStrictness': string;
  'assignment.enableRotationTieBreaker': string;
  'assignment.fallbackTieBreaker': string;
  'assignment.planningWindowHours': string;
  'assignment.maxTicketsPerRun': string;
  'assignment.stopOnCriticalError': string;
  'assignment.supportedTicketTypes': string;
  [key: string]: string;
}

export interface AssignmentSettingRow {
  key: string;
  value: string;
  description?: string;
  updated_at?: string;
  updated_by?: string;
}

/* ---- Runs ---- */

export interface AssignmentRun {
  id: number;
  mode: AssignmentMode;
  status: RunStatus;
  started_at: string;
  finished_at: string | null;
  total_tickets: number;
  relevant: number;
  assigned: number;
  manual_review: number;
  no_candidate: number;
  not_relevant: number;
  blocked: number;
  errors: number;
  triggered_by: string | null;
  summary: Record<string, unknown> | null;
  created_at: string;
}

/* ---- Decisions ---- */

export interface CandidateRef {
  id: number;
  name: string;
}

export interface ExcludedCandidate {
  id: number;
  name: string;
  reason: string;
  rule?: string;
}

export interface AssignmentDecision {
  id: number;
  run_id: number;
  ticket_id: string;
  external_id: string | null;
  ticket_type: string | null;
  ticket_status: string | null;
  ticket_priority: string | null;
  ticket_site: string | null;
  result: DecisionResult;
  assigned_worker_id: number | null;
  assigned_worker_name: string | null;
  selection_reason: string | null;
  short_reason: string | null;
  rule_path: string[] | null;
  initial_candidates: CandidateRef[] | null;
  excluded_candidates: ExcludedCandidate[] | null;
  remaining_candidates: CandidateRef[] | null;
  normalization_warnings: string[] | null;
  normalized_ticket: Record<string, unknown> | null;
  raw_ticket: Record<string, unknown> | null;
  error_message: string | null;
  decided_at: string;
}

/* ---- Explanation ---- */

export interface TicketExplanationStructured {
  ticketId: string;
  externalId: string | null;
  result: DecisionResult;
  shortReason: string | null;
  ticketType: string | null;
  ticketStatus: string | null;
  ticketPriority: string | null;
  ticketSite: string | null;
  normalizationWarnings: string[];
  initialCandidates: CandidateRef[];
  excludedCandidates: ExcludedCandidate[];
  remainingCandidates: CandidateRef[];
  assignedWorkerName: string | null;
  assignedWorkerId: number | null;
  selectionReason: string | null;
  rulePath: string[];
  errorMessage: string | null;
}

export interface TicketExplanation {
  found: boolean;
  decision?: AssignmentDecision;
  explanation?: {
    markdown: string;
    structured: TicketExplanationStructured;
  };
  message?: string;
}

/* ---- Overrides ---- */

export interface AssignmentOverride {
  id: number;
  ticket_id: string;
  override_type: OverrideType;
  target_worker_id: number | null;
  reason: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  deactivated_at: string | null;
  deactivated_by: string | null;
}

/* ---- Health ---- */

export interface AssignmentHealth {
  ok: boolean;
  module: string;
  phase: number;
  mode: AssignmentMode;
  settingsCount: number;
}

/* ---- Filters ---- */

export interface AssignmentFilters {
  runMode?: AssignmentMode;
  runStatus?: RunStatus;
  decisionResult?: DecisionResult;
  selectedRunId?: number;
  dateFrom?: string;
  dateTo?: string;
}
