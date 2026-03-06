/* ================================================ */
/* ODIN-Logik — Explanation Card (Structured)       */
/* ================================================ */

import type { TicketExplanation, ExcludedCandidate, CandidateRef } from '../../types/assignment';
import { CheckCircle, XCircle, AlertTriangle, Info, ListOrdered, Users, UserCheck } from 'lucide-react';

interface Props {
  explanation: TicketExplanation;
}

export function AssignmentExplanationCard({ explanation }: Props) {
  if (!explanation.found || !explanation.explanation) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {explanation.message || 'Keine Erklärung verfügbar.'}
      </div>
    );
  }

  const s = explanation.explanation.structured;

  const resultStyles: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
    assigned: { label: 'Zugewiesen', className: 'text-green-400', icon: CheckCircle },
    manual_review: { label: 'Manuelle Prüfung', className: 'text-amber-400', icon: AlertTriangle },
    no_candidate: { label: 'Kein Kandidat', className: 'text-orange-400', icon: XCircle },
    not_relevant: { label: 'Nicht relevant', className: 'text-zinc-400', icon: Info },
    blocked: { label: 'Gesperrt', className: 'text-red-400', icon: XCircle },
    error: { label: 'Fehler', className: 'text-red-400', icon: XCircle },
  };
  const rs = resultStyles[s.result] || resultStyles.error;
  const ResultIcon = rs.icon;

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
      <Section title="Ticket-Details" icon={Info}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Ticket-ID</dt>
          <dd className="font-mono">{s.ticketId}</dd>
          {s.externalId && (<><dt className="text-muted-foreground">Externe ID</dt><dd className="font-mono">{s.externalId}</dd></>)}
          <dt className="text-muted-foreground">Typ</dt>
          <dd>{s.ticketType || '–'}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{s.ticketStatus || '–'}</dd>
          <dt className="text-muted-foreground">Priorität</dt>
          <dd>{s.ticketPriority || '–'}</dd>
          <dt className="text-muted-foreground">Site</dt>
          <dd>{s.ticketSite || '–'}</dd>
        </dl>
      </Section>

      {/* Normalization Warnings */}
      {s.normalizationWarnings.length > 0 && (
        <Section title="Normalisierungs-Warnungen" icon={AlertTriangle}>
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
      <Section title={`Initiale Kandidaten (${s.initialCandidates.length})`} icon={Users}>
        {s.initialCandidates.length === 0 ? (
          <div className="text-xs text-muted-foreground">Keine Kandidaten geladen.</div>
        ) : (
          <ul className="space-y-0.5">
            {s.initialCandidates.map((c: CandidateRef) => (
              <li key={c.id} className="text-xs text-foreground/80">
                {c.name} <span className="text-muted-foreground">(ID: {c.id})</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Excluded Candidates */}
      {s.excludedCandidates.length > 0 && (
        <Section title={`Ausgeschlossen (${s.excludedCandidates.length})`} icon={XCircle}>
          <ul className="space-y-1">
            {s.excludedCandidates.map((e: ExcludedCandidate, i: number) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-400" />
                <div>
                  <span className="font-medium text-foreground/80">{e.name || `ID: ${e.id}`}</span>
                  <span className="text-muted-foreground"> — {e.reason}</span>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Remaining Candidates */}
      <Section title={`Verbleibende Kandidaten (${s.remainingCandidates.length})`} icon={UserCheck}>
        {s.remainingCandidates.length === 0 ? (
          <div className="text-xs text-muted-foreground">Keine Kandidaten übrig.</div>
        ) : (
          <ul className="space-y-0.5">
            {s.remainingCandidates.map((c: CandidateRef) => (
              <li key={c.id} className="text-xs text-green-400/80">
                ✓ {c.name} <span className="text-muted-foreground">(ID: {c.id})</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Selection */}
      {s.result === 'assigned' && (
        <Section title="Auswahl" icon={CheckCircle}>
          <div className="text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">Ausgewählt: </span>
              <span className="font-semibold text-green-400">{s.assignedWorkerName}</span>
              {s.assignedWorkerId && <span className="text-muted-foreground"> (ID: {s.assignedWorkerId})</span>}
            </div>
            <div>
              <span className="text-muted-foreground">Begründung: </span>
              <span className="text-foreground/80">{s.selectionReason || '–'}</span>
            </div>
          </div>
        </Section>
      )}

      {/* Rule Path */}
      {s.rulePath.length > 0 && (
        <Section title="Regelreihenfolge" icon={ListOrdered}>
          <ol className="space-y-0.5 list-decimal list-inside">
            {s.rulePath.map((rule: string, i: number) => (
              <li key={i} className="text-xs text-foreground/70">{rule}</li>
            ))}
          </ol>
        </Section>
      )}

      {/* Error Message */}
      {s.errorMessage && (
        <Section title="Fehler" icon={XCircle}>
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
            {s.errorMessage}
          </div>
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
