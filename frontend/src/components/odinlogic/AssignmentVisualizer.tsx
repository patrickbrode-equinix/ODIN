/* ------------------------------------------------ */
/* ASSIGNMENT VISUALIZER – Visual decision flow     */
/* Shows per-run, per-ticket assignment decisions   */
/* ------------------------------------------------ */

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronRight, Users, Filter, Shield, GitBranch, Search, User, Ban } from "lucide-react";
import { AssignmentApi } from "../../api/assignment";
import { InfoTooltip } from "../ui/InfoTooltip";
import type { AssignmentRun, AssignmentDecision, CandidateRef, ExcludedCandidate } from "../../types/assignment";
import { getAssignmentDisplayTicketNumber, getAssignmentInternalTicketId } from "../../utils/assignmentTicketDisplay";
import { useLanguage } from "../../context/LanguageContext";

/* ---- Result styles ---- */
const RESULT_STYLES: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  assigned: { label: "Zugewiesen", icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  manual_review: { label: "Manual Review", icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  no_candidate: { label: "Kein Kandidat", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  not_relevant: { label: "Nicht relevant", icon: Ban, color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/30" },
  blocked: { label: "Blockiert", icon: Shield, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  error: { label: "Fehler", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
};

interface Props {
  runs: AssignmentRun[];
}

export default function AssignmentVisualizer({ runs }: Props) {
  const { language } = useLanguage();
  const isGerman = language === "de";
  const [selectedRunId, setSelectedRunId] = useState<number | null>(runs[0]?.id ?? null);
  const [decisions, setDecisions] = useState<AssignmentDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadDecisions = useCallback(async (runId: number) => {
    setLoading(true);
    try {
      const data = await AssignmentApi.getDecisions({ runId, limit: 500 });
      setDecisions(Array.isArray(data) ? data : []);
    } catch {
      setDecisions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedRunId) loadDecisions(selectedRunId);
  }, [selectedRunId, loadDecisions]);

  // Filter decisions
  const filtered = decisions.filter(d => {
    const displayTicketNumber = getAssignmentDisplayTicketNumber(d).toLowerCase();
    const internalTicketId = getAssignmentInternalTicketId(d)?.toLowerCase() || '';
    if (resultFilter !== "all" && d.result !== resultFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        displayTicketNumber.includes(s) ||
        internalTicketId.includes(s) ||
        d.assigned_worker_name?.toLowerCase().includes(s) ||
        d.ticket_type?.toLowerCase().includes(s) ||
        d.external_id?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Summary counts
  const counts = decisions.reduce<Record<string, number>>((acc, d) => {
    acc[d.result] = (acc[d.result] || 0) + 1;
    return acc;
  }, {});

  const selectedRun = runs.find(r => r.id === selectedRunId);

  const resultStyles: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    assigned: { ...RESULT_STYLES.assigned, label: isGerman ? "Zugewiesen" : "Assigned" },
    manual_review: { ...RESULT_STYLES.manual_review, label: isGerman ? "Manuelle Prüfung" : "Manual review" },
    no_candidate: { ...RESULT_STYLES.no_candidate, label: isGerman ? "Kein Kandidat" : "No candidate" },
    not_relevant: { ...RESULT_STYLES.not_relevant, label: isGerman ? "Nicht relevant" : "Not relevant" },
    blocked: { ...RESULT_STYLES.blocked, label: isGerman ? "Blockiert" : "Blocked" },
    error: { ...RESULT_STYLES.error, label: isGerman ? "Fehler" : "Error" },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            {isGerman ? "Zuweisungsfluss — Visuelle Entscheidungsnachverfolgung" : "Assignment flow - visual decision trace"}
            <InfoTooltip title={isGerman ? "Zuweisungsfluss" : "Assignment flow"} side="right" width="w-96">
              <p>{isGerman ? "Diese Ansicht zeigt für einen ausgewählten Engine-Lauf alle Ticketentscheidungen. Pro Ticket sehen Sie:" : "This view shows all ticket decisions for a selected engine run. For each ticket you can see:"}</p>
              <ul className="list-disc ml-4 space-y-0.5">
                <li>{isGerman ? "Welche Kandidaten initial berücksichtigt wurden" : "Which candidates were considered initially"}</li>
                <li>{isGerman ? "Wer aus welchem Grund ausgeschlossen wurde" : "Who was excluded and for what reason"}</li>
                <li>{isGerman ? "Wer als Kandidat übrig blieb" : "Who remained as a candidate"}</li>
                <li>{isGerman ? "Wer final zugewiesen wurde und warum" : "Who was assigned in the end and why"}</li>
                <li>{isGerman ? "Welche Regeln ausschlaggebend waren" : "Which rules were decisive"}</li>
              </ul>
              <p className="mt-1">{isGerman ? "Verwenden Sie die Filter, um nach Ticket-ID, Mitarbeiter oder Ergebnis zu suchen." : "Use the filters to search by ticket ID, employee, or result."}</p>
            </InfoTooltip>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{isGerman ? "Wählen Sie einen Run, um die Entscheidungen nachzuvollziehen." : "Select a run to inspect the decisions."}</p>
        </div>
      </div>

      {/* Run Selector + Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">{isGerman ? "Run" : "Run"}</label>
          <select
            value={selectedRunId ?? ""}
            onChange={e => { setSelectedRunId(Number(e.target.value)); setExpandedId(null); }}
            className="text-sm rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-foreground min-w-[200px]"
          >
            {runs.map(r => (
              <option key={r.id} value={r.id}>
                Run #{r.id} — {r.mode} — {new Date(r.started_at).toLocaleString("de-DE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">{isGerman ? "Ergebnis" : "Result"}</label>
          <select
            value={resultFilter}
            onChange={e => setResultFilter(e.target.value)}
            className="text-sm rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-foreground"
          >
            <option value="all">{isGerman ? "Alle" : "All"} ({decisions.length})</option>
            {Object.entries(resultStyles).map(([k, v]) => (
              <option key={k} value={k}>{v.label} ({counts[k] || 0})</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] text-muted-foreground block mb-1">{isGerman ? "Suche" : "Search"}</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={isGerman ? "Ticket-ID, Mitarbeiter, Typ..." : "Ticket ID, employee, type..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-sm rounded-md border border-border/40 bg-background/60 pl-7 pr-2 py-1.5 text-foreground w-full"
            />
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      {selectedRun && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(resultStyles).map(([key, style]) => {
            const count = counts[key] || 0;
            if (count === 0) return null;
            const Icon = style.icon;
            return (
              <button
                key={key}
                onClick={() => setResultFilter(resultFilter === key ? "all" : key)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition ${
                  resultFilter === key ? style.bg + " font-bold" : "border-border/30 bg-background/40 hover:bg-background/60"
                } ${style.color}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {style.label}: {count}
              </button>
            );
          })}
        </div>
      )}

      {/* Decision List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {decisions.length === 0
            ? (isGerman ? "Keine Entscheidungen in diesem Run vorhanden." : "No decisions are available for this run.")
            : (isGerman ? "Keine Treffer für den aktuellen Filter." : "No matches for the current filter.")}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <DecisionCard
              key={d.id}
              decision={d}
              expanded={expandedId === d.id}
              onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Decision Card ---- */

function DecisionCard({ decision: d, expanded, onToggle }: { decision: AssignmentDecision; expanded: boolean; onToggle: () => void }) {
  const { language } = useLanguage();
  const isGerman = language === "de";
  const style = RESULT_STYLES[d.result] || RESULT_STYLES.error;
  const Icon = style.icon;
  const displayTicketNumber = getAssignmentDisplayTicketNumber(d);
  const internalTicketId = getAssignmentInternalTicketId(d);

  return (
    <div className={`rounded-lg border ${style.bg} overflow-hidden`}>
      {/* Summary Row */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition">
        <span className="shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </span>
        <Icon className={`w-4 h-4 shrink-0 ${style.color}`} />
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono text-xs text-foreground font-semibold">{displayTicketNumber}</span>
          {internalTicketId && internalTicketId !== displayTicketNumber && (
            <span className="text-[10px] text-muted-foreground">DB-ID {internalTicketId}</span>
          )}
          {d.ticket_type && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">{d.ticket_type}</span>}
          {d.ticket_priority && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">{d.ticket_priority}</span>}
          {d.ticket_site && <span className="text-[10px] text-muted-foreground">Site: {d.ticket_site}</span>}
        </div>
        <span className={`text-xs font-bold ${style.color} whitespace-nowrap`}>{isGerman ? style.label : (d.result === 'assigned' ? 'Assigned' : d.result === 'manual_review' ? 'Manual review' : d.result === 'no_candidate' ? 'No candidate' : d.result === 'not_relevant' ? 'Not relevant' : d.result === 'blocked' ? 'Blocked' : 'Error')}</span>
        {d.assigned_worker_name && (
          <span className="flex items-center gap-1 text-xs text-green-400 whitespace-nowrap">
            <User className="w-3 h-3" />
            {d.assigned_worker_name}
          </span>
        )}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-white/10 px-4 py-4 space-y-4">
          {/* Short Reason */}
          {d.short_reason && (
            <div className="text-sm text-foreground bg-white/5 rounded-lg px-3 py-2">
              <span className="font-semibold text-xs text-muted-foreground mr-2">{isGerman ? 'Entscheidungsgrund' : 'Decision reason'}:</span>
              {d.short_reason}
            </div>
          )}

          {/* Selection Reason */}
          {d.selection_reason && d.selection_reason !== d.short_reason && (
            <div className="text-xs text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
              <span className="font-semibold mr-1">{isGerman ? 'Auswahlbegründung' : 'Selection reason'}:</span>
              {d.selection_reason}
            </div>
          )}

          {/* Rule Path */}
          {d.rule_path && d.rule_path.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold mb-1 flex items-center gap-1.5">
                <GitBranch className="w-3 h-3" /> {isGerman ? 'Regelpfad' : 'Rule path'}
              </div>
              <div className="flex flex-wrap gap-1">
                {d.rule_path.map((r, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                    {i > 0 && <span className="mr-1">→</span>}
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Candidates Flow */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Initial Candidates */}
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> {isGerman ? 'Initiale Kandidaten' : 'Initial candidates'} ({d.initial_candidates?.length || 0})
              </div>
              <div className="space-y-0.5">
                {d.initial_candidates?.map(c => (
                  <div key={c.id} className="text-xs px-2 py-1 rounded bg-white/5 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-blue-400" />
                    <span>{c.name}</span>
                    {(c.shiftCode || c.weekplanRole || c.role) && <span className="text-[10px] text-muted-foreground">{[c.shiftCode, c.weekplanRole || c.role].filter(Boolean).join(' | ')}</span>}
                    <span className="text-muted-foreground text-[10px]">#{c.id}</span>
                  </div>
                )) || <div className="text-xs text-muted-foreground">{isGerman ? 'Keine Daten' : 'No data'}</div>}
              </div>
            </div>

            {/* Excluded Candidates */}
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-red-400" /> {isGerman ? 'Ausgeschlossen' : 'Excluded'} ({d.excluded_candidates?.length || 0})
              </div>
              <div className="space-y-0.5">
                {d.excluded_candidates?.map((c, i) => (
                  <div key={i} className="text-xs px-2 py-1 rounded bg-red-500/5 border border-red-500/10">
                    <div className="flex items-center gap-1.5">
                      <XCircle className="w-3 h-3 text-red-400 shrink-0" />
                      <span>{c.name}</span>
                      {(c.shiftCode || c.weekplanRole || c.role) && <span className="text-[10px] text-red-300/70">{[c.shiftCode, c.weekplanRole || c.role].filter(Boolean).join(' | ')}</span>}
                    </div>
                    <div className="text-[10px] text-red-300/70 ml-4.5 mt-0.5">
                      {c.rule && <span className="font-mono mr-1">[{c.rule}]</span>}
                      {c.reason}
                    </div>
                  </div>
                )) || <div className="text-xs text-muted-foreground">{isGerman ? 'Keine Ausschlüsse' : 'No exclusions'}</div>}
              </div>
            </div>

            {/* Remaining / Winner */}
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold mb-1.5 flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-green-400" /> {isGerman ? 'Verbleibend / Gewinner' : 'Remaining / winner'} ({d.remaining_candidates?.length || 0})
              </div>
              <div className="space-y-0.5">
                {d.remaining_candidates?.map(c => {
                  const isWinner = c.id === d.assigned_worker_id;
                  return (
                    <div
                      key={c.id}
                      className={`text-xs px-2 py-1 rounded flex items-center gap-1.5 ${
                        isWinner ? "bg-green-500/10 border border-green-500/30 font-semibold" : "bg-white/5"
                      }`}
                    >
                      <User className={`w-3 h-3 ${isWinner ? "text-green-400" : "text-muted-foreground"}`} />
                      <span>{c.name}</span>
                      {(c.shiftCode || c.weekplanRole || c.role) && <span className="text-[10px] text-muted-foreground">{[c.shiftCode, c.weekplanRole || c.role].filter(Boolean).join(' | ')}</span>}
                      {isWinner && <span className="text-[10px] text-green-400 ml-auto">★ {isGerman ? 'Zugewiesen' : 'Assigned'}</span>}
                    </div>
                  );
                }) || <div className="text-xs text-muted-foreground">{isGerman ? 'Keine Daten' : 'No data'}</div>}
              </div>
            </div>
          </div>

          {/* Normalization Warnings */}
          {d.normalization_warnings && d.normalization_warnings.length > 0 && (
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2">
              <div className="text-[10px] text-amber-400 font-semibold mb-1">⚠ {isGerman ? 'Normalisierungs-Warnungen' : 'Normalization warnings'}</div>
              <ul className="text-[10px] text-amber-300/70 space-y-0.5 list-disc ml-4">
                {d.normalization_warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Error */}
          {d.error_message && (
            <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2">
              <div className="text-[10px] text-red-400 font-semibold mb-1">{isGerman ? 'Fehler' : 'Error'}</div>
              <div className="text-xs text-red-300 font-mono">{d.error_message}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
