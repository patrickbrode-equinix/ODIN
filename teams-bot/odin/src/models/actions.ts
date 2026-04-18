/**
 * Action types and payloads for Adaptive Card button interactions.
 * Structured so the callback service can route them correctly.
 */

// ── Action Type Constants ──

export const ACTION_TYPES = {
  TICKET_ACCEPT: "ticket.accept",
  TICKET_REJECT: "ticket.reject",
  TICKET_QUESTION: "ticket.question",
  SHIFT_ACCEPT: "shift.accept",
  SHIFT_REJECT: "shift.reject",
  SUPERVISOR_APPROVE: "supervisor.approve",
  SUPERVISOR_REJECT: "supervisor.reject",
  VERIFICATION_YES: "verification.yes",
  VERIFICATION_NO: "verification.no",
  VERIFICATION_SICK: "verification.sick",
  VERIFICATION_WRONG_SHIFT: "verification.wrong_shift",
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

// ── Inbound Action Payload (from Teams card submission) ──

export interface CardActionPayload {
  /** The action type identifier */
  action: ActionType;
  /** The entity this action refers to (ticketId, shiftId, etc.) */
  entityId: string;
  /** Additional context included by the card */
  context?: Record<string, unknown>;
}

// ── Callback Payloads (Bot → ODIN) ──

export interface TicketActionCallback {
  action: "ticket.accept" | "ticket.reject" | "ticket.question";
  ticketId: string;
  employeeId?: string;
  teamsUserId: string;
  aadObjectId?: string;
  displayName: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface ShiftActionCallback {
  action: "shift.accept" | "shift.reject";
  shiftId: string;
  employeeId?: string;
  teamsUserId: string;
  aadObjectId?: string;
  displayName: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface SupervisorActionCallback {
  action: "supervisor.approve" | "supervisor.reject";
  entityId: string;
  supervisorTeamsUserId: string;
  supervisorAadObjectId?: string;
  supervisorDisplayName: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// ── Inbound Notify Payloads (ODIN → Bot) ──

export interface TicketNotifyPayload {
  employeeId?: string;
  email?: string;
  ticketId: string;
  ticketType: string;
  priority: string;
  systemName: string;
  accountName?: string;
  remainingMinutes?: number;
  commitAt?: string;
  ownerSuggestion?: string;
  reason?: string;
}

export interface ShiftOpenNotifyPayload {
  shiftId: string;
  title: string;
  message?: string;
  startAt: string;
  endAt: string;
  location?: string;
  candidateEmployeeIds?: string[];
  channelKey?: string;
  requiresSupervisorApproval?: boolean;
}

export interface SupervisorApprovalPayload {
  entityId: string;
  entityType: "shift_swap" | "shift_pickup" | "overtime" | string;
  employeeName: string;
  shiftLabel?: string;
  startAt?: string;
  endAt?: string;
  supervisorEmployeeId: string;
  reason?: string;
}

// ── Shift Verification Payloads ──

export interface VerificationNotifyPayload {
  employeeName: string;
  shiftCode: string;
  date: string;
  /** Optional: resolved employee ID for user mapping lookup */
  employeeId?: string;
  /** Optional: email fallback for Graph resolution */
  email?: string;
}

export interface VerificationActionCallback {
  action: "verification.yes" | "verification.sick" | "verification.wrong_shift";
  employeeName: string;
  date: string;
  shiftCode: string;
  /** Maps to: 'yes' | 'sick' | 'wrong_shift' */
  response: string;
  teamsUserId: string;
  aadObjectId?: string;
  displayName: string;
  timestamp: string;
}
