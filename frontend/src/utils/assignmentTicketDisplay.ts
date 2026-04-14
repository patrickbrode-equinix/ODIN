import type { AssignmentDecision, TicketExplanationStructured } from '../types/assignment';

type TicketShape = Partial<AssignmentDecision & TicketExplanationStructured> & {
  ticketId?: string | null;
  externalId?: string | null;
  displayTicketNumber?: string | null;
  normalized_ticket?: Record<string, unknown> | null;
  raw_ticket?: Record<string, unknown> | null;
  normalizedTicket?: Record<string, unknown> | null;
  rawTicket?: Record<string, unknown> | null;
};

function readString(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function readObjectValue(source: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!source || !(key in source)) return null;
  return readString(source[key]);
}

export function getAssignmentDisplayTicketNumber(source: TicketShape): string {
  const normalized = source.normalizedTicket || source.normalized_ticket || null;
  const raw = source.rawTicket || source.raw_ticket || null;

  return (
    readString(source.displayTicketNumber) ||
    readString(source.external_id) ||
    readString(source.externalId) ||
    readObjectValue(normalized, 'externalId') ||
    readObjectValue(raw, 'external_id') ||
    readObjectValue(raw, 'ticketNumber') ||
    readObjectValue(raw, 'ticket') ||
    readObjectValue(raw, 'Ticket') ||
    readObjectValue(raw, 'activity_no') ||
    readObjectValue(raw, 'ACTIVITY_NO') ||
    readObjectValue(raw, 'Activity #') ||
    readString(source.ticket_id) ||
    readString(source.ticketId) ||
    readObjectValue(normalized, 'id') ||
    readObjectValue(raw, 'id') ||
    'Unbekannt'
  );
}

export function getAssignmentInternalTicketId(source: TicketShape): string | null {
  const normalized = source.normalizedTicket || source.normalized_ticket || null;
  const raw = source.rawTicket || source.raw_ticket || null;

  return (
    readString(source.ticket_id) ||
    readString(source.ticketId) ||
    readObjectValue(normalized, 'id') ||
    readObjectValue(raw, 'id') ||
    null
  );
}

export function getAssignmentQueueOrigin(source: TicketShape): string | null {
  const normalized = source.normalizedTicket || source.normalized_ticket || null;
  const raw = source.rawTicket || source.raw_ticket || null;

  return (
    readString(source.queueOrigin) ||
    readObjectValue(normalized, 'queue') ||
    readObjectValue(raw, 'queue_type') ||
    readObjectValue(raw, 'queue') ||
    readObjectValue(raw, 'type') ||
    null
  );
}

export function getAssignmentSystemName(source: TicketShape): string | null {
  const normalized = source.normalizedTicket || source.normalized_ticket || null;
  const raw = source.rawTicket || source.raw_ticket || null;

  return (
    readObjectValue(normalized, 'systemName') ||
    readObjectValue(raw, 'system_name') ||
    readObjectValue(raw, 'systemName') ||
    null
  );
}

export function getAssignmentTicketCategory(source: TicketShape): string | null {
  const normalized = source.normalizedTicket || source.normalized_ticket || null;
  const raw = source.rawTicket || source.raw_ticket || null;

  return (
    readString(source.ticket_type) ||
    readObjectValue(normalized, 'type') ||
    readObjectValue(raw, 'queue_type') ||
    readObjectValue(raw, 'ticket_type') ||
    readObjectValue(raw, 'subtype') ||
    null
  );
}