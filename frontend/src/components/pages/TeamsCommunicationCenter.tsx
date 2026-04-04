/* ------------------------------------------------ */
/* TEAMS COMMUNICATION CENTER                      */
/* Full-featured Teams management page             */
/* ------------------------------------------------ */

import React, { useCallback, useEffect, useState } from "react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";
import {
  fetchTeamsStatus, fetchTeamsEvents, updateTeamsEvent,
  fetchTeamsRouting, createTeamsRoutingRule, updateTeamsRoutingRule, deleteTeamsRoutingRule,
  fetchTeamsTemplates, updateTeamsTemplate, previewTemplate,
  fetchTeamsSettings, updateTeamsSettings,
  fetchTeamsLog, fetchTeamsErrors, retryTeamsMessage,
  sendTeamsTestMessage, testTeamsTemplate, fetchTeamsEmployees,
  type TeamsStatus, type TeamsEventConfig, type TeamsRoutingRule,
  type TeamsTemplate, type TeamsMessageLog, type TeamsEmployee,
} from "../../api/teamsConfig";
import {
  CheckCircle2, XCircle, AlertTriangle, Send, RefreshCw, Settings, Mail,
  Users, FileText, TestTube, Clock, Zap, Eye, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Loader2, Play, RotateCcw
} from "lucide-react";
import { InfoTooltip } from "../ui/InfoTooltip";

/* ---- Tab type ---- */
type TabId = "overview" | "events" | "routing" | "templates" | "test" | "log" | "errors" | "settings";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview",  label: "Übersicht",      icon: Eye },
  { id: "events",    label: "Events",         icon: Zap },
  { id: "routing",   label: "Routing",        icon: Users },
  { id: "templates", label: "Templates",      icon: FileText },
  { id: "test",      label: "Test Center",    icon: TestTube },
  { id: "log",       label: "Verlauf",        icon: Clock },
  { id: "errors",    label: "Fehler & Retry", icon: AlertTriangle },
  { id: "settings",  label: "Einstellungen",  icon: Settings },
];

export default function TeamsCommunicationCenter() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <EnterprisePageShell>
      <EnterpriseHeader title="Teams Communication Center" subtitle="Microsoft Teams Nachrichtensteuerung" />
      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === t.id
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "events" && <EventsTab />}
      {activeTab === "routing" && <RoutingTab />}
      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "test" && <TestCenterTab />}
      {activeTab === "log" && <LogTab />}
      {activeTab === "errors" && <ErrorsTab />}
      {activeTab === "settings" && <SettingsTab />}
    </EnterprisePageShell>
  );
}

/* ================================================ */
/* OVERVIEW TAB                                     */
/* ================================================ */

function OverviewTab() {
  const [status, setStatus] = useState<TeamsStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStatus(await fetchTeamsStatus()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;
  if (!status) return <ErrorBox message="Status konnte nicht geladen werden" />;

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${ok ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
      {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {label}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Status Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex items-center gap-1">
          <StatusBadge ok={status.webhook_configured} label="Webhook" />
          <InfoTooltip title="Webhook-Status">
            <p><strong>Bedeutung:</strong> Zeigt an, ob der Microsoft Teams Webhook-Endpunkt konfiguriert ist. Der Webhook wird benötigt, um Nachrichten in Teams-Kanäle zu senden.</p>
            <p><strong>Nicht konfiguriert:</strong> Es fehlt die Webhook-URL in den Umgebungsvariablen. Ohne diesen Endpunkt können keine Kanalnachrichten gesendet werden.</p>
          </InfoTooltip>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge ok={status.bot_configured} label="Bot API" />
          <InfoTooltip title="Bot API Status">
            <p><strong>Bedeutung:</strong> Zeigt an, ob der Microsoft Bot Framework Endpunkt konfiguriert ist. Der Bot wird für persönliche 1:1-Nachrichten an Mitarbeiter benötigt.</p>
            <p><strong>Voraussetzung:</strong> Azure Bot Registration, gültige App-ID und Secret. Ohne Bot-Konfiguration können keine persönlichen Benachrichtigungen versendet werden.</p>
          </InfoTooltip>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge ok={status.graph_configured} label="Graph API" />
          <InfoTooltip title="Microsoft Graph API">
            <p><strong>Bedeutung:</strong> Zeigt an, ob die Microsoft Graph API Credentials (Tenant-ID, Client-ID, Client-Secret) hinterlegt sind.</p>
            <p><strong>Wofür:</strong> Graph API wird benötigt, um Teams-Benutzer aufzulösen (User Resolve), Chat-Installationen zu erstellen und Conversation References zu verwalten.</p>
            <p><strong>Nicht konfiguriert:</strong> User-Mapping und persönliche Nachrichten funktionieren nicht.</p>
          </InfoTooltip>
        </div>
        <div className="flex items-center gap-1">
          <StatusBadge ok={status.mapped_employees > 0} label={`${status.mapped_employees} Mappings`} />
          <InfoTooltip title="Employee Mappings">
            <p><strong>Bedeutung:</strong> Anzahl der Mitarbeiter, deren ODIN-Account mit einem Teams-Benutzer verknüpft ist.</p>
            <p><strong>Wichtig:</strong> Nur gemappte Mitarbeiter können persönliche Teams-Nachrichten erhalten. Mitarbeiter ohne Mapping werden bei persönlichen Benachrichtigungen übersprungen.</p>
          </InfoTooltip>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <EnterpriseCard>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{status.sent_today}</div>
            <div className="text-sm text-gray-500">Gesendet heute</div>
          </div>
        </EnterpriseCard>
        <EnterpriseCard>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{status.failed_today}</div>
            <div className="text-sm text-gray-500">Fehlgeschlagen heute</div>
          </div>
        </EnterpriseCard>
        <EnterpriseCard>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">{status.pending_retries}</div>
            <div className="text-sm text-gray-500">Offene Retries (24h)</div>
          </div>
        </EnterpriseCard>
        <EnterpriseCard>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{status.mapped_employees}</div>
            <div className="text-sm text-gray-500">Gemappte Mitarbeiter</div>
          </div>
        </EnterpriseCard>
      </div>

      {/* Last Success / Error */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EnterpriseCard>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Letzter erfolgreicher Versand</h3>
          {status.last_success ? (
            <div className="text-sm space-y-1">
              <div><span className="text-gray-500">Zeit:</span> {new Date(status.last_success.sent_at).toLocaleString("de-DE")}</div>
              <div><span className="text-gray-500">Typ:</span> {status.last_success.message_type}</div>
              <div><span className="text-gray-500">Empfänger:</span> {status.last_success.recipient || "–"}</div>
            </div>
          ) : <div className="text-gray-400 text-sm">Noch keine Sendung</div>}
        </EnterpriseCard>
        <EnterpriseCard>
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Letzter Fehler</h3>
          {status.last_error ? (
            <div className="text-sm space-y-1">
              <div><span className="text-gray-500">Zeit:</span> {new Date(status.last_error.sent_at).toLocaleString("de-DE")}</div>
              <div><span className="text-gray-500">Typ:</span> {status.last_error.message_type}</div>
              <div className="text-red-600 text-xs font-mono break-all">{status.last_error.error_msg}</div>
            </div>
          ) : <div className="text-green-500 text-sm">Keine Fehler</div>}
        </EnterpriseCard>
      </div>

      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
          <RefreshCw className="w-4 h-4" /> Aktualisieren
        </button>
      </div>
    </div>
  );
}

/* ================================================ */
/* EVENTS TAB                                       */
/* ================================================ */

function EventsTab() {
  const [events, setEvents] = useState<TeamsEventConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEvents(await fetchTeamsEvents()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEvent = async (e: TeamsEventConfig) => {
    try {
      const updated = await updateTeamsEvent(e.event_key, { enabled: !e.enabled });
      setEvents(prev => prev.map(ev => ev.event_key === e.event_key ? updated : ev));
    } catch (err) { console.error(err); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500 mb-4">Welche ODIN-Events lösen Teams-Nachrichten aus? Jedes Event kann einzeln aktiviert/deaktiviert und konfiguriert werden.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Aktiv
                  <InfoTooltip title="Event aktiv/inaktiv">
                    <p>Schaltet das Event ein oder aus. Inaktive Events lösen <em>keine</em> Teams-Nachrichten aus, auch wenn die Bedingung im System eintritt.</p>
                    <p><strong>Wichtig:</strong> Deaktivierung betrifft nur den Nachrichtenversand. Das Event selbst wird weiterhin im System erkannt und geloggt.</p>
                  </InfoTooltip>
                </span>
              </th>
              <th className="py-2 px-3">Event</th>
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Priorität
                  <InfoTooltip title="Event-Priorität">
                    <p>Bestimmt die Dringlichkeit der Nachricht. P1 = höchste Priorität (z. B. kritische Störungen), P5 = niedrigste.</p>
                    <p><strong>Auswirkung:</strong> Höhere Prioritäten umgehen ggf. Quiet Hours und Digest-Bündelung. P1-Nachrichten werden auch nachts gesendet, wenn „Nur kritische nachts" aktiv ist.</p>
                  </InfoTooltip>
                </span>
              </th>
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Modus
                  <InfoTooltip title="Sendemodus">
                    <p><strong>Sofort:</strong> Nachricht wird unmittelbar bei Event-Eintritt versendet.</p>
                    <p><strong>Digest:</strong> Nachricht wird gesammelt und im nächsten Digest-Intervall gebündelt versendet. Reduziert die Anzahl einzelner Benachrichtigungen.</p>
                  </InfoTooltip>
                </span>
              </th>
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Quiet Hours
                  <InfoTooltip title="Quiet Hours beachten">
                    <p>Wenn „Ja": Außerhalb der konfigurierten Betriebszeiten wird die Nachricht zurückgehalten und erst nach Ende der Quiet Hours gesendet.</p>
                    <p>Wenn „Nein": Nachricht wird unabhängig von der Uhrzeit sofort gesendet.</p>
                  </InfoTooltip>
                </span>
              </th>
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Cooldown
                  <InfoTooltip title="Cooldown-Dauer">
                    <p>Mindestzeit zwischen zwei aufeinanderfolgenden Nachrichten desselben Event-Typs. Verhindert Nachrichtenflut bei häufig auftretenden Events.</p>
                    <p><strong>Beispiel:</strong> 30 min Cooldown = nach einer „Crawler stale"-Nachricht wird frühestens 30 Minuten später eine weitere gesendet.</p>
                  </InfoTooltip>
                </span>
              </th>
              <th className="py-2 px-3">
                <span className="flex items-center gap-1">Duplikatschutz
                  <InfoTooltip title="Duplikatschutz">
                    <p>Verhindert, dass identische Nachrichten innerhalb des Duplikat-Fensters mehrfach gesendet werden.</p>
                    <p><strong>Beispiel:</strong> Wenn dasselbe Ticket in zwei aufeinanderfolgenden Runs identisch zugewiesen wird, wird die Nachricht nur einmal gesendet.</p>
                  </InfoTooltip>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map(e => (
              <tr key={e.event_key} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-2 px-3">
                  <button onClick={() => toggleEvent(e)} className="focus:outline-none">
                    {e.enabled
                      ? <ToggleRight className="w-6 h-6 text-green-500" />
                      : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                  </button>
                </td>
                <td className="py-2 px-3 font-medium">{e.label}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.priority <= 1 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : e.priority <= 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                    P{e.priority}
                  </span>
                </td>
                <td className="py-2 px-3 text-gray-500">{e.send_mode === "immediate" ? "Sofort" : "Digest"}</td>
                <td className="py-2 px-3">{e.respect_quiet_hours ? "Ja" : "Nein"}</td>
                <td className="py-2 px-3">{e.cooldown_minutes > 0 ? `${e.cooldown_minutes} min` : "–"}</td>
                <td className="py-2 px-3">{e.deduplicate ? "Ja" : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================ */
/* ROUTING TAB                                      */
/* ================================================ */

function RoutingTab() {
  const [rules, setRules] = useState<TeamsRoutingRule[]>([]);
  const [events, setEvents] = useState<TeamsEventConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({ event_key: "", target_type: "person" as const, target_value: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([fetchTeamsRouting(), fetchTeamsEvents()]);
      setRules(r);
      setEvents(e);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addRule = async () => {
    if (!newRule.event_key || !newRule.target_value) return;
    try {
      const created = await createTeamsRoutingRule(newRule);
      setRules(prev => [...prev, created]);
      setNewRule({ event_key: "", target_type: "person", target_value: "" });
      setShowAdd(false);
    } catch (err) { console.error(err); }
  };

  const removeRule = async (id: number) => {
    try {
      await deleteTeamsRoutingRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err) { console.error(err); }
  };

  if (loading) return <LoadingSpinner />;

  // Group by event_key
  const grouped = rules.reduce<Record<string, TeamsRoutingRule[]>>((acc, r) => {
    (acc[r.event_key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 flex items-center gap-1.5">
          Routing-Regeln: Welche Events gehen an wen?
          <InfoTooltip title="Routing-Regeln" side="right" width="w-96">
            <p>Routing-Regeln bestimmen, welche Personen oder Gruppen bei welchen Events eine Teams-Nachricht erhalten.</p>
            <p><strong>Zieltypen:</strong></p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li><strong>Person:</strong> Einzelne Person (Name oder E-Mail)</li>
              <li><strong>Gruppe:</strong> Z. B. „Dispatcher", „Management", „Leads"</li>
              <li><strong>Rolle:</strong> Schichtrolle (z. B. „dispatcher", „smarthands")</li>
              <li><strong>Schicht:</strong> Aktive Schichtgruppe (z. B. „E1", „L2")</li>
            </ul>
            <p><strong>Beispiel:</strong> Event „Trouble Ticket High" → Routing an Person „Schichtleiter" + Gruppe „Dispatcher".</p>
          </InfoTooltip>
        </p>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          + Regel hinzufügen
        </button>
      </div>

      {showAdd && (
        <EnterpriseCard>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Event</label>
              <select value={newRule.event_key} onChange={e => setNewRule(p => ({ ...p, event_key: e.target.value }))} className="border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800">
                <option value="">Wählen...</option>
                {events.map(e => <option key={e.event_key} value={e.event_key}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Zieltyp</label>
              <select value={newRule.target_type} onChange={e => setNewRule(p => ({ ...p, target_type: e.target.value as any }))} className="border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800">
                <option value="person">Person</option>
                <option value="group">Gruppe</option>
                <option value="role">Rolle</option>
                <option value="shift">Schicht</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Zielwert</label>
              <input value={newRule.target_value} onChange={e => setNewRule(p => ({ ...p, target_value: e.target.value }))} className="border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800" placeholder="Name / Gruppe / Rolle" />
            </div>
            <button onClick={addRule} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">Speichern</button>
          </div>
        </EnterpriseCard>
      )}

      {Object.entries(grouped).map(([eventKey, eventRules]) => (
        <EnterpriseCard key={eventKey}>
          <h3 className="text-sm font-semibold mb-2">{eventRules[0]?.event_label || eventKey}</h3>
          <div className="space-y-1">
            {eventRules.map(r => (
              <div key={r.id} className="flex items-center justify-between py-1 px-2 rounded bg-gray-50 dark:bg-gray-800/50 text-sm">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{r.target_type}</span>
                  <span>{r.target_value}</span>
                  {!r.enabled && <span className="text-xs text-gray-400">(deaktiviert)</span>}
                </div>
                <button onClick={() => removeRule(r.id)} className="text-red-500 hover:text-red-700 text-xs">Entfernen</button>
              </div>
            ))}
          </div>
        </EnterpriseCard>
      ))}
      {Object.keys(grouped).length === 0 && (
        <div className="text-sm text-gray-400 text-center py-8">Noch keine Routing-Regeln definiert.</div>
      )}
    </div>
  );
}

/* ================================================ */
/* TEMPLATES TAB                                    */
/* ================================================ */

function TemplatesTab() {
  const [templates, setTemplates] = useState<TeamsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTemplates(await fetchTeamsTemplates()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (t: TeamsTemplate) => {
    setEditing(t.template_key);
    setEditBody(t.body_text);
    setPreview(null);
  };

  const saveEdit = async (key: string) => {
    try {
      const updated = await updateTeamsTemplate(key, { body_text: editBody });
      setTemplates(prev => prev.map(t => t.template_key === key ? updated : t));
      setEditing(null);
    } catch (err) { console.error(err); }
  };

  const showPreview = async () => {
    try {
      const result = await previewTemplate(editBody);
      setPreview(result.rendered);
    } catch (err) { console.error(err); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">
        Nachrichtenvorlagen mit Platzhaltern.
        <InfoTooltip title="Template-System" side="right" width="w-96">
          <p>Templates definieren den Text, der bei einem Event als Teams-Nachricht versendet wird. Platzhalter werden beim Versand automatisch mit den tatsächlichen Werten ersetzt.</p>
          <p><strong>Verfügbare Platzhalter:</strong></p>
          <ul className="list-disc ml-4 space-y-0.5 font-mono text-[10px]">
            <li>{"{{employeeName}}"} — Name des Mitarbeiters</li>
            <li>{"{{ticketId}}"} — Ticket-Nummer</li>
            <li>{"{{systemName}}"} — Betroffenes System</li>
            <li>{"{{restTime}}"} — Verbleibende Zeit bis Commit</li>
            <li>{"{{priority}}"} — Ticket-Priorität</li>
            <li>{"{{shift}}"} — Aktuelle Schicht</li>
            <li>{"{{reason}}"} — Ereignisgrund</li>
          </ul>
          <p><strong>Tipp:</strong> Verwenden Sie die Vorschau-Funktion, um das gerenderte Template mit Beispieldaten zu prüfen.</p>
        </InfoTooltip>
      </p>
      {templates.map(t => (
        <EnterpriseCard key={t.template_key}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-sm font-semibold">{t.title}</h3>
              <span className="text-xs text-gray-400">{t.template_key}</span>
            </div>
            {editing !== t.template_key && (
              <button onClick={() => startEdit(t)} className="text-xs text-blue-600 hover:text-blue-800">Bearbeiten</button>
            )}
          </div>

          {editing === t.template_key ? (
            <div className="space-y-2">
              <textarea
                value={editBody}
                onChange={e => setEditBody(e.target.value)}
                className="w-full border dark:border-gray-600 rounded p-2 text-sm font-mono bg-white dark:bg-gray-800 min-h-[80px]"
                rows={4}
              />
              <div className="flex gap-2">
                <button onClick={showPreview} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">Vorschau</button>
                <button onClick={() => saveEdit(t.template_key)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Speichern</button>
                <button onClick={() => setEditing(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Abbrechen</button>
              </div>
              {preview && (
                <div className="mt-2 p-3 rounded bg-blue-50 dark:bg-blue-900/20 text-sm border border-blue-200 dark:border-blue-800">
                  <div className="text-xs text-blue-600 font-semibold mb-1">Vorschau:</div>
                  <div>{preview}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800/50 rounded p-2">{t.body_text}</div>
          )}

          <div className="flex gap-3 mt-2 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-0.5">Deep-Link: {t.include_deep_link ? "Ja" : "Nein"}
              <InfoTooltip title="Deep-Link">
                <p>Fügt der Nachricht einen direkten Link zum Ticket im OES-System hinzu. Der Empfänger kann mit einem Klick zum Ticket springen.</p>
                <p><strong>Empfehlung:</strong> Immer aktiviert lassen, um die Reaktionszeit zu verkürzen.</p>
              </InfoTooltip>
            </span>
            <span className="flex items-center gap-0.5">Ticketdetails: {t.include_ticket_details ? "Ja" : "Nein"}
              <InfoTooltip title="Ticketdetails">
                <p>Blendet eine Zusammenfassung der Ticketdaten direkt in der Nachricht ein (System, Kategorie, Erstelldatum).</p>
                <p><strong>Vorteil:</strong> Empfänger sieht sofort den Kontext, ohne das Ticket öffnen zu müssen.</p>
              </InfoTooltip>
            </span>
            <span className="flex items-center gap-0.5">Restzeit: {t.include_remaining_time ? "Ja" : "Nein"}
              <InfoTooltip title="Restzeit">
                <p>Zeigt die verbleibende SLA-Zeit bis zum nächsten Commit-Termin an. Hilft dem Empfänger, die Dringlichkeit einzuschätzen.</p>
                <p><strong>Hinweis:</strong> Nur sinnvoll bei Tickets mit SLA-Bindung.</p>
              </InfoTooltip>
            </span>
            <span className="flex items-center gap-0.5">Prioritätsbadge: {t.include_priority_badge ? "Ja" : "Nein"}
              <InfoTooltip title="Prioritätsbadge">
                <p>Fügt ein farbiges Badge (P1–P4) in die Nachricht ein, das die Priorität visuell hervorhebt.</p>
                <p><strong>Effekt:</strong> Empfänger erkennt auf einen Blick, ob sofortiges Handeln nötig ist.</p>
              </InfoTooltip>
            </span>
          </div>
        </EnterpriseCard>
      ))}
    </div>
  );
}

/* ================================================ */
/* TEST CENTER TAB                                  */
/* ================================================ */

function TestCenterTab() {
  const [channel, setChannel] = useState<"channel" | "personal">("channel");
  const [title, setTitle] = useState("ODIN Test Message");
  const [body, setBody] = useState("Dies ist eine Testnachricht von ODIN.");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  const [templates, setTemplates] = useState<TeamsTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  useEffect(() => {
    fetchTeamsTemplates().then(setTemplates).catch(console.error);
  }, []);

  const sendTest = async () => {
    setSending(true);
    setResult(null);
    try {
      await sendTeamsTestMessage({ channel, title, body });
      setResult({ success: true, message: "Testnachricht erfolgreich gesendet!" });
    } catch (err: any) {
      setResult({ success: false, message: err?.response?.data?.error || "Senden fehlgeschlagen" });
    }
    setSending(false);
  };

  const sendTemplateTest = async () => {
    if (!selectedTemplate) return;
    setSending(true);
    setResult(null);
    try {
      const res = await testTeamsTemplate(selectedTemplate, channel);
      setResult({ success: true, message: `Template "${selectedTemplate}" gesendet!` });
    } catch (err: any) {
      setResult({ success: false, message: err?.response?.data?.error || "Template-Test fehlgeschlagen" });
    }
    setSending(false);
  };

  return (
    <div className="space-y-6">
      {/* Manual Test */}
      <EnterpriseCard>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">Manuelle Testnachricht
          <InfoTooltip title="Manuelle Testnachricht">
            <p>Sendet eine frei formulierte Nachricht über den konfigurierten Teams-Kanal oder als persönliche Nachricht an den Fallback-Empfänger.</p>
            <p><strong>Zweck:</strong> Prüfen, ob die Webhook-/Bot-Verbindung funktioniert, ohne ein echtes Event auszulösen.</p>
            <p><strong>Hinweis:</strong> Diese Nachricht erscheint im Log, wird aber nicht als Event-Benachrichtigung gezählt.</p>
          </InfoTooltip>
        </h3>
        <div className="space-y-3">
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={channel === "channel"} onChange={() => setChannel("channel")} /> Channel
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={channel === "personal"} onChange={() => setChannel("personal")} /> Personal
            </label>
            <InfoTooltip title="Kanal vs. Persönlich">
              <p><strong>Channel:</strong> Nachricht wird in den konfigurierten Teams-Kanal gepostet (sichtbar für alle Kanalmitglieder).</p>
              <p><strong>Personal:</strong> Nachricht wird als 1:1-Chat an den Fallback-Empfänger gesendet (privat).</p>
              <p><strong>Tipp:</strong> Nutzen Sie „Personal" für vertrauliche Tests und „Channel" um die Kanalanbindung zu verifizieren.</p>
            </InfoTooltip>
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel" className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800" />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Nachricht" rows={3} className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800" />
          <button onClick={sendTest} disabled={sending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Testnachricht senden
          </button>
        </div>
      </EnterpriseCard>

      {/* Template Test */}
      <EnterpriseCard>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">Template testen
          <InfoTooltip title="Template-Test">
            <p>Sendet ein konkretes Template mit Beispieldaten über den gewählten Kanal. Die Platzhalter werden mit Testdaten befüllt.</p>
            <p><strong>Nutzen:</strong> Prüft, ob das Template korrekt gerendert wird und alle Platzhalter aufgelöst werden.</p>
            <p><strong>Wichtig:</strong> Die Testnachricht wird im Log unter „test" vermerkt.</p>
          </InfoTooltip>
        </h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800">
              <option value="">Template auswählen...</option>
              {templates.map(t => <option key={t.template_key} value={t.template_key}>{t.title}</option>)}
            </select>
          </div>
          <button onClick={sendTemplateTest} disabled={!selectedTemplate || sending} className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
            <Play className="w-4 h-4" /> Testen
          </button>
        </div>
      </EnterpriseCard>

      {/* Result */}
      {result && (
        <div className={`p-3 rounded text-sm ${result.success ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
          {result.success ? <CheckCircle2 className="w-4 h-4 inline mr-2" /> : <XCircle className="w-4 h-4 inline mr-2" />}
          {result.message}
        </div>
      )}
    </div>
  );
}

/* ================================================ */
/* LOG TAB                                          */
/* ================================================ */

function LogTab() {
  const [data, setData] = useState<{ rows: TeamsMessageLog[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status?: string }>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchTeamsLog({ ...filter, limit: 100 })); } catch (e) { console.error(e); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <select value={filter.status || ""} onChange={e => setFilter(f => ({ ...f, status: e.target.value || undefined }))} className="border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800">
          <option value="">Alle Status</option>
          <option value="sent">Gesendet</option>
          <option value="failed">Fehlgeschlagen</option>
        </select>
        <InfoTooltip title="Status-Filter">
          <p><strong>Gesendet:</strong> Nachricht wurde erfolgreich an Teams übermittelt (HTTP 200/202).</p>
          <p><strong>Fehlgeschlagen:</strong> Nachricht konnte nicht zugestellt werden – siehe Fehlerspalte für Details.</p>
          <p>Der Filter zeigt nur die letzten 100 Einträge an.</p>
        </InfoTooltip>
        <button onClick={load} className="text-sm text-blue-600 hover:underline">Aktualisieren</button>
        <span className="text-xs text-gray-400">{data.total} Einträge gesamt</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
              <th className="py-2 px-3"><span className="flex items-center gap-1">Status <InfoTooltip title="Status"><p>Grüner Haken = zugestellt. Rotes X = fehlgeschlagen. Fehlgeschlagene Nachrichten können im Errors-Tab erneut versendet werden.</p></InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="flex items-center gap-1">Zeitpunkt <InfoTooltip title="Zeitpunkt"><p>Zeitpunkt der Übergabe an die Teams-API (nicht Zustellzeitpunkt beim Empfänger).</p></InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="flex items-center gap-1">Typ <InfoTooltip title="Nachrichtentyp"><p>Der Event-Typ, der die Nachricht ausgelöst hat (z.B. assignment, escalation, handover, test).</p></InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="flex items-center gap-1">Empfänger <InfoTooltip title="Empfänger"><p>Teams-Kanal oder Person. „–" bedeutet Broadcast an den Standardkanal.</p></InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="flex items-center gap-1">Inhalt <InfoTooltip title="Inhalt"><p>Gekürzte Vorschau des Nachrichteninhalts.</p></InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="flex items-center gap-1">Fehler <InfoTooltip title="Fehlermeldung"><p>Technische Fehlermeldung bei fehlgeschlagener Zustellung. Häufige Ursachen: ungültiger Webhook, Netzwerkfehler, Bot-Token abgelaufen.</p></InfoTooltip></span></th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map(msg => (
              <tr key={msg.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-2 px-3">
                  {msg.status === "sent"
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-red-500" />}
                </td>
                <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{new Date(msg.sent_at).toLocaleString("de-DE")}</td>
                <td className="py-2 px-3">{msg.message_type}</td>
                <td className="py-2 px-3">{msg.recipient || "–"}</td>
                <td className="py-2 px-3 max-w-xs truncate">{msg.content}</td>
                <td className="py-2 px-3 text-xs text-red-500 max-w-xs truncate">{msg.error_msg || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================ */
/* ERRORS TAB                                       */
/* ================================================ */

function ErrorsTab() {
  const [errors, setErrors] = useState<TeamsMessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setErrors(await fetchTeamsErrors()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const retry = async (id: number) => {
    setRetrying(id);
    try {
      await retryTeamsMessage(id);
      setErrors(prev => prev.filter(e => e.id !== id));
    } catch (err) { console.error(err); }
    setRetrying(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-4 flex items-center gap-1.5">Fehlgeschlagene Nachrichten – manuelles Retry möglich
        <InfoTooltip title="Fehler & Retry" width="w-96">
          <p>Hier werden alle Nachrichten aufgelistet, deren Zustellung fehlgeschlagen ist. Mögliche Ursachen:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li><strong>Webhook ungültig:</strong> Die URL ist abgelaufen oder wurde in Teams gelöscht.</li>
            <li><strong>Netzwerkfehler:</strong> Der Backend-Server konnte die Teams-API nicht erreichen.</li>
            <li><strong>Bot-Token abgelaufen:</strong> Das OAuth-Token muss erneuert werden.</li>
            <li><strong>Rate Limit:</strong> Zu viele Nachrichten in kurzer Zeit – Teams drosselt die API.</li>
          </ul>
          <p><strong>Retry:</strong> Klicken Sie auf „Retry", um die Nachricht erneut zu senden. Bei Erfolg wird sie aus der Liste entfernt und im Log als „sent" vermerkt.</p>
        </InfoTooltip>
      </p>
      {errors.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
          Keine fehlgeschlagenen Nachrichten
        </div>
      ) : errors.map(e => (
        <EnterpriseCard key={e.id}>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {e.message_type} – {new Date(e.sent_at).toLocaleString("de-DE")}
              </div>
              <div className="text-xs text-gray-500">{e.content}</div>
              <div className="text-xs text-red-500 font-mono">{e.error_msg}</div>
            </div>
            <button
              onClick={() => retry(e.id)}
              disabled={retrying === e.id}
              className="flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded hover:bg-orange-200 disabled:opacity-50"
            >
              {retrying === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Retry
            </button>
          </div>
        </EnterpriseCard>
      ))}
    </div>
  );
}

/* ================================================ */
/* SETTINGS TAB                                     */
/* ================================================ */

function SettingsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSettings(await fetchTeamsSettings()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateTeamsSettings(settings);
      setSettings(updated);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  const fields: { key: string; label: string; type: "text" | "number" | "toggle"; tooltip: React.ReactNode }[] = [
    { key: "quiet_hours_start", label: "Quiet Hours Start", type: "text", tooltip: <><p>Beginn der Ruhezeit im Format HH:MM (z.B. „22:00"). Während der Quiet Hours werden nur kritische Nachrichten zugestellt.</p><p><strong>Tipp:</strong> Setzen Sie den Wert auf die Uhrzeit, ab der Ihr Team nicht mehr im Dienst ist.</p></> },
    { key: "quiet_hours_end", label: "Quiet Hours Ende", type: "text", tooltip: <><p>Ende der Ruhezeit im Format HH:MM (z.B. „06:00"). Ab diesem Zeitpunkt werden alle Nachrichten wieder normal versendet.</p><p><strong>Aufgeschobene Nachrichten:</strong> Nicht-kritische Nachrichten aus der Nacht werden als Digest zusammengefasst.</p></> },
    { key: "quiet_hours_critical_only", label: "Nur kritische nachts", type: "toggle", tooltip: <><p>Wenn aktiv, werden während der Quiet Hours nur Nachrichten mit kritischer Priorität (P1) sofort zugestellt. Alle anderen werden bis zum Ende der Ruhezeit zurückgehalten.</p><p><strong>Deaktiviert:</strong> Alle Nachrichten werden auch nachts sofort gesendet.</p></> },
    { key: "daily_max_messages", label: "Max. Nachrichten/Tag", type: "number", tooltip: <><p>Maximale Anzahl an Teams-Nachrichten pro Tag. Bei Überschreitung werden weitere Nachrichten in eine Warteschlange gestellt.</p><p><strong>Zweck:</strong> Schützt vor Nachrichtenflut bei Massenevents. Empfehlung: 200–500 je nach Teamgröße.</p></> },
    { key: "digest_interval_minutes", label: "Digest-Intervall (Min)", type: "number", tooltip: <><p>Zeitraum in Minuten, in dem ähnliche Nachrichten zu einem Digest zusammengefasst werden, statt einzeln gesendet zu werden.</p><p><strong>Beispiel:</strong> Bei 15 Min werden alle Assignment-Benachrichtigungen innerhalb von 15 Min zu einer einzelnen Zusammenfassung gebündelt.</p></> },
    { key: "cooldown_default_minutes", label: "Cooldown Standard (Min)", type: "number", tooltip: <><p>Mindestabstand in Minuten zwischen zwei Nachrichten desselben Typs an denselben Empfänger. Verhindert Spam bei schnell aufeinanderfolgenden Events.</p><p><strong>Empfehlung:</strong> 5–15 Minuten, je nach Benachrichtigungstyp.</p></> },
    { key: "escalation_delay_minutes", label: "Eskalationsverzögerung (Min)", type: "number", tooltip: <><p>Wartezeit in Minuten, bevor eine Eskalationsnachricht gesendet wird. Gibt dem primären Empfänger Zeit zu reagieren, bevor die Eskalation greift.</p><p><strong>Beispiel:</strong> Bei 30 Min wird die Eskalation erst 30 Min nach der ersten Benachrichtigung ausgelöst, falls keine Reaktion erfolgt.</p></> },
    { key: "fallback_recipient", label: "Fallback-Empfänger", type: "text", tooltip: <><p>Teams-Benutzer-ID oder E-Mail-Adresse, die als Empfänger verwendet wird, wenn kein spezifischer Empfänger ermittelt werden kann.</p><p><strong>Typisch:</strong> Teamleiter oder Dispatcher-Mailbox. Wird auch für persönliche Testnachrichten verwendet.</p></> },
    { key: "deduplicate_window_minutes", label: "Duplikat-Fenster (Min)", type: "number", tooltip: <><p>Zeitfenster in Minuten, innerhalb dessen identische Nachrichten (gleicher Typ, gleicher Empfänger, gleicher Inhalt) als Duplikat erkannt und unterdrückt werden.</p><p><strong>Empfehlung:</strong> 10–30 Minuten. Zu kurz = Spam, zu lang = verzögerte Updates.</p></> },
  ];

  return (
    <div className="space-y-4">
      <EnterpriseCard>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">{f.label}
                <InfoTooltip title={f.label}>{f.tooltip}</InfoTooltip>
              </label>
              {f.type === "toggle" ? (
                <button
                  onClick={() => setSettings(s => ({ ...s, [f.key]: s[f.key] === "true" ? "false" : "true" }))}
                  className="focus:outline-none"
                >
                  {settings[f.key] === "true"
                    ? <ToggleRight className="w-6 h-6 text-green-500" />
                    : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                </button>
              ) : (
                <input
                  type={f.type}
                  value={settings[f.key] || ""}
                  onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
            Speichern
          </button>
        </div>
      </EnterpriseCard>
    </div>
  );
}

/* ================================================ */
/* SHARED COMPONENTS                                 */
/* ================================================ */

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
      <XCircle className="w-4 h-4 inline mr-2" />
      {message}
    </div>
  );
}
