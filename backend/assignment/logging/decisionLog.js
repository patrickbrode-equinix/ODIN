/* ================================================ */
/* Assignment Engine — Decision Logging             */
/* ================================================ */

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
    initialCandidates: (initialCandidates || []).map(c => ({ id: c.id, name: c.name })),
    excludedCandidates: excludedCandidates || [],
    remainingCandidates: (remainingCandidates || []).map(c => ({ id: c.id, name: c.name })),
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
      return 'Manuelle Prüfung erforderlich';
    case 'no_candidate':
      return 'Kein geeigneter Kandidat verfügbar';
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
export function buildRunSummary(decisions) {
  const counts = { assigned: 0, manual_review: 0, no_candidate: 0, not_relevant: 0, blocked: 0, error: 0 };
  for (const d of decisions) {
    if (counts[d.result] !== undefined) {
      counts[d.result]++;
    }
  }
  return {
    totalDecisions: decisions.length,
    ...counts,
  };
}

/**
 * Build a full human-readable explanation for a ticket decision.
 * This is the core of the explainability requirement.
 */
export function buildTicketExplanation(decision) {
  const lines = [];

  lines.push(`## Ticket ${decision.ticketId || decision.ticket_id}`);
  if (decision.externalId || decision.external_id) {
    lines.push(`Externe ID: ${decision.externalId || decision.external_id}`);
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
    for (const c of initial) lines.push(`- ${c.name} (ID: ${c.id})`);
  }
  lines.push('');

  // Excluded
  const excluded = decision.excludedCandidates || decision.excluded_candidates || [];
  if (excluded.length > 0) {
    lines.push(`### Ausgeschlossene Kandidaten (${excluded.length})`);
    for (const e of excluded) {
      lines.push(`- ❌ ${e.name || 'ID:' + e.id}: ${e.reason}`);
    }
    lines.push('');
  }

  // Remaining
  const remaining = decision.remainingCandidates || decision.remaining_candidates || [];
  lines.push(`### Verbleibende Kandidaten (${remaining.length})`);
  if (remaining.length === 0) {
    lines.push('Keine Kandidaten übrig.');
  } else {
    for (const c of remaining) lines.push(`- ✅ ${c.name} (ID: ${c.id})`);
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

  return {
    markdown: lines.join('\n'),
    structured: {
      ticketId: decision.ticketId || decision.ticket_id,
      externalId: decision.externalId || decision.external_id,
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
    },
  };
}
