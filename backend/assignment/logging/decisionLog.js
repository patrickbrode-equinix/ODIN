/* ================================================ */
/* Assignment Engine — Decision Logging             */
/* ================================================ */

function snapshotCandidate(candidate) {
  if (!candidate) return candidate;

  const snapshot = {
    id: candidate.id,
    name: candidate.name,
  };

  if (candidate.role != null) snapshot.role = candidate.role;
  if (candidate.weekplanRole != null) snapshot.weekplanRole = candidate.weekplanRole;
  if (candidate.shiftCode != null) snapshot.shiftCode = candidate.shiftCode;
  if (candidate.shiftActive != null) snapshot.shiftActive = candidate.shiftActive;
  if (candidate.planningSource != null) snapshot.planningSource = candidate.planningSource;
  if (candidate.userMapped != null) snapshot.userMapped = candidate.userMapped;
  if (candidate.plannedEmployeeName != null) snapshot.plannedEmployeeName = candidate.plannedEmployeeName;

  return snapshot;
}

function getDisplayTicketNumber(source) {
  const normalized = source.normalizedTicket || source.normalized_ticket || {};
  const raw = source.rawTicket || source.raw_ticket || {};

  return (
    source.displayTicketNumber ||
    source.externalId ||
    source.external_id ||
    normalized.externalId ||
    raw.external_id ||
    raw.ticketNumber ||
    raw.ticket ||
    raw.Ticket ||
    raw.activity_no ||
    raw.ACTIVITY_NO ||
    raw['Activity #'] ||
    source.ticketId ||
    source.ticket_id ||
    normalized.id ||
    raw.id ||
    null
  );
}

function getQueueOrigin(source) {
  const normalized = source.normalizedTicket || source.normalized_ticket || {};
  const raw = source.rawTicket || source.raw_ticket || {};
  return source.queueOrigin || normalized.queue || raw.queue_type || raw.queue || raw.type || null;
}

/**
 * Build a decision log entry for a single ticket.
 */
export function buildDecisionLog({
  ticket,
  result,
  assignedWorker,
  selectionReason,
  rulePath,
  initialCandidates,
  excludedCandidates,
  remainingCandidates,
  errorMessage,
}) {
  return {
    ticketId: ticket.id,
    externalId: ticket.externalId,
    ticketType: ticket.type,
    ticketStatus: ticket.status,
    ticketPriority: ticket.priority,
    ticketSite: ticket.site,
    result,
    assignedWorkerId: assignedWorker?.id ?? null,
    assignedWorkerName: assignedWorker?.name ?? null,
    selectionReason: selectionReason || null,
    shortReason: buildShortReason(result, assignedWorker, selectionReason),
    rulePath: rulePath || [],
    initialCandidates: (initialCandidates || []).map(snapshotCandidate),
    excludedCandidates: (excludedCandidates || []).map(candidate => ({
      ...snapshotCandidate(candidate),
      reason: candidate.reason,
      rule: candidate.rule || null,
    })),
    remainingCandidates: (remainingCandidates || []).map(snapshotCandidate),
    normalizationWarnings: ticket.normalizationWarnings || [],
    normalizedTicket: ticket,
    rawTicket: ticket.raw || {},
    errorMessage: errorMessage || null,
  };
}

/**
 * Build a short, human-readable reason string.
 */
function buildShortReason(result, assignedWorker, selectionReason) {
  switch (result) {
    case 'assigned':
      return `Zugewiesen an ${assignedWorker?.name || 'Unbekannt'}: ${selectionReason || 'regelbasiert'}`;
    case 'manual_review':
      return selectionReason || 'Manuelle Prüfung erforderlich';
    case 'no_candidate':
      return selectionReason || 'Kein geeigneter Kandidat verfügbar';
    case 'not_relevant':
      return 'Ticket nicht relevant für Zuweisung';
    case 'blocked':
      return 'Ticket gesperrt';
    case 'error':
      return 'Fehler bei der Verarbeitung';
    default:
      return result;
  }
}

/**
 * Build a human-readable summary for a full run.
 */
export function buildRunSummary(decisions, extras = {}) {
  const counts = { assigned: 0, manual_review: 0, no_candidate: 0, not_relevant: 0, blocked: 0, error: 0 };
  for (const d of decisions) {
    if (counts[d.result] !== undefined) {
      counts[d.result]++;
    }
  }
  return {
    totalDecisions: decisions.length,
    ...counts,
    ...extras,
  };
}

/**
 * Build a full human-readable explanation for a ticket decision.
 * This is the core of the explainability requirement.
 */
export function buildTicketExplanation(decision) {
  const lines = [];
  const displayTicketNumber = getDisplayTicketNumber(decision) || decision.ticketId || decision.ticket_id;
  const internalTicketId = decision.ticketId || decision.ticket_id;
  const queueOrigin = getQueueOrigin(decision);
  const normalizedTicket = decision.normalizedTicket || decision.normalized_ticket || null;
  const rawTicket = decision.rawTicket || decision.raw_ticket || null;

  lines.push(`## Ticket ${displayTicketNumber}`);
  if (internalTicketId && String(internalTicketId) !== String(displayTicketNumber)) {
    lines.push(`Interne ID: ${internalTicketId}`);
  }
  if (decision.externalId || decision.external_id) {
    lines.push(`Externe ID: ${decision.externalId || decision.external_id}`);
  }
  if (queueOrigin) {
    lines.push(`Queue: ${queueOrigin}`);
  }
  lines.push('');

  // Result
  lines.push(`### Ergebnis: ${decision.result}`);
  lines.push(decision.shortReason || decision.short_reason || '');
  lines.push('');

  // Ticket Details
  lines.push('### Ticket-Details');
  lines.push(`- Typ: ${decision.ticketType || decision.ticket_type || 'N/A'}`);
  lines.push(`- Status: ${decision.ticketStatus || decision.ticket_status || 'N/A'}`);
  lines.push(`- Priorität: ${decision.ticketPriority || decision.ticket_priority || 'N/A'}`);
  lines.push(`- Site: ${decision.ticketSite || decision.ticket_site || 'N/A'}`);
  if (queueOrigin) lines.push(`- Queue: ${queueOrigin}`);
  lines.push('');

  // Normalization warnings
  const warnings = decision.normalizationWarnings || decision.normalization_warnings || [];
  if (warnings.length > 0) {
    lines.push('### Normalisierungs-Warnungen');
    for (const w of warnings) lines.push(`- ⚠️ ${w}`);
    lines.push('');
  }

  // Candidates
  const initial = decision.initialCandidates || decision.initial_candidates || [];
  lines.push(`### Initiale Kandidaten (${initial.length})`);
  if (initial.length === 0) {
    lines.push('Keine Kandidaten geladen.');
  } else {
    for (const c of initial) {
      const details = [c.shiftCode, c.weekplanRole || c.role].filter(Boolean).join(' | ');
      lines.push(`- ${c.name} (ID: ${c.id})${details ? ` [${details}]` : ''}`);
    }
  }
  lines.push('');

  // Excluded
  const excluded = decision.excludedCandidates || decision.excluded_candidates || [];
  if (excluded.length > 0) {
    lines.push(`### Ausgeschlossene Kandidaten (${excluded.length})`);
    for (const e of excluded) {
      const details = [e.shiftCode, e.weekplanRole || e.role].filter(Boolean).join(' | ');
      lines.push(`- ❌ ${e.name || 'ID:' + e.id}${details ? ` [${details}]` : ''}: ${e.reason}`);
    }
    lines.push('');
  }

  // Remaining
  const remaining = decision.remainingCandidates || decision.remaining_candidates || [];
  lines.push(`### Verbleibende Kandidaten (${remaining.length})`);
  if (remaining.length === 0) {
    lines.push('Keine Kandidaten übrig.');
  } else {
    for (const c of remaining) {
      const details = [c.shiftCode, c.weekplanRole || c.role].filter(Boolean).join(' | ');
      lines.push(`- ✅ ${c.name} (ID: ${c.id})${details ? ` [${details}]` : ''}`);
    }
  }
  lines.push('');

  // Selection
  if (decision.result === 'assigned') {
    lines.push('### Auswahl');
    lines.push(`Ausgewählt: **${decision.assignedWorkerName || decision.assigned_worker_name || 'N/A'}**`);
    lines.push(`Begründung: ${decision.selectionReason || decision.selection_reason || 'N/A'}`);
    lines.push('');
  }

  // Rule Path
  const rulePath = decision.rulePath || decision.rule_path || [];
  if (rulePath.length > 0) {
    lines.push('### Regelreihenfolge');
    for (let i = 0; i < rulePath.length; i++) {
      lines.push(`${i + 1}. ${rulePath[i]}`);
    }
    lines.push('');
  }

  // Error
  if (decision.errorMessage || decision.error_message) {
    lines.push('### Fehler');
    lines.push(decision.errorMessage || decision.error_message);
  }

  if (normalizedTicket) {
    lines.push('');
    lines.push('### Normalisiertes Ticket');
    lines.push('```json');
    lines.push(JSON.stringify(normalizedTicket, null, 2));
    lines.push('```');
  }

  if (rawTicket) {
    lines.push('');
    lines.push('### Raw Ticket');
    lines.push('```json');
    lines.push(JSON.stringify(rawTicket, null, 2));
    lines.push('```');
  }

  return {
    markdown: lines.join('\n'),
    structured: {
      displayTicketNumber,
      ticketId: decision.ticketId || decision.ticket_id,
      externalId: decision.externalId || decision.external_id,
      queueOrigin,
      result: decision.result,
      shortReason: decision.shortReason || decision.short_reason,
      ticketType: decision.ticketType || decision.ticket_type,
      ticketStatus: decision.ticketStatus || decision.ticket_status,
      ticketPriority: decision.ticketPriority || decision.ticket_priority,
      ticketSite: decision.ticketSite || decision.ticket_site,
      normalizationWarnings: warnings,
      initialCandidates: initial,
      excludedCandidates: excluded,
      remainingCandidates: remaining,
      assignedWorkerName: decision.assignedWorkerName || decision.assigned_worker_name,
      assignedWorkerId: decision.assignedWorkerId || decision.assigned_worker_id,
      selectionReason: decision.selectionReason || decision.selection_reason,
      rulePath,
      errorMessage: decision.errorMessage || decision.error_message,
      normalizedTicket,
      rawTicket,
    },
  };
}
