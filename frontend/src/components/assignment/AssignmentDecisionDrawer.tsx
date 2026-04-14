/* ================================================ */
/* ODIN-Logik — Decision Drawer (Right Side Panel)  */
/* ================================================ */

import { useAssignmentStore } from '../../store/assignmentStore';
import { AssignmentExplanationCard } from './AssignmentExplanationCard';
import { X, CheckCircle2, HelpCircle, Ban, AlertTriangle, XCircle } from 'lucide-react';
import { getAssignmentDisplayTicketNumber, getAssignmentInternalTicketId, getAssignmentSystemName, getAssignmentTicketCategory } from '../../utils/assignmentTicketDisplay';

const RESULT_INFO: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  assigned: { label: 'Zugewiesen', color: 'text-green-400', icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, description: 'Ticket wurde erfolgreich einem Mitarbeiter zugewiesen.' },
  manual_review: { label: 'Manual Review', color: 'text-amber-400', icon: <HelpCircle className="w-4 h-4 text-amber-400" />, description: 'Kein automatisch geeigneter Kandidat. Dispatcher muss manuell entscheiden.' },
  no_candidate: { label: 'Kein Kandidat', color: 'text-orange-400', icon: <AlertTriangle className="w-4 h-4 text-orange-400" />, description: 'Nach Anwendung aller Regeln blieb kein zulässiger Mitarbeiter übrig.' },
  not_relevant: { label: 'Nicht relevant', color: 'text-zinc-400', icon: <Ban className="w-4 h-4 text-zinc-400" />, description: 'Ticket hat die Vorprüfung nicht bestanden.' },
  blocked: { label: 'Gesperrt', color: 'text-red-300', icon: <Ban className="w-4 h-4 text-red-300" />, description: 'Ticket durch manuellen Override blockiert.' },
  error: { label: 'Fehler', color: 'text-red-400', icon: <XCircle className="w-4 h-4 text-red-400" />, description: 'Technischer Fehler bei der Verarbeitung.' },
};

export function AssignmentDecisionDrawer() {
  const {
    drawerOpen,
    closeDrawer,
    selectedDecision,
    selectedTicketExplanation,
    loading,
  } = useAssignmentStore();

  if (!drawerOpen) return null;

  const ri = selectedDecision ? (RESULT_INFO[selectedDecision.result] || RESULT_INFO.error) : null;
  const displayTicketNumber = selectedDecision ? getAssignmentDisplayTicketNumber(selectedDecision) : null;
  const internalTicketId = selectedDecision ? getAssignmentInternalTicketId(selectedDecision) : null;
  const systemName = selectedDecision ? getAssignmentSystemName(selectedDecision) : null;
  const ticketCategory = selectedDecision ? getAssignmentTicketCategory(selectedDecision) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={closeDrawer}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-card border-l border-border/40 shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ticket-Erklärung</h3>
            {selectedDecision && (
              <div className="text-xs text-muted-foreground mt-0.5">
                Ticket: {displayTicketNumber}
                {internalTicketId && internalTicketId !== displayTicketNumber && ` • DB-ID ${internalTicketId}`}
              </div>
            )}
          </div>
          <button
            onClick={closeDrawer}
            className="p-1.5 rounded-md hover:bg-accent/50 transition text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Result Summary Bar */}
        {selectedDecision && ri && (
          <div className="px-4 py-3 border-b border-border/30 bg-background/40">
            <div className="flex items-center gap-2 mb-2">
              {ri.icon}
              <span className={`text-sm font-semibold ${ri.color}`}>{ri.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{ri.description}</p>
            {(systemName || ticketCategory) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                {systemName && <span className="rounded-full border border-border/30 bg-background/60 px-2 py-1">System: {systemName}</span>}
                {ticketCategory && <span className="rounded-full border border-border/30 bg-background/60 px-2 py-1">Kategorie: {ticketCategory}</span>}
              </div>
            )}
            {selectedDecision.short_reason && (
              <div className="mt-2 rounded-md bg-background/60 border border-border/30 px-3 py-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Hauptgrund</div>
                <p className="text-xs text-foreground">{selectedDecision.short_reason}</p>
              </div>
            )}
            {selectedDecision.error_message && (
              <div className="mt-2 rounded-md bg-red-500/5 border border-red-500/20 px-3 py-2">
                <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-0.5">Fehlermeldung</div>
                <p className="text-xs text-red-300">{selectedDecision.error_message}</p>
              </div>
            )}
            {selectedDecision.selection_reason && (
              <div className="mt-2 rounded-md bg-background/60 border border-border/30 px-3 py-2">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Auswahlgrund</div>
                <p className="text-xs text-foreground">{selectedDecision.selection_reason}</p>
              </div>
            )}
            {selectedDecision.rule_path && selectedDecision.rule_path.length > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider mr-1">Regelpfad:</span>
                {selectedDecision.rule_path.map((step, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground/50">→</span>}
                    <span className="px-1.5 py-0.5 rounded bg-background/60 border border-border/30 text-[10px]">{step}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
            </div>
          ) : selectedTicketExplanation ? (
            <AssignmentExplanationCard explanation={selectedTicketExplanation} />
          ) : selectedDecision ? (
            <div className="text-sm text-muted-foreground">
              Keine detaillierte Erklärung verfügbar.
              <pre className="mt-4 text-xs bg-background/60 rounded p-2 overflow-auto max-h-96">
                {JSON.stringify(selectedDecision, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Wählen Sie eine Entscheidung aus der Tabelle.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
