/* ================================================ */
/* ODIN-Logik — Decision Table                      */
/* ================================================ */

import { useAssignmentStore } from '../../store/assignmentStore';
import type { AssignmentDecision, DecisionResult } from '../../types/assignment';
import { Eye } from 'lucide-react';

const resultStyles: Record<DecisionResult, { label: string; className: string }> = {
  assigned: { label: 'Zugewiesen', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  manual_review: { label: 'Manual Review', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  no_candidate: { label: 'Kein Kandidat', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  not_relevant: { label: 'Nicht relevant', className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
  blocked: { label: 'Gesperrt', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
  error: { label: 'Fehler', className: 'bg-red-600/20 text-red-400 border-red-600/30' },
};

interface Props {
  decisions: AssignmentDecision[];
}

export function AssignmentDecisionTable({ decisions }: Props) {
  const { selectDecision } = useAssignmentStore();

  if (decisions.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Keine Entscheidungen vorhanden.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30 text-xs text-muted-foreground">
            <th className="text-left px-3 py-2 font-medium">Ticket-ID</th>
            <th className="text-left px-3 py-2 font-medium">Typ</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="text-left px-3 py-2 font-medium">Site</th>
            <th className="text-left px-3 py-2 font-medium">Ergebnis</th>
            <th className="text-left px-3 py-2 font-medium">Zugewiesen an</th>
            <th className="text-left px-3 py-2 font-medium">Begründung</th>
            <th className="px-3 py-2 font-medium text-center">Detail</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => {
            const rs = resultStyles[d.result] || resultStyles.error;
            return (
              <tr
                key={d.id}
                className="border-b border-border/20 hover:bg-accent/30 transition"
              >
                <td className="px-3 py-2 font-mono text-xs">{d.ticket_id}</td>
                <td className="px-3 py-2 text-xs">{d.ticket_type || '–'}</td>
                <td className="px-3 py-2 text-xs">{d.ticket_status || '–'}</td>
                <td className="px-3 py-2 text-xs">{d.ticket_site || '–'}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${rs.className}`}>
                    {rs.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{d.assigned_worker_name || '–'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">
                  {d.short_reason || '–'}
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => selectDecision(d.id)}
                    className="p-1 rounded hover:bg-accent/50 transition text-muted-foreground hover:text-foreground"
                    title="Detail anzeigen"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
