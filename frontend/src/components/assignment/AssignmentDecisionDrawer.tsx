/* ================================================ */
/* ODIN-Logik — Decision Drawer (Right Side Panel)  */
/* ================================================ */

import { useAssignmentStore } from '../../store/assignmentStore';
import { AssignmentExplanationCard } from './AssignmentExplanationCard';
import { X } from 'lucide-react';

export function AssignmentDecisionDrawer() {
  const {
    drawerOpen,
    closeDrawer,
    selectedDecision,
    selectedTicketExplanation,
    loading,
  } = useAssignmentStore();

  if (!drawerOpen) return null;

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
                Ticket: {selectedDecision.ticket_id}
                {selectedDecision.external_id && ` (${selectedDecision.external_id})`}
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
