/* ================================================ */
/* ODIN-Logik — Decision Table                      */
/* ================================================ */

import { useAssignmentStore } from '../../store/assignmentStore';
import type { AssignmentDecision, DecisionResult } from '../../types/assignment';
import { Eye, AlertCircle, CheckCircle2, XCircle, HelpCircle, Ban, AlertTriangle } from 'lucide-react';
import { InfoTooltip } from '../ui/InfoTooltip';
import { getAssignmentDisplayTicketNumber, getAssignmentInternalTicketId } from '../../utils/assignmentTicketDisplay';

const resultStyles: Record<DecisionResult, { label: string; className: string; icon: React.ReactNode; explanation: string }> = {
  assigned: {
    label: 'Zugewiesen',
    className: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
    explanation: 'Ticket wurde erfolgreich einem Mitarbeiter zugewiesen.',
  },
  manual_review: {
    label: 'Manual Review',
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    icon: <HelpCircle className="w-3 h-3" />,
    explanation: 'Kein automatisch geeigneter Kandidat gefunden. Der Dispatcher muss manuell entscheiden.',
  },
  no_candidate: {
    label: 'Kein Kandidat',
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    icon: <AlertTriangle className="w-3 h-3" />,
    explanation: 'Nach Anwendung aller Berechtigungsregeln blieb kein zulässiger Mitarbeiter übrig.',
  },
  not_relevant: {
    label: 'Nicht relevant',
    className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
    icon: <Ban className="w-3 h-3" />,
    explanation: 'Ticket hat die Relevanzprüfung nicht bestanden (z. B. geschlossen, nicht unterstützt, blockiert).',
  },
  blocked: {
    label: 'Gesperrt',
    className: 'bg-red-500/20 text-red-300 border-red-500/30',
    icon: <Ban className="w-3 h-3" />,
    explanation: 'Ticket wurde durch einen manuellen Override blockiert.',
  },
  error: {
    label: 'Fehler',
    className: 'bg-red-600/20 text-red-400 border-red-600/30',
    icon: <XCircle className="w-3 h-3" />,
    explanation: 'Ein technischer Fehler ist bei der Verarbeitung dieses Tickets aufgetreten.',
  },
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
            <th className="text-left px-3 py-2 font-medium">Ticketnummer</th>
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
            const displayTicketNumber = getAssignmentDisplayTicketNumber(d);
            const internalTicketId = getAssignmentInternalTicketId(d);
            return (
              <tr
                key={d.id}
                className="border-b border-border/20 hover:bg-accent/30 transition"
              >
                <td className="px-3 py-2 text-xs">
                  <div className="font-mono">{displayTicketNumber}</div>
                  {internalTicketId && internalTicketId !== displayTicketNumber && (
                    <div className="text-[10px] text-muted-foreground">DB-ID: {internalTicketId}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{d.ticket_type || '–'}</td>
                <td className="px-3 py-2 text-xs">{d.ticket_status || '–'}</td>
                <td className="px-3 py-2 text-xs">{d.ticket_site || '–'}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${rs.className}`}>
                    {rs.icon}
                    {rs.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{d.assigned_worker_name || '–'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[250px]">
                  <div className="flex items-center gap-1">
                    <span className="truncate" title={d.short_reason || d.error_message || rs.explanation}>
                      {d.short_reason || d.error_message || rs.explanation}
                    </span>
                    {(d.selection_reason || d.error_message) && (
                      <span onClick={(e) => e.stopPropagation()}>
                        <InfoTooltip title="Begründung" side="left" width="w-96">
                          <p><strong>Ergebnis:</strong> {rs.label} — {rs.explanation}</p>
                          {d.short_reason && <p className="mt-1"><strong>Kurzgrund:</strong> {d.short_reason}</p>}
                          {d.selection_reason && <p className="mt-1"><strong>Auswahlgrund:</strong> {d.selection_reason}</p>}
                          {d.error_message && <p className="mt-1"><strong>Fehlermeldung:</strong> {d.error_message}</p>}
                          {d.rule_path && d.rule_path.length > 0 && (
                            <p className="mt-1"><strong>Regelpfad:</strong> {d.rule_path.join(' → ')}</p>
                          )}
                        </InfoTooltip>
                      </span>
                    )}
                  </div>
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
