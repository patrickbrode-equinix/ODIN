/* ================================================ */
/* ODIN-Logik — Run Table                           */
/* ================================================ */

import { useAssignmentStore } from '../../store/assignmentStore';
import type { AssignmentRun } from '../../types/assignment';
import { ChevronRight } from 'lucide-react';

const statusBadge: Record<string, { className: string }> = {
  running: { className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  completed: { className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  failed: { className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  cancelled: { className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
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
            return (
              <tr
                key={run.id}
                className="border-b border-border/20 hover:bg-accent/30 cursor-pointer transition"
                onClick={() => selectRun(run.id)}
              >
                <td className="px-3 py-2 font-mono text-xs">#{run.id}</td>
                <td className="px-3 py-2"><Badge text={run.mode} className={mb.className} /></td>
                <td className="px-3 py-2"><Badge text={run.status} className={sb.className} /></td>
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
