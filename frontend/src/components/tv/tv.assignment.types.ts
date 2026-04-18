/* ------------------------------------------------ */
/* TV Assignment Hero Slide — Types                 */
/* Backend is source of truth; frontend only renders */
/* ------------------------------------------------ */

export interface TvAssignmentTicket {
  id: string;
  externalId: string;
  typeCode: "TT" | "SH" | "CC" | "SCHED" | "OTHER";
  type: string;
  activity: string;
  systemName: string;
  restTime: string | null;
  schedStart: string | null;
  revisedCommitDate: string | null;
  priorityLabel: string;
  priority: string;
  remainingLabel?: string;
  status?: string;
  mode?: string | null;
}

export interface TvAssignmentClassification {
  ticketType: string;
  priorityClass: string;
  scheduled: boolean;
  expedite: boolean;
  clusterCandidate: boolean;
}

export interface TvDecisionStep {
  key: string;
  label: string;
  icon: string;
  status: "done" | "pending" | "skipped";
  reason: string;
}

export type TvCandidateState = "eligible" | "checked" | "excluded" | "selected";

export interface TvCandidateEntry {
  employeeId: number;
  employeeName: string;
  shiftLabel: string | null;
  roles: string[];
  currentLoad: number;
  state: TvCandidateState;
  reason: string;
}

export interface TvSelectedCandidate {
  employeeId: number;
  employeeName: string;
  shiftLabel: string | null;
  roles: string[];
  currentLoad: number;
}

export interface TvAssignmentTrace {
  ticket: TvAssignmentTicket;
  classification: TvAssignmentClassification;
  decisionSteps: TvDecisionStep[];
  candidatePool: TvCandidateEntry[];
  selectedCandidate: TvSelectedCandidate;
  finalReasons: string[];
  mode?: string | null;
  modeLabel?: string;
  decidedAt: string;
  runId: number;
}

export interface TvAssignmentTraceResponse {
  available: boolean;
  trace: TvAssignmentTrace | null;
}
