/* ================================================ */
/* Shift Verification Dashboard Component           */
/* Embeddable tab for Teams Communication Center    */
/* or standalone admin page.                        */
/* ================================================ */

import React, { useCallback, useEffect, useState } from "react";
import { EnterpriseCard } from "../layout/EnterpriseLayout";
import {
  VerificationApi,
  type VerificationSettings,
  type VerificationRecord,
  type VerificationAuditEntry,
} from "../../api/verification";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  Play,
  Loader2,
  ShieldCheck,
  FileText,
} from "lucide-react";

/* ---- Status badge styles ---- */
const STATUS_STYLES: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  verified:    { label: "Verifiziert",     className: "text-green-400 bg-green-500/15 border-green-500/30",  icon: CheckCircle2 },
  pending:     { label: "Pending",         className: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30", icon: Clock },
  sick:        { label: "Krank",           className: "text-red-400 bg-red-500/15 border-red-500/30",       icon: XCircle },
  absent:      { label: "Abwesend",        className: "text-red-400 bg-red-500/15 border-red-500/30",       icon: XCircle },
  wrong_shift: { label: "Andere Schicht",  className: "text-orange-400 bg-orange-500/15 border-orange-500/30", icon: AlertTriangle },
  no_response: { label: "Keine Antwort",   className: "text-gray-400 bg-gray-500/15 border-gray-500/30",    icon: AlertTriangle },
  failed:      { label: "Zustellfehler",   className: "text-gray-400 bg-gray-500/15 border-gray-500/30",    icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || { label: status, className: "text-muted-foreground bg-muted/20 border-muted/30", icon: Clock };
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${style.className}`}>
      <Icon className="w-3 h-3" />
      {style.label}
    </span>
  );
}

/* ---- Sub-tabs ---- */
type SubTab = "status" | "settings" | "audit";

export function ShiftVerificationPanel() {
  const [subTab, setSubTab] = useState<SubTab>("status");
  const [settings, setSettings] = useState<VerificationSettings | null>(null);
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [audit, setAudit] = useState<VerificationAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayData, settingsData] = await Promise.all([
        VerificationApi.getToday(),
        VerificationApi.getSettings(),
      ]);
      setRecords(todayData.records);
      setSettings(settingsData);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const data = await VerificationApi.getAudit({ limit: 50 });
      setAudit(data.entries);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (subTab === "audit") loadAudit();
  }, [subTab, loadAudit]);

  const handleTrigger = async () => {
    setTriggerResult(null);
    try {
      const result = await VerificationApi.trigger();
      setTriggerResult(
        `Gesendet: ${result.triggered} | Übersprungen: ${result.skipped} | Fehler: ${result.failed} | Timeout: ${result.timedOut ?? 0}`
      );
      await refresh();
    } catch (err: any) {
      setTriggerResult(`Fehler: ${err?.response?.data?.error || err?.message}`);
    }
  };

  const handleSettingsUpdate = async (updates: Partial<VerificationSettings>) => {
    try {
      const updated = await VerificationApi.updateSettings(updates);
      setSettings(updated);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Fehler beim Speichern");
    }
  };

  const handleOverride = async (record: VerificationRecord, newStatus: string) => {
    const reason = prompt("Grund für die Statusänderung:");
    if (reason === null) return;
    try {
      await VerificationApi.override({
        employeeName: record.employee_name,
        date: record.date,
        shiftCode: record.shift_code,
        status: newStatus,
        reason: reason || undefined,
      });
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Override fehlgeschlagen");
    }
  };

  /* ---- Summary stats ---- */
  const stats = {
    total: records.length,
    verified: records.filter((r) => r.status === "verified").length,
    pending: records.filter((r) => r.status === "pending").length,
    unavailable: records.filter((r) => ["sick", "absent", "wrong_shift", "no_response", "failed"].includes(r.status)).length,
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 border-b border-white/10 pb-2">
        {([
          { id: "status" as SubTab, label: "Status", icon: ShieldCheck },
          { id: "settings" as SubTab, label: "Einstellungen", icon: Settings },
          { id: "audit" as SubTab, label: "Audit-Log", icon: FileText },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
              subTab === id ? "bg-primary/15 text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={refresh} disabled={loading} className="text-muted-foreground hover:text-foreground p-1.5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2 text-sm">{error}</div>
      )}

      {/* ---- STATUS TAB ---- */}
      {subTab === "status" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Gesamt" value={stats.total} className="text-foreground" />
            <SummaryCard label="Verifiziert" value={stats.verified} className="text-green-400" />
            <SummaryCard label="Pending" value={stats.pending} className="text-yellow-400" />
            <SummaryCard label="Nicht verfügbar" value={stats.unavailable} className="text-red-400" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTrigger}
              disabled={!settings?.enabled}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded hover:bg-primary/30 text-sm font-medium disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Verifizierung jetzt auslösen
            </button>
            {!settings?.enabled && (
              <span className="text-xs text-muted-foreground">Feature ist deaktiviert</span>
            )}
            {triggerResult && (
              <span className="text-xs text-muted-foreground">{triggerResult}</span>
            )}
          </div>

          {/* Records table */}
          {records.length > 0 ? (
            <div className="rounded border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Mitarbeiter</th>
                    <th className="text-left px-3 py-2 font-medium">Schicht</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Gesendet</th>
                    <th className="text-left px-3 py-2 font-medium">Antwort</th>
                    <th className="text-right px-3 py-2 font-medium">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/10">
                      <td className="px-3 py-2 font-medium">{r.employee_name}</td>
                      <td className="px-3 py-2 font-mono">{r.shift_code}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        {r.message_sent_at ? new Date(r.message_sent_at).toLocaleTimeString("de-DE") : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">
                        {r.responded_at ? new Date(r.responded_at).toLocaleTimeString("de-DE") : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) handleOverride(r, e.target.value); }}
                          className="text-xs bg-muted/20 border border-white/10 rounded px-1.5 py-0.5 text-muted-foreground"
                        >
                          <option value="">Override…</option>
                          <option value="verified">→ Verifiziert</option>
                          <option value="absent">→ Abwesend</option>
                          <option value="sick">→ Krank</option>
                          <option value="wrong_shift">→ Andere Schicht</option>
                          <option value="pending">→ Pending</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center py-6 bg-muted/10 rounded border border-white/5">
              Keine Verifizierungseinträge für heute vorhanden
            </div>
          )}
        </div>
      )}

      {/* ---- SETTINGS TAB ---- */}
      {subTab === "settings" && settings && (
        <div className="space-y-4 max-w-lg">
          <SettingsToggle
            label="Verifizierung aktiviert"
            description="Mitarbeiter werden nach Schichtbeginn per Teams kontaktiert"
            value={settings.enabled}
            onChange={(v) => handleSettingsUpdate({ enabled: v })}
          />
          <SettingsNumber
            label="Verzögerung nach Schichtbeginn (Minuten)"
            description="Wie viele Minuten nach dem offiziellen Schichtstart soll die Verifizierungsnachricht gesendet werden?"
            value={settings.delayMinutes}
            onChange={(v) => handleSettingsUpdate({ delayMinutes: v })}
            min={0}
            max={60}
          />
          <SettingsNumber
            label="Timeout (Minuten)"
            description="Nach wie vielen Minuten ohne Antwort wird der Status auf 'no_response' gesetzt?"
            value={settings.timeoutMinutes}
            onChange={(v) => handleSettingsUpdate({ timeoutMinutes: v })}
            min={5}
            max={120}
          />
          <SettingsToggle
            label="Pending blockiert Zuweisung"
            description="Solange keine positive Verifizierung vorliegt, werden keine Tickets automatisch zugewiesen"
            value={settings.pendingBlocksAssignment}
            onChange={(v) => handleSettingsUpdate({ pendingBlocksAssignment: v })}
          />
          <SettingsToggle
            label="Automatische Abwesenheit bei Krankmeldung"
            description="Wenn ein Mitarbeiter 'Krank' meldet, wird automatisch eine Abwesenheit erstellt"
            value={settings.autoAbsentOnSick}
            onChange={(v) => handleSettingsUpdate({ autoAbsentOnSick: v })}
          />
          <SettingsToggle
            label="Automatische Abwesenheit bei Timeout"
            description="Bei fehlender Antwort nach Ablauf des Timeouts automatisch als abwesend markieren"
            value={settings.autoAbsentOnNoResponse}
            onChange={(v) => handleSettingsUpdate({ autoAbsentOnNoResponse: v })}
          />
        </div>
      )}

      {/* ---- AUDIT TAB ---- */}
      {subTab === "audit" && (
        <div className="space-y-2">
          {audit.length > 0 ? (
            <div className="rounded border border-white/10 overflow-hidden max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Zeit</th>
                    <th className="text-left px-3 py-2 font-medium">Mitarbeiter</th>
                    <th className="text-left px-3 py-2 font-medium">Event</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Akteur</th>
                    <th className="text-left px-3 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {audit.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/10">
                      <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("de-DE")}
                      </td>
                      <td className="px-3 py-1.5 font-medium">{a.employee_name}</td>
                      <td className="px-3 py-1.5 font-mono">{a.event_type}</td>
                      <td className="px-3 py-1.5">
                        {a.old_status && a.new_status ? `${a.old_status} → ${a.new_status}` : a.new_status || "—"}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{a.actor}</td>
                      <td className="px-3 py-1.5 text-muted-foreground max-w-[200px] truncate">
                        {a.payload ? JSON.stringify(a.payload) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center py-6 bg-muted/10 rounded border border-white/5">
              Keine Audit-Einträge vorhanden
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Helper Components ---- */

function SummaryCard({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded border border-white/10 bg-muted/10">
      <div className={`text-2xl font-black ${className}`}>{value}</div>
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
    </div>
  );
}

function SettingsToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded border border-white/10 bg-muted/10">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
          value ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function SettingsNumber({
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 999,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded border border-white/10 bg-muted/10">
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= min && n <= max) onChange(n);
        }}
        min={min}
        max={max}
        className="w-20 text-center bg-background border border-white/20 rounded px-2 py-1 text-sm font-mono shrink-0"
      />
    </div>
  );
}
