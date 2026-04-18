/* ================================================ */
/* ODIN-Logik — Explanation Card (Structured)       */
/* ================================================ */

import type { TicketExplanation, ExcludedCandidateGroup, CandidateRef } from '../../types/assignment';
import { CheckCircle, XCircle, AlertTriangle, Info, ListOrdered, Users, UserCheck } from 'lucide-react';
import { getAssignmentDisplayTicketNumber, getAssignmentInternalTicketId, getAssignmentQueueOrigin } from '../../utils/assignmentTicketDisplay';
import { useLanguage } from '../../context/LanguageContext';

interface Props {
  explanation: TicketExplanation;
}

export function AssignmentExplanationCard({ explanation }: Props) {
  const { language } = useLanguage();
  const isGerman = language === 'de';

  if (!explanation.found || !explanation.explanation) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {explanation.message || (isGerman ? 'Keine Erklärung verfügbar.' : 'No explanation available.')}
      </div>
    );
  }

  const s = explanation.explanation.structured;

  const resultStyles: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
    assigned: { label: isGerman ? 'Zugewiesen' : 'Assigned', className: 'text-green-400', icon: CheckCircle },
    manual_review: { label: isGerman ? 'Manuelle Prüfung' : 'Manual review', className: 'text-amber-400', icon: AlertTriangle },
    no_candidate: { label: isGerman ? 'Kein Kandidat' : 'No candidate', className: 'text-orange-400', icon: XCircle },
    not_relevant: { label: isGerman ? 'Nicht relevant' : 'Not relevant', className: 'text-zinc-400', icon: Info },
    blocked: { label: isGerman ? 'Gesperrt' : 'Blocked', className: 'text-red-400', icon: XCircle },
    error: { label: isGerman ? 'Fehler' : 'Error', className: 'text-red-400', icon: XCircle },
  };
  const rs = resultStyles[s.result] || resultStyles.error;
  const ResultIcon = rs.icon;
  const displayTicketNumber = getAssignmentDisplayTicketNumber(s);
  const internalTicketId = getAssignmentInternalTicketId(s);
  const queueOrigin = getAssignmentQueueOrigin(s);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ResultIcon className={`w-5 h-5 ${rs.className}`} />
        <div>
          <div className="text-sm font-semibold text-foreground">{rs.label}</div>
          <div className="text-xs text-muted-foreground">{s.shortReason}</div>
        </div>
      </div>

      {/* Ticket Details */}
      <Section title={isGerman ? 'Ticket-Details' : 'Ticket details'} icon={Info}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">{isGerman ? 'Ticketnummer' : 'Ticket number'}</dt>
          <dd className="font-mono">{displayTicketNumber}</dd>
          {internalTicketId && internalTicketId !== displayTicketNumber && (<><dt className="text-muted-foreground">{isGerman ? 'Interne ID' : 'Internal ID'}</dt><dd className="font-mono">{internalTicketId}</dd></>)}
          {s.externalId && (<><dt className="text-muted-foreground">{isGerman ? 'Externe ID' : 'External ID'}</dt><dd className="font-mono">{s.externalId}</dd></>)}
          {queueOrigin && (<><dt className="text-muted-foreground">Queue</dt><dd>{queueOrigin}</dd></>)}
          <dt className="text-muted-foreground">{isGerman ? 'Typ' : 'Type'}</dt>
          <dd>{s.ticketType || '–'}</dd>
          <dt className="text-muted-foreground">{isGerman ? 'Status' : 'Status'}</dt>
          <dd>{s.ticketStatus || '–'}</dd>
          <dt className="text-muted-foreground">{isGerman ? 'Priorität' : 'Priority'}</dt>
          <dd>{s.ticketPriority || '–'}</dd>
          <dt className="text-muted-foreground">Site</dt>
          <dd>{s.ticketSite || '–'}</dd>
          <dt className="text-muted-foreground">{isGerman ? 'Modus' : 'Mode'}</dt>
          <dd>{s.mode || s.ticketContext?.mode || '–'}</dd>
        </dl>
      </Section>

      <Section title={isGerman ? 'Ticketkontext' : 'Ticket context'} icon={Info}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">System</dt>
          <dd>{s.ticketContext?.systemName || '–'}</dd>
          <dt className="text-muted-foreground">{isGerman ? 'Aktivität' : 'Activity'}</dt>
          <dd>{s.ticketContext?.activity || '–'}</dd>
          <dt className="text-muted-foreground">{isGerman ? 'Aktueller Owner' : 'Current owner'}</dt>
          <dd>{s.ticketContext?.currentOwner || '–'}</dd>
          <dt className="text-muted-foreground">{isGerman ? 'Vorgeschlagener Owner' : 'Suggested owner'}</dt>
          <dd>{s.ticketContext?.recommendedOwner || '–'}</dd>
          <dt className="text-muted-foreground">{isGerman ? 'Restzeit' : 'Remaining time'}</dt>
          <dd>{s.ticketContext?.remainingTimeLabel || '–'}</dd>
          <dt className="text-muted-foreground">Commit / Due</dt>
          <dd>{s.ticketContext?.dueAt || '–'}</dd>
          <dt className="text-muted-foreground">Revised Commit</dt>
          <dd>{s.ticketContext?.revisedCommitDate || '–'}</dd>
          <dt className="text-muted-foreground">Sched. Start</dt>
          <dd>{s.ticketContext?.scheduledStart || '–'}</dd>
        </dl>
      </Section>

      {s.decisionTrace.length > 0 && (
        <Section title={isGerman ? 'Entscheidungsweg' : 'Decision trace'} icon={ListOrdered}>
          <ol className="space-y-2">
            {s.decisionTrace.map((step) => (
              <li key={step.key} className="rounded-md border border-border/20 bg-background/40 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground/90">{step.label}</span>
                  <span className="uppercase tracking-wider text-[10px] text-muted-foreground">{step.status}</span>
                </div>
                <div className="mt-1 text-muted-foreground">{step.reason}</div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Normalization Warnings */}
      {s.normalizationWarnings.length > 0 && (
        <Section title={isGerman ? 'Normalisierungs-Warnungen' : 'Normalization warnings'} icon={AlertTriangle}>
          <ul className="space-y-0.5">
            {s.normalizationWarnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Initial Candidates */}
      <Section title={`${isGerman ? 'Initiale Kandidaten' : 'Initial candidates'} (${s.initialCandidates.length})`} icon={Users}>
        {s.initialCandidates.length === 0 ? (
          <div className="text-xs text-muted-foreground">{isGerman ? 'Keine Kandidaten geladen.' : 'No candidates loaded.'}</div>
        ) : (
          <ul className="space-y-0.5">
            {s.initialCandidates.map((c: CandidateRef) => (
              <li key={c.id} className="text-xs text-foreground/80">
                {c.name} <span className="text-muted-foreground">(ID: {c.id})</span>
                {(c.shiftCode || c.weekplanRole || c.role) && (
                  <span className="text-muted-foreground"> • {[c.shiftCode, c.weekplanRole || c.role].filter(Boolean).join(' | ')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Excluded Candidates */}
      {s.excludedCandidateGroups.length > 0 && (
        <Section title={`${isGerman ? 'Ausgeschlossen' : 'Excluded'} (${s.excludedCandidateGroups.length})`} icon={XCircle}>
          <ul className="space-y-1">
            {s.excludedCandidateGroups.map((e: ExcludedCandidateGroup, i: number) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-400" />
                <div>
                  <span className="font-medium text-foreground/80">{e.name || `ID: ${e.id}`}</span>
                  <span className="text-muted-foreground"> — {e.reasons.join('; ')}</span>
                  {(e.shiftCode || e.weekplanRole || e.role) && (
                    <span className="text-muted-foreground"> • {[e.shiftCode, e.weekplanRole || e.role].filter(Boolean).join(' | ')}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Remaining Candidates */}
      <Section title={`${isGerman ? 'Verbleibende Kandidaten' : 'Remaining candidates'} (${s.remainingCandidates.length})`} icon={UserCheck}>
        {s.remainingCandidates.length === 0 ? (
          <div className="text-xs text-muted-foreground">{isGerman ? 'Keine Kandidaten übrig.' : 'No candidates left.'}</div>
        ) : (
          <ul className="space-y-0.5">
            {s.remainingCandidates.map((c: CandidateRef) => (
              <li key={c.id} className="text-xs text-green-400/80">
                ✓ {c.name} <span className="text-muted-foreground">(ID: {c.id})</span>
                {(c.shiftCode || c.weekplanRole || c.role) && (
                  <span className="text-muted-foreground"> • {[c.shiftCode, c.weekplanRole || c.role].filter(Boolean).join(' | ')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Selection */}
      {s.result === 'assigned' && (
        <Section title={isGerman ? 'Auswahl' : 'Selection'} icon={CheckCircle}>
          <div className="text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">{isGerman ? 'Ausgewählt' : 'Selected'}: </span>
              <span className="font-semibold text-green-400">{s.assignedWorkerName}</span>
              {s.assignedWorkerId && <span className="text-muted-foreground"> (ID: {s.assignedWorkerId})</span>}
            </div>
            <div>
              <span className="text-muted-foreground">{isGerman ? 'Begründung' : 'Reason'}: </span>
              <span className="text-foreground/80">{s.selectionReason || '–'}</span>
            </div>
          </div>
        </Section>
      )}

      {/* Rule Path */}
      {s.rulePath.length > 0 && (
        <Section title={isGerman ? 'Regelreihenfolge' : 'Rule order'} icon={ListOrdered}>
          <ol className="space-y-0.5 list-decimal list-inside">
            {s.rulePath.map((rule: string, i: number) => (
              <li key={i} className="text-xs text-foreground/70">{rule}</li>
            ))}
          </ol>
        </Section>
      )}

      {/* Error Message */}
      {s.errorMessage && (
        <Section title={isGerman ? 'Fehler' : 'Error'} icon={XCircle}>
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
            {s.errorMessage}
          </div>
        </Section>
      )}

      {s.normalizedTicket && (
        <Section title={isGerman ? 'Normalisierte Ticketdaten' : 'Normalized ticket data'} icon={Info}>
          <pre className="text-[11px] leading-5 whitespace-pre-wrap break-all text-foreground/75">{JSON.stringify(s.normalizedTicket, null, 2)}</pre>
        </Section>
      )}

      {s.rawTicket && (
        <Section title={isGerman ? 'Rohes Ticket' : 'Raw ticket'} icon={Info}>
          <pre className="text-[11px] leading-5 whitespace-pre-wrap break-all text-foreground/75">{JSON.stringify(s.rawTicket, null, 2)}</pre>
        </Section>
      )}
    </div>
  );
}

/* ---- Reusable Section Component ---- */

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Info; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/30 bg-background/40">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground/80">{title}</span>
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}
