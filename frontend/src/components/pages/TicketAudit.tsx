/* ================================================ */
/* TICKET-AUDIT – Admin-only Auswertungsseite       */
/* Route: /dashboard/ticket-audit                    */
/* ================================================ */

import { useEffect, useState } from "react";
import { Shield, Users, FileWarning, ClipboardList, Info, Calendar } from "lucide-react";
import { api } from "../../api/api";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader, EnterpriseKpiCard } from "../layout/EnterpriseLayout";

/* ------------------------------------------------ */
/* TYPES                                            */
/* ------------------------------------------------ */

type RangeKey = "day" | "week" | "month" | "year" | "custom";

interface Summary {
  from: string;
  to: string;
  totalOwned: number;
  autoAssigned: number;
  manualTakeover: number;
  manualWorkers: number;
  closedTickets: number;
}

interface ManualRow {
  worker: string;
  count: number;
  total: number;
  percentage: number;
  lastTakeover: string | null;
  ticketTypes: string[];
}

interface ActivityRow {
  worker: string;
  total: number;
  sh: number;
  tt: number;
  cc: number;
  closed: number;
}

/* ------------------------------------------------ */
/* RANGE LABELS                                     */
/* ------------------------------------------------ */

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "day", label: "Heute" },
  { key: "week", label: "Woche" },
  { key: "month", label: "Monat" },
  { key: "year", label: "Jahr" },
  { key: "custom", label: "Zeitraum" },
];

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

export default function TicketAudit() {
  const [range, setRange] = useState<RangeKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---- Load data ---- */
  useEffect(() => {
    load();
  }, [range]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("range", range);
      if (range === "custom" && customFrom && customTo) {
        params.set("from", customFrom);
        params.set("to", customTo);
      }

      const qs = params.toString();
      const [sumRes, manRes, actRes] = await Promise.all([
        api.get(`/stats/audit/summary?${qs}`),
        api.get(`/stats/audit/manual-takeovers?${qs}`),
        api.get(`/stats/audit/worker-activity?${qs}`),
      ]);

      setSummary(sumRes.data);
      setManualRows(Array.isArray(manRes.data) ? manRes.data : []);
      setActivityRows(Array.isArray(actRes.data) ? actRes.data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  /* ---- Format helpers ---- */
  const fmtDate = (v: string | null) =>
    v ? new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";

  const fmtDateTime = (v: string | null) =>
    v ? new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–";

  /* ------------------------------------------------ */
  /* RENDER                                           */
  /* ------------------------------------------------ */

  return (
    <EnterprisePageShell>
      {/* HEADER */}
      <EnterpriseHeader
        title="TICKET-AUDIT"
        subtitle={
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Administratives Auswertungs-Dashboard – Ticketaktivität & manuelle Übernahmen
          </span>
        }
        icon={<Shield className="w-5 h-5 text-indigo-400" />}
        rightContent={
          <div className="flex items-center gap-2">
            {/* Range selection */}
            <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/10 p-0.5">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setRange(opt.key)}
                  className={`px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-md transition ${
                    range === opt.key
                      ? "bg-indigo-600/80 text-white shadow-sm"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Custom date picker */}
      {range === "custom" && (
        <EnterpriseCard noPadding={false} className="flex items-center gap-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Von</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-7 px-2 text-xs rounded-md bg-white/5 border border-white/10 text-foreground"
            />
            <label className="text-xs text-muted-foreground">Bis</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-7 px-2 text-xs rounded-md bg-white/5 border border-white/10 text-foreground"
            />
            <button
              onClick={load}
              disabled={!customFrom || !customTo}
              className="h-7 px-3 text-[11px] font-bold tracking-wider uppercase rounded-md bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-400/30 disabled:opacity-40"
            >
              Laden
            </button>
          </div>
        </EnterpriseCard>
      )}

      {/* LOADING */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && summary && (
        <>
          {/* KPI CARDS */}
          <div className="flex flex-wrap gap-4">
            <EnterpriseKpiCard
              label="Bearbeitete Tickets"
              value={summary.totalOwned}
              icon={ClipboardList}
              color="#6366f1"
              accent="#6366f1"
            />
            <EnterpriseKpiCard
              label="Automatisch zugewiesen"
              value={summary.autoAssigned}
              icon={Shield}
              color="#22c55e"
              accent="#22c55e"
            />
            <EnterpriseKpiCard
              label="Manuelle Übernahmen"
              value={summary.manualTakeover}
              icon={FileWarning}
              color="#f59e0b"
              accent="#f59e0b"
            />
            <EnterpriseKpiCard
              label="Betroffene Mitarbeiter"
              value={summary.manualWorkers}
              icon={Users}
              color="#f43f5e"
              accent="#f43f5e"
            />
            <EnterpriseKpiCard
              label="Geschlossene Tickets"
              value={summary.closedTickets}
              icon={ClipboardList}
              color="#06b6d4"
              accent="#06b6d4"
            />
          </div>

          {/* Zeitraum-Info */}
          <div className="text-[11px] text-muted-foreground px-1">
            Zeitraum: {fmtDate(summary.from)} – {fmtDate(summary.to)}
          </div>

          {/* ============================================ */}
          {/* TABLE 1: Manuelle Übernahmen ohne Zuweisung  */}
          {/* ============================================ */}
          <EnterpriseCard noPadding={false} className="flex flex-col gap-3">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-amber-400" />
              Manuelle Ticketübernahmen ohne ODIN-Zuweisung
            </div>

            {manualRows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">
                Keine manuellen Übernahmen ohne Zuweisung im gewählten Zeitraum.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground uppercase tracking-wider border-b border-white/10">
                      <th className="text-left py-2 pr-4 font-semibold">Mitarbeiter</th>
                      <th className="text-right py-2 px-3 font-semibold">Ohne Zuweisung</th>
                      <th className="text-right py-2 px-3 font-semibold">Gesamt</th>
                      <th className="text-right py-2 px-3 font-semibold">Anteil</th>
                      <th className="text-left py-2 px-3 font-semibold">Letzte Übernahme</th>
                      <th className="text-left py-2 pl-3 font-semibold">Tickettypen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualRows.map((row) => (
                      <tr
                        key={row.worker}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition"
                      >
                        <td className="py-2.5 pr-4 font-medium text-foreground/90">{row.worker}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-400">{row.count}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground/70">{row.total}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground/70">{row.percentage}%</td>
                        <td className="py-2.5 px-3 text-foreground/60">{fmtDateTime(row.lastTakeover)}</td>
                        <td className="py-2.5 pl-3">
                          <div className="flex flex-wrap gap-1">
                            {row.ticketTypes.map((t) => (
                              <span
                                key={t}
                                className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 border border-white/10 text-muted-foreground"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EnterpriseCard>

          {/* ============================================ */}
          {/* TABLE 2: Bearbeitete Tickets je Mitarbeiter  */}
          {/* ============================================ */}
          <EnterpriseCard noPadding={false} className="flex flex-col gap-3">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-400" />
              Bearbeitungsstatistik je Mitarbeiter
            </div>

            {activityRows.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4">
                Keine Ticketaktivität im gewählten Zeitraum.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground uppercase tracking-wider border-b border-white/10">
                      <th className="text-left py-2 pr-4 font-semibold">#</th>
                      <th className="text-left py-2 pr-4 font-semibold">Mitarbeiter</th>
                      <th className="text-right py-2 px-3 font-semibold">Gesamt</th>
                      <th className="text-right py-2 px-3 font-semibold">SH</th>
                      <th className="text-right py-2 px-3 font-semibold">TT</th>
                      <th className="text-right py-2 px-3 font-semibold">CC</th>
                      <th className="text-right py-2 px-3 font-semibold">Geschlossen</th>
                      <th className="text-right py-2 pl-3 font-semibold">Abschlussquote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityRows.map((row, idx) => (
                      <tr
                        key={row.worker}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition"
                      >
                        <td className="py-2.5 pr-4 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="py-2.5 pr-4 font-medium text-foreground/90">{row.worker}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-400 font-bold">{row.total}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground/70">{row.sh}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground/70">{row.tt}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-foreground/70">{row.cc}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-green-400">{row.closed}</td>
                        <td className="py-2.5 pl-3 text-right font-mono text-foreground/60">
                          {row.total > 0 ? Math.round((row.closed / row.total) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EnterpriseCard>

          {/* ============================================ */}
          {/* HINWEISBEREICH: Fachliche Definitionen       */}
          {/* ============================================ */}
          <EnterpriseCard noPadding={false} className="flex flex-col gap-2">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              Definitionen & Berechnungsgrundlagen
            </div>
            <div className="text-[11px] text-muted-foreground leading-relaxed space-y-2">
              <p>
                <strong className="text-foreground/70">Manuelle Übernahme ohne Zuweisung:</strong>{" "}
                Ein Ticket, für das ein Mitarbeiter als Owner eingetragen ist, aber keine
                ODIN-Zuweisungsentscheidung mit dem Ergebnis „assigned" existiert.
                Dies bedeutet, dass die Übernahme außerhalb des automatischen Zuweisungsprozesses erfolgt ist.
              </p>
              <p>
                <strong className="text-foreground/70">Bearbeitetes Ticket:</strong>{" "}
                Ein Ticket, das einem Mitarbeiter als Owner zugeordnet ist und im gewählten Zeitraum aktiv war.
                Die Zählung erfolgt auf Basis des Owner-Feldes in den Queue-Daten.
              </p>
              <p>
                <strong className="text-foreground/70">Abschlussquote:</strong>{" "}
                Anteil der Tickets mit gesetztem Abschlussdatum (closed_at) an der Gesamtzahl
                der dem Mitarbeiter zugeordneten Tickets.
              </p>
            </div>
          </EnterpriseCard>
        </>
      )}
    </EnterprisePageShell>
  );
}
