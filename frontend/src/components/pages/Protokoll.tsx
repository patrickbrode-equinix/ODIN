import { useEffect, useState, useMemo } from "react";
import { ActivityLogEntry, getActivityLog, getActivityStats } from "../../api/activity";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Loader2, RefreshCw, FileText, Search, BarChart2, UserCircle, CalendarRange, X } from "lucide-react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";

/* ---- Module color map ---- */
const MODULE_COLORS: Record<string, string> = {
  SHIFTPLAN: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  YEAR2027: "bg-purple-500/15 text-purple-300 border-purple-500/25",
  DASHBOARD: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  AUTH: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  SYSTEM: "bg-slate-500/15 text-slate-300 border-slate-500/25",
  HANDOVER: "bg-teal-500/15 text-teal-300 border-teal-500/25",
  INGEST: "bg-green-500/15 text-green-300 border-green-500/25",
};

export default function Protokoll() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [stats, setStats] = useState<{ module: string; count: string }[]>([]);
  const [loading, setLoading] = useState(false);

  /* Filters */
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [actorFilter, setActorFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [limit, setLimit] = useState(100);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { limit };
      if (moduleFilter !== "ALL") params.module = moduleFilter;
      if (actorFilter.trim()) params.actor = actorFilter.trim();
      if (actionFilter.trim()) params.action = actionFilter.trim();
      if (dateFrom) params.start = new Date(dateFrom).toISOString();
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        params.end = end.toISOString();
      }
      const [data, statsData] = await Promise.all([
        getActivityLog(params),
        getActivityStats().catch(() => []),
      ]);
      setLogs(data);
      setStats(statsData);
    } catch (e) {
      console.error("Failed to fetch logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [moduleFilter, limit]);

  const clearFilters = () => {
    setModuleFilter("ALL");
    setActorFilter("");
    setActionFilter("");
    setDateFrom("");
    setDateTo("");
    setLimit(100);
  };
  const hasActiveFilters = moduleFilter !== "ALL" || actorFilter || actionFilter || dateFrom || dateTo;

  /* Unique action types from current logs for datalist */
  const knownActions = useMemo(() => [...new Set(logs.map(l => l.action_type).filter(Boolean))].sort(), [logs]);
  const knownActors = useMemo(() => [...new Set(logs.map(l => l.actor).filter(Boolean))].sort(), [logs]);
  const totalCount = stats.reduce((s, r) => s + parseInt(r.count ?? "0"), 0);

  return (
    <EnterprisePageShell>
      {/* HEADER */}
      <EnterpriseHeader
        title="PROTOKOLL"
        subtitle={<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Systemaktivitäten und Änderungen nachvollziehen</span>}
        icon={<FileText className="w-5 h-5 text-indigo-400" />}
        rightContent={
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}
            className="h-7 px-3 text-[11px] font-bold tracking-wider uppercase bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 shadow-sm">
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
            Aktualisieren
          </Button>
        }
      />

      {/* STATS STRIP */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {stats.map(s => {
            const pct = totalCount > 0 ? Math.round((parseInt(s.count) / totalCount) * 100) : 0;
            const cls = MODULE_COLORS[s.module] ?? "bg-slate-500/10 text-slate-300 border-slate-500/20";
            return (
              <button key={s.module}
                onClick={() => setModuleFilter(s.module)}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border cursor-pointer transition-all hover:scale-[1.02] ${cls} ${moduleFilter === s.module ? "ring-2 ring-white/20" : ""}`}
              >
                <span className="text-xl font-black tabular-nums">{s.count}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">{s.module}</span>
                <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-current opacity-40" style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* FILTER BAR */}
      <EnterpriseCard noPadding={false} className="flex flex-wrap gap-3 items-end">
        {/* Module */}
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modul</label>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="h-8 text-xs rounded-lg">
              <SelectValue placeholder="Alle Module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Module</SelectItem>
              {["SHIFTPLAN", "YEAR2027", "DASHBOARD", "AUTH", "SYSTEM", "HANDOVER", "INGEST"].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actor */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <UserCircle className="w-3 h-3" /> Benutzer
          </label>
          <div className="relative">
            <Input list="actors-list" placeholder="z.B. admin" value={actorFilter}
              onChange={e => setActorFilter(e.target.value)}
              className="h-8 text-xs rounded-lg pr-6" />
            <datalist id="actors-list">
              {knownActors.map(a => <option key={a} value={a} />)}
            </datalist>
            {actorFilter && (
              <button onClick={() => setActorFilter("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aktion</label>
          <div className="relative">
            <Input list="actions-list" placeholder="z.B. UPLOAD" value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="h-8 text-xs rounded-lg pr-6" />
            <datalist id="actions-list">
              {knownActions.map(a => <option key={a} value={a} />)}
            </datalist>
            {actionFilter && (
              <button onClick={() => setActionFilter("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <CalendarRange className="w-3 h-3" /> Von
          </label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-8 text-xs rounded-lg w-36" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bis</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-8 text-xs rounded-lg w-36" />
        </div>

        {/* Limit */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Anzahl</label>
          <Select value={String(limit)} onValueChange={v => setLimit(Number(v))}>
            <SelectTrigger className="h-8 text-xs rounded-lg w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100, 250, 500].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Search + clear */}
        <div className="flex gap-2 items-end ml-auto self-end">
          {hasActiveFilters && (
            <Button onClick={clearFilters} variant="ghost" size="sm"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5 mr-1" /> Filter zurücksetzen
            </Button>
          )}
          <Button onClick={fetchLogs} disabled={loading} size="sm"
            className="h-8 px-3 text-xs font-bold bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-400/20">
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Suchen
          </Button>
        </div>
      </EnterpriseCard>

      {/* TABLE */}
      <EnterpriseCard noPadding className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="w-[165px] text-[11px] font-bold uppercase tracking-wider">Zeitstempel</TableHead>
                <TableHead className="w-[140px] text-[11px] font-bold uppercase tracking-wider">Akteur</TableHead>
                <TableHead className="w-[110px] text-[11px] font-bold uppercase tracking-wider">Modul</TableHead>
                <TableHead className="w-[160px] text-[11px] font-bold uppercase tracking-wider">Aktion</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                    Keine Einträge gefunden.
                  </TableCell>
                </TableRow>
              )}
              {!loading && logs.map((log) => {
                const modCls = MODULE_COLORS[log.module] ?? "bg-slate-500/10 text-slate-300 border-slate-500/15";
                const payloadStr = log.payload ? JSON.stringify(log.payload) : "";
                return (
                  <TableRow key={log.id} className="border-white/5 hover:bg-white/[0.025]">
                    <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.ts).toLocaleDateString("de-DE")}{" "}
                      <span className="text-foreground/80">{new Date(log.ts).toLocaleTimeString("de-DE")}</span>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{log.actor || "–"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${modCls}`}>
                        {log.module}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-xs tracking-wide">{log.action_type}</span>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground max-w-[400px] truncate" title={payloadStr}>
                      {payloadStr}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </EnterpriseCard>

      <div className="text-right text-[10px] text-muted-foreground">
        {logs.length} Einträge angezeigt{hasActiveFilters ? " (gefiltert)" : ""}
      </div>
    </EnterprisePageShell>
  );
}
