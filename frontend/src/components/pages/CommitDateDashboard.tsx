/* ------------------------------------------------ */
/* COMMIT DATE DASHBOARD – Enterprise Premium       */
/* Shows tickets due/expiring in 72h, TT on top    */
/* ------------------------------------------------ */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, RefreshCcw, Zap } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../api/api";
import { queueApi, Ticket } from "../../api/queue";
import { getRemainingMs, getColorTier, tierClasses, formatRemainingTime } from "../../utils/ticketColors";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader, ENT_CARD_BASE } from "../layout/EnterpriseLayout";
import { format } from "date-fns";

/* ------------------------------------------------ */
/* TICKET CARD – enterprise style                   */
/* ------------------------------------------------ */
function TicketRowCompact({ t }: { t: any }) {
  const ms = getRemainingMs(t);
  const tier = getColorTier(ms);
  const css = tierClasses[tier];
  const rem = ms !== null ? formatRemainingTime(ms) : t.remaining_time ?? "";
  const id = String(t.external_id ?? t.activity_no ?? t.ticketNumber ?? t.id ?? "").trim();
  const activity = String(t.activity ?? t.subtype ?? t.group_name ?? "–").trim();
  const system = String(t.systemName ?? t.system_name ?? t.component_name ?? "").trim();
  const status = String(t.status ?? t.activity_status ?? t.state ?? "").trim();
  const owner = String(t.owner ?? t.Owner ?? "").trim();
  const isTT = String(t.queue_type ?? t.type ?? t.Type ?? "").toLowerCase().includes("tt") ||
    String(t.queue_type ?? t.type ?? t.Type ?? "").toLowerCase().includes("trouble");
  const schedStart = t.sched_start || t.Start_Date;
  const dueDate = t.commit_date || t.dueDate || t.targetDate || t.termin;

  return (
    <div className={`relative flex flex-col gap-1.5 px-4 py-3 rounded-xl border overflow-hidden ${css} ${isTT ? 'shadow-[0_0_12px_rgba(239,68,68,0.15)]' : ''}`}>
      {isTT && (
        <span className="absolute top-2 right-2 bg-red-500/20 text-red-300 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-500/30 uppercase">TT</span>
      )}
      <div className="flex items-center justify-between pr-8">
        <span className="font-mono font-bold text-[13px]">{id}</span>
        {rem && <span className="font-mono font-bold text-[12px] bg-black/20 px-1.5 py-0.5 rounded">{rem}</span>}
      </div>
      <div className="truncate text-sm font-semibold opacity-90">{activity}</div>
      <div className="flex flex-wrap gap-1.5 text-[10px] opacity-70">
        {system && <span className="bg-black/15 px-1.5 py-0.5 rounded truncate max-w-[120px]">{system}</span>}
        {owner && <span>{owner}</span>}
        {status && <span className="border border-white/10 px-1.5 py-0.5 rounded">{status}</span>}
        {schedStart && <span className="bg-indigo-500/15 text-indigo-300 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock className="w-2.5 h-2.5" />Start: {format(new Date(schedStart), "dd.MM HH:mm")}</span>}
        {dueDate && <span className="bg-orange-500/15 text-orange-300 px-1.5 py-0.5 rounded">Commit: {format(new Date(dueDate), "dd.MM HH:mm")}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------ */
/* PAGE                                             */
/* ------------------------------------------------ */
export default function CommitDateDashboardPage() {
  const [commitTickets, setCommitTickets] = useState<any[]>([]);
  const [queueTickets, setQueueTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  async function load() {
    setLoading(true);
    try {
      const [commitRes, queueRes] = await Promise.all([
        api.get("/commit/latest").catch(() => ({ data: [] })),
        queueApi.getDueToday().catch(() => []),
      ]);

      let commitRows: any[] = [];
      const commitPayload = commitRes.data;
      if (Array.isArray(commitPayload)) commitRows = commitPayload;
      else if (Array.isArray(commitPayload?.data)) commitRows = commitPayload.data;
      else if (Array.isArray(commitPayload?.rows)) commitRows = commitPayload.rows;

      setCommitTickets(commitRows);
      setQueueTickets(Array.isArray(queueRes) ? queueRes : []);
      setLastRefresh(new Date());
    } catch (e) {
      toast.error("Dashboard Updates fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  /* Combine and filter for 72h */
  const allTickets = useMemo(() => {
    const map = new Map<string, any>();
    commitTickets.forEach(t => map.set(t.external_id || t.id || t.activity_no, t));
    queueTickets.forEach(t => map.set(t.external_id || t.id || t.activity_no, t));
    return Array.from(map.values());
  }, [commitTickets, queueTickets]);

  const limitMs = Date.now() + 72 * 3600 * 1000;
  const expiring72h = useMemo(() => {
    return allTickets.filter(t => {
      const ms = getRemainingMs(t);
      const dStr = t.commit_date || t.dueDate || t.targetDate || t.termin || t.sched_start;
      const dMs = dStr ? new Date(dStr).getTime() : NaN;
      return (ms !== null && ms >= 0 && ms <= 72 * 3600 * 1000) ||
        (!isNaN(dMs) && dMs >= Date.now() && dMs <= limitMs);
    });
  }, [allTickets]);

  const isTT = (t: any) => String(t.queue_type ?? t.type ?? t.Type ?? "").toLowerCase().includes("tt") || String(t.queue_type ?? t.type ?? t.Type ?? "").toLowerCase().includes("trouble");

  const sorted = useMemo(() => {
    return [...expiring72h].sort((a, b) => {
      const aTT = isTT(a) ? 0 : 1;
      const bTT = isTT(b) ? 0 : 1;
      if (aTT !== bTT) return aTT - bTT;
      const msA = getRemainingMs(a) ?? Infinity;
      const msB = getRemainingMs(b) ?? Infinity;
      return msA - msB;
    });
  }, [expiring72h]);

  const ttCount = sorted.filter(isTT).length;
  const otherCount = sorted.length - ttCount;

  return (
    <EnterprisePageShell>
      <EnterpriseHeader
        title="Commit & 72h Übersicht"
        subtitle={<span className="text-xs text-muted-foreground">Stand: {format(lastRefresh, "HH:mm:ss")} · {sorted.length} Tickets · {ttCount} TT</span>}
        rightContent={
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-sm font-medium transition"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </button>
        }
      />

      <div className="p-6 space-y-6 overflow-auto flex-1 min-h-0">
        {/* STATS ROW */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Trouble Tickets", value: ttCount, color: "text-red-400", icon: AlertTriangle, glow: "shadow-[0_0_16px_rgba(239,68,68,0.1)]" },
            { label: "Andere Tickets", value: otherCount, color: "text-blue-400", icon: Zap, glow: "shadow-[0_0_16px_rgba(59,130,246,0.1)]" },
            { label: "Gesamt 72h", value: sorted.length, color: "text-foreground", icon: Clock, glow: "" },
          ].map(({ label, value, color, icon: Icon, glow }) => (
            <div key={label} className={`${ENT_CARD_BASE} ${glow} flex items-center gap-4 p-4`}>
              <Icon className={`w-8 h-8 ${color} opacity-60`} />
              <div>
                <div className={`text-3xl font-black ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* TICKET GRID */}
        <EnterpriseCard>
          <div style={{ padding: "16px 22px 8px", opacity: 0.7, fontSize: 13 }}>Tickets in den nächsten 72 Stunden – Trouble Tickets zuerst</div>
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 opacity-60" />
              <p className="text-lg font-semibold">Keine kritischen Tickets</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sorted.map((t, i) => <TicketRowCompact key={t.external_id || t.id || i} t={t} />)}
            </div>
          )}
        </EnterpriseCard>
      </div>
    </EnterprisePageShell>
  );
}
