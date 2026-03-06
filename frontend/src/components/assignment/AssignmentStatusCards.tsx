/* ================================================ */
/* ODIN-Logik — Status Cards (Top Row)              */
/* ================================================ */

import type { AssignmentHealth, AssignmentRun } from '../../types/assignment';
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock, Eye } from 'lucide-react';

interface Props {
  health: AssignmentHealth | null;
  lastRun: AssignmentRun | null;
}

const modeBadge: Record<string, { label: string; className: string }> = {
  shadow: { label: 'Shadow', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  live: { label: 'Live', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  'dry-run': { label: 'Dry-Run', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

const resultBadge: Record<string, { label: string; className: string }> = {
  running: { label: 'Läuft', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  completed: { label: 'Abgeschlossen', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  failed: { label: 'Fehlgeschlagen', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  cancelled: { label: 'Abgebrochen', className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
};

export function AssignmentStatusCards({ health, lastRun }: Props) {
  const mode = health?.mode || 'shadow';
  const mb = modeBadge[mode] || modeBadge.shadow;
  const rb = lastRun ? (resultBadge[lastRun.status] || resultBadge.completed) : null;

  const cards = [
    {
      label: 'Modus',
      icon: Eye,
      value: (
        <span className={`text-xs font-black px-2 py-0.5 rounded border ${mb.className}`}>
          {mb.label}
        </span>
      ),
    },
    {
      label: 'Letzter Run',
      icon: Clock,
      value: lastRun
        ? new Date(lastRun.started_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '–',
    },
    {
      label: 'Status',
      icon: Activity,
      value: rb ? (
        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${rb.className}`}>
          {rb.label}
        </span>
      ) : '–',
    },
    {
      label: 'Assigned',
      icon: CheckCircle,
      value: lastRun?.assigned ?? '–',
      valueClass: 'text-green-400',
    },
    {
      label: 'Manual Review',
      icon: AlertTriangle,
      value: lastRun?.manual_review ?? '–',
      valueClass: 'text-amber-400',
    },
    {
      label: 'Errors',
      icon: XCircle,
      value: lastRun?.errors ?? '–',
      valueClass: 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm p-4 flex flex-col gap-1"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <c.icon className="w-3.5 h-3.5" />
            {c.label}
          </div>
          <div className={`text-lg font-bold ${'valueClass' in c ? c.valueClass : ''}`}>
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
