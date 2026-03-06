/* ================================================ */
/* ODIN-Logik — Filter Bar                          */
/* ================================================ */

import { useAssignmentStore } from '../../store/assignmentStore';
import type { AssignmentMode, RunStatus, DecisionResult } from '../../types/assignment';

export function AssignmentFilters() {
  const { filters, setFilters } = useAssignmentStore();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Run Mode Filter */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-muted-foreground font-medium">Modus</label>
        <select
          className="text-xs rounded-md border border-border/40 bg-background/60 px-2 py-1 text-foreground"
          value={filters.runMode || ''}
          onChange={(e) => setFilters({ runMode: (e.target.value || undefined) as AssignmentMode | undefined })}
        >
          <option value="">Alle</option>
          <option value="shadow">Shadow</option>
          <option value="dry-run">Dry-Run</option>
        </select>
      </div>

      {/* Run Status Filter */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-muted-foreground font-medium">Run-Status</label>
        <select
          className="text-xs rounded-md border border-border/40 bg-background/60 px-2 py-1 text-foreground"
          value={filters.runStatus || ''}
          onChange={(e) => setFilters({ runStatus: (e.target.value || undefined) as RunStatus | undefined })}
        >
          <option value="">Alle</option>
          <option value="completed">Abgeschlossen</option>
          <option value="failed">Fehlgeschlagen</option>
          <option value="running">Läuft</option>
        </select>
      </div>

      {/* Decision Result Filter */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-muted-foreground font-medium">Ergebnis</label>
        <select
          className="text-xs rounded-md border border-border/40 bg-background/60 px-2 py-1 text-foreground"
          value={filters.decisionResult || ''}
          onChange={(e) => setFilters({ decisionResult: (e.target.value || undefined) as DecisionResult | undefined })}
        >
          <option value="">Alle</option>
          <option value="assigned">Zugewiesen</option>
          <option value="manual_review">Manual Review</option>
          <option value="no_candidate">Kein Kandidat</option>
          <option value="not_relevant">Nicht relevant</option>
          <option value="blocked">Gesperrt</option>
          <option value="error">Fehler</option>
        </select>
      </div>
    </div>
  );
}
