/* ================================================ */
/* ODIN-Logik — Run Table                           */
/* ================================================ */

import { useAssignmentStore } from '../../store/assignmentStore';
import type { AssignmentRun } from '../../types/assignment';
import { ChevronRight, AlertCircle } from 'lucide-react';
import { InfoTooltip } from '../ui/InfoTooltip';

/* ---- German failure reason mapping ---- */
const FAILURE_REASON_MAP: Record<string, string> = {
  crawler_stale: 'Crawler-Daten zu alt',
  no_eligible_workers: 'Keine gültigen Kandidaten gefunden',
  config_invalid: 'Engine-Konfiguration ungültig',
  config_missing: 'Pflichtkonfiguration fehlt',
  critical_error_stop: 'Run wegen kritischem Fehler gestoppt',
  ticket_data_incomplete: 'Ticketdaten unvollständig',
  no_workers_after_role_check: 'Kein zulässiger Mitarbeiter nach Rollenprüfung',
  all_candidates_excluded: 'Site-/Bereichsregeln schließen alle Kandidaten aus',
  technical_error: 'Technischer Fehler beim Laden der Run-Daten',
  live_not_enabled: 'Live-Modus nicht freigeschaltet',
};

const ERROR_CATEGORY_LABELS: Record<string, { label: string; className: string }> = {
  technical_error: { label: 'Technisch', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
  business_rule: { label: 'Fachlich', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  controlled_stop: { label: 'Kontrolliert', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  critical_error_stop: { label: 'Kritisch', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

function getFailureDisplay(run: AssignmentRun): string | null {
  if (run.status !== 'failed' && run.status !== 'cancelled') return null;
  if (run.failure_reason) return run.failure_reason;
  // Fallback: try to derive from summary
  const summary = run.summary as Record<string, unknown> | null;
  if (summary?.crawlerStale) return FAILURE_REASON_MAP.crawler_stale;
  return 'Unbekannter Fehler';
}

const statusBadge: Record<string, { className: string; label: string }> = {
  running: { className: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Läuft' },
  completed: { className: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Abgeschlossen' },
  failed: { className: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Fehlgeschlagen' },
  cancelled: { className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', label: 'Abgebrochen' },
};

const modeBadge: Record<string, { className: string }> = {
  shadow: { className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  live: { className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'dry-run': { className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

function Badge({ text, className }: { text: string; className: string }) {
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${className}`}>
      {text}
    </span>
  );
}

interface Props {
  runs: AssignmentRun[];
}

export function AssignmentRunTable({ runs }: Props) {
  const { selectRun } = useAssignmentStore();

  if (runs.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Keine Runs vorhanden. Starten Sie einen Shadow-Run.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30 text-xs text-muted-foreground">
            <th className="text-left px-3 py-2 font-medium">ID</th>
            <th className="text-left px-3 py-2 font-medium">Modus</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="text-left px-3 py-2 font-medium">
              <span className="flex items-center gap-1">
                Grund
                <InfoTooltip title="Fehlgrund / Ursache" side="bottom">
                  <p>Zeigt bei fehlgeschlagenen oder abgebrochenen Runs eine verständliche Begründung, warum der Lauf nicht erfolgreich abgeschlossen wurde.</p>
                  <p><strong>Kategorien:</strong></p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    <li><strong>Technisch:</strong> API-/DB-Fehler, Validierungsfehler, unerwartete Ausnahme</li>
                    <li><strong>Fachlich:</strong> Keine Kandidaten, Tickettyp nicht unterstützt, Regeln blockieren</li>
                    <li><strong>Kontrolliert:</strong> Crawler-Daten veraltet, Pflichtkonfiguration fehlt</li>
                    <li><strong>Kritisch:</strong> Stop bei kritischem Fehler aktiv</li>
                  </ul>
                </InfoTooltip>
              </span>
            </th>
            <th className="text-left px-3 py-2 font-medium">Gestartet</th>
            <th className="text-right px-3 py-2 font-medium">Tickets</th>
            <th className="text-right px-3 py-2 font-medium">Assigned</th>
            <th className="text-right px-3 py-2 font-medium">Review</th>
            <th className="text-right px-3 py-2 font-medium">Errors</th>
            <th className="text-left px-3 py-2 font-medium">Ausgelöst von</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const sb = statusBadge[run.status] || statusBadge.completed;
            const mb = modeBadge[run.mode] || modeBadge.shadow;
            const failureDisplay = getFailureDisplay(run);
            const errCat = run.error_category ? ERROR_CATEGORY_LABELS[run.error_category] : null;
            return (
              <tr
                key={run.id}
                className="border-b border-border/20 hover:bg-accent/30 cursor-pointer transition"
                onClick={() => selectRun(run.id)}
              >
                <td className="px-3 py-2 font-mono text-xs">#{run.id}</td>
                <td className="px-3 py-2"><Badge text={run.mode} className={mb.className} /></td>
                <td className="px-3 py-2"><Badge text={sb.label} className={sb.className} /></td>
                <td className="px-3 py-2 max-w-[250px]">
                  {failureDisplay ? (
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="text-xs text-red-300 truncate" title={failureDisplay}>
                        {failureDisplay.length > 50 ? failureDisplay.slice(0, 47) + '…' : failureDisplay}
                      </span>
                      {errCat && (
                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded border shrink-0 ${errCat.className}`}>
                          {errCat.label}
                        </span>
                      )}
                      {failureDisplay.length > 50 && (
                        <span onClick={(e) => e.stopPropagation()}>
                          <InfoTooltip title="Vollständiger Fehlgrund" side="left" width="w-96">
                            <p>{failureDisplay}</p>
                            {run.failure_step && <p className="mt-1"><strong>Fehlgeschlagener Schritt:</strong> {run.failure_step}</p>}
                            {run.error_category && <p><strong>Kategorie:</strong> {run.error_category}</p>}
                          </InfoTooltip>
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">–</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(run.started_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-3 py-2 text-right">{run.total_tickets}</td>
                <td className="px-3 py-2 text-right text-green-400">{run.assigned}</td>
                <td className="px-3 py-2 text-right text-amber-400">{run.manual_review}</td>
                <td className="px-3 py-2 text-right text-red-400">{run.errors}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[120px]">
                  {run.triggered_by || '–'}
                </td>
                <td className="px-3 py-2">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
