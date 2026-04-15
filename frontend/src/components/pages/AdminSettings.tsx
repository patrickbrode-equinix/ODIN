/* ------------------------------------------------ */
/* ADMIN SETTINGS PAGE                              */
/* TV Slides, Thresholds, Feature Toggles, Feedback */
/* ------------------------------------------------ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";
import { useAuth } from "../../context/AuthContext";
import { fetchTvSlideConfig, updateTvSlideConfig, type TvSlideConfig } from "../../api/tvConfig";
import { fetchSettingsAudit, type SettingsAuditEntry } from "../../api/settingsAudit";
import { api } from "../../api/api";
import AssignmentRulesEditor from "./AssignmentRulesEditor";
import { ShiftPlanningSettingsPanel } from "./ShiftAdminSettings";
import { TeamsCommunicationCenterPanel } from "./TeamsCommunicationCenter";
import AccessDenied from "./AccessDenied";
import OdinExclusions from "../odinlogic/OdinExclusions";
import EmployeeExclusions from "../odinlogic/EmployeeExclusions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import {
  Tv, Settings, Zap, MessageSquare, Shield, Clock, Save,
  ToggleLeft, ToggleRight, Loader2,
  History, GripVertical, Brain, Trash2, ShieldBan, UserX, CalendarClock
} from "lucide-react";

type TabId = "shiftplan" | "teams" | "tv" | "thresholds" | "toggles" | "feedback" | "odin" | "manualExclusions" | "employeeExclusions" | "maintenance" | "audit";

const TABS: { id: TabId; label: string; description: string; icon: React.ElementType; accent: string }[] = [
  { id: "shiftplan", label: "Schichtplan", description: "Definitionen, DBS-Pool und Planungsregeln", icon: CalendarClock, accent: "from-sky-500/25 via-cyan-500/10 to-transparent" },
  { id: "teams", label: "Teams", description: "Events, Routing, Templates und Versandregeln zentral pflegen", icon: MessageSquare, accent: "from-cyan-500/25 via-sky-500/10 to-transparent" },
  { id: "tv", label: "TV-Modus", description: "Slides, Reihenfolge und Laufzeiten", icon: Tv, accent: "from-indigo-500/25 via-blue-500/10 to-transparent" },
  { id: "thresholds", label: "Schwellenwerte", description: "Globale Grenzwerte und TV-Parameter", icon: Settings, accent: "from-amber-500/25 via-orange-500/10 to-transparent" },
  { id: "toggles", label: "Feature Toggles", description: "Funktionen ein- und ausschalten", icon: Zap, accent: "from-emerald-500/25 via-green-500/10 to-transparent" },
  { id: "feedback", label: "Feedback", description: "Mail-Empfänger und Upload-Regeln", icon: MessageSquare, accent: "from-rose-500/25 via-pink-500/10 to-transparent" },
  { id: "odin", label: "ODIN-Logik", description: "Zuweisungslogik und Produktivregeln", icon: Brain, accent: "from-violet-500/25 via-fuchsia-500/10 to-transparent" },
  { id: "manualExclusions", label: "Manuelle Ausnahmen", description: "Systeme und Subtypes zentral sperren", icon: ShieldBan, accent: "from-red-500/25 via-rose-500/10 to-transparent" },
  { id: "employeeExclusions", label: "Dauerhafte Ausschlüsse", description: "Mitarbeiter dauerhaft aus ODIN herausnehmen", icon: UserX, accent: "from-slate-500/25 via-slate-400/10 to-transparent" },
  { id: "maintenance", label: "Wartung", description: "Reset- und Bereinigungsaktionen", icon: Trash2, accent: "from-red-600/25 via-orange-500/10 to-transparent" },
  { id: "audit", label: "Änderungsprotokoll", description: "Alle Konfigurationsänderungen nachverfolgen", icon: History, accent: "from-zinc-500/25 via-slate-500/10 to-transparent" },
];

const TAB_ACCESS: Record<TabId, Array<{ pageKey: string; min?: "view" | "write" }>> = {
  shiftplan: [{ pageKey: "shiftplan_control", min: "view" }],
  teams: [{ pageKey: "teams_center", min: "view" }],
  tv: [{ pageKey: "admin_settings", min: "view" }],
  thresholds: [{ pageKey: "admin_settings", min: "view" }],
  toggles: [{ pageKey: "admin_settings", min: "view" }],
  feedback: [{ pageKey: "admin_settings", min: "view" }],
  odin: [{ pageKey: "odin_logic", min: "view" }],
  manualExclusions: [{ pageKey: "odin_logic", min: "view" }],
  employeeExclusions: [{ pageKey: "odin_logic", min: "view" }],
  maintenance: [{ pageKey: "admin_settings", min: "view" }],
  audit: [{ pageKey: "admin_settings", min: "view" }],
};

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export default function AdminSettings() {
  const { canAccess } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessibleTabs = useMemo(
    () => TABS.filter((tab) => TAB_ACCESS[tab.id].some((requirement) => canAccess(requirement.pageKey, requirement.min || "view"))),
    [canAccess]
  );
  const [activeTab, setActiveTab] = useState<TabId | null>(null);

  useEffect(() => {
    const section = searchParams.get("section");
    const fallbackTab = accessibleTabs[0]?.id ?? null;
    const requestedTab = isTabId(section) && accessibleTabs.some((tab) => tab.id === section)
      ? section
      : fallbackTab;

    if (requestedTab && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }

    if (requestedTab && section !== requestedTab) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("section", requestedTab);
        return next;
      });
    }
  }, [activeTab, accessibleTabs, searchParams, setSearchParams]);

  const selectTab = (tabId: TabId) => {
    if (!accessibleTabs.some((tab) => tab.id === tabId)) return;
    setActiveTab(tabId);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("section", tabId);
      return next;
    });
  };

  if (accessibleTabs.length === 0) {
    return <AccessDenied />;
  }

  if (!activeTab) {
    return null;
  }

  const activeMeta = accessibleTabs.find((tab) => tab.id === activeTab) || accessibleTabs[0];

  return (
    <EnterprisePageShell>
      <EnterpriseHeader title="Admin-Einstellungen" subtitle="Zentrale Konfiguration fur Schichtplan, ODIN und Systemfunktionen" />

      <div className="mb-6 rounded-4xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.88))] p-6 text-slate-100 shadow-[0_24px_60px_rgba(2,6,23,0.35)]">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.28em] text-sky-200/70">Kontrollzentrum</div>
          <h2 className="mt-3 text-2xl font-semibold">Alle administrativen Einstellungen an einem Ort</h2>
          <p className="mt-2 text-sm text-slate-300">
            Die Kacheln fuhren direkt in den jeweiligen Konfigurationsbereich. Schichtplan- und Teams-Einstellungen sind jetzt Teil der Admin-Einstellungen und nicht mehr separat ausgelagert.
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {accessibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            className={`group rounded-[28px] border p-5 text-left transition-all duration-200 ${
              activeTab === tab.id
                ? "border-sky-300/40 bg-slate-950 text-slate-100 shadow-[0_20px_50px_rgba(14,165,233,0.16)]"
                : "border-white/10 bg-slate-950/55 text-slate-300 hover:border-sky-300/20 hover:bg-slate-950/75 hover:text-slate-100"
            }`}
          >
            <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${tab.accent} ${activeTab === tab.id ? "text-sky-200" : "text-slate-300 group-hover:text-sky-200"}`}>
              <tab.icon className="h-5 w-5" />
            </div>
            <div className="text-base font-semibold">{tab.label}</div>
            <div className="mt-2 text-sm text-slate-400 group-hover:text-slate-300">{tab.description}</div>
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-[28px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_16px_45px_rgba(2,6,23,0.22)]">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${activeMeta.accent} text-sky-200`}>
            <activeMeta.icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-100">{activeMeta.label}</div>
            <div className="mt-1 text-sm text-slate-400">{activeMeta.description}</div>
          </div>
        </div>
      </div>

      {activeTab === "shiftplan" && <ShiftPlanningSettingsPanel embedded />}
      {activeTab === "teams" && <TeamsCommunicationCenterPanel embedded initialTab="settings" />}
      {activeTab === "tv" && <TVSettingsTab />}
      {activeTab === "thresholds" && <ThresholdsTab />}
      {activeTab === "toggles" && <TogglesTab />}
      {activeTab === "feedback" && <FeedbackTab />}
      {activeTab === "odin" && <OdinRulesTab />}
      {activeTab === "manualExclusions" && <ManualExclusionsTab />}
      {activeTab === "employeeExclusions" && <EmployeeExclusionsTab />}
      {activeTab === "maintenance" && <MaintenanceTab />}
      {activeTab === "audit" && <AuditTab />}
    </EnterprisePageShell>
  );
}

/* ================================================ */
/* TV SETTINGS TAB                                   */
/* ================================================ */

function TVSettingsTab() {
  const [slides, setSlides] = useState<TvSlideConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSlides(await fetchTvSlideConfig()); } catch (e) { console.error(e); }
    setLoading(false);
    setDirty(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateSlide = (slideId: string, field: keyof TvSlideConfig, value: any) => {
    setSlides(prev => prev.map(s => s.slide_id === slideId ? { ...s, [field]: value } : s));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateTvSlideConfig(slides);
      setSlides(updated);
      setDirty(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  const visibleSlides = slides
    .filter((slide) => slide.slide_id !== "assignment")
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Slide-Dauern, Reihenfolge und Sichtbarkeit für den TV-Modus konfigurieren.</p>
      <p className="text-xs text-blue-500/80">Die ODIN-Transparenz wird nicht mehr als eigener TV-Slide geführt, sondern im Header angezeigt, sobald die Automatisierung aktiv ist und Live-Daten vorliegen.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="py-2 px-3 w-8"></th>
              <th className="py-2 px-3">Aktiv</th>
              <th className="py-2 px-3">Slide</th>
              <th className="py-2 px-3">Dauer (Sek.)</th>
              <th className="py-2 px-3">Reihenfolge</th>
              <th className="py-2 px-3">Nur mit Daten</th>
            </tr>
          </thead>
          <tbody>
            {visibleSlides.map(s => (
              <tr key={s.slide_id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-2 px-3 text-gray-300"><GripVertical className="w-4 h-4" /></td>
                <td className="py-2 px-3">
                  <button onClick={() => updateSlide(s.slide_id, "enabled", !s.enabled)} className="focus:outline-none">
                    {s.enabled ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                  </button>
                </td>
                <td className="py-2 px-3 font-medium">{s.label}</td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min={3}
                    max={120}
                    value={Math.round(s.duration_ms / 1000)}
                    onChange={e => updateSlide(s.slide_id, "duration_ms", parseInt(e.target.value) * 1000)}
                    className="w-20 border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-center"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={s.sort_order}
                    onChange={e => updateSlide(s.slide_id, "sort_order", parseInt(e.target.value))}
                    className="w-16 border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-center"
                  />
                </td>
                <td className="py-2 px-3">
                  <button onClick={() => updateSlide(s.slide_id, "only_if_data", !s.only_if_data)} className="focus:outline-none">
                    {s.only_if_data ? <ToggleRight className="w-5 h-5 text-blue-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dirty && (
        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Änderungen speichern
          </button>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400">
        {slides.length > 0 && slides[0].updated_by && (
          <span>Zuletzt geändert von {slides[0].updated_by} am {new Date(slides[0].updated_at!).toLocaleString("de-DE")}</span>
        )}
      </div>
    </div>
  );
}

function OdinRulesTab() {
  return (
    <div className="space-y-4">
      <EnterpriseCard>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">ODIN-Logik</h3>
          <p className="text-sm text-gray-500">
            Die Regeln unten steuern die produktive ODIN-Zuweisungslogik. Änderungen werden versioniert und im Änderungsprotokoll festgehalten.
          </p>
        </div>
      </EnterpriseCard>
      <AssignmentRulesEditor embedded />
    </div>
  );
}

function ManualExclusionsTab() {
  return (
    <div className="space-y-4">
      <EnterpriseCard>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Manuelle Ausnahmeliste</h3>
          <p className="text-sm text-gray-500">
            Systemnamen und Ticket-Subtypes, die ODIN nicht automatisch zuweisen darf, werden zentral in den Admin-Einstellungen gepflegt.
          </p>
        </div>
      </EnterpriseCard>
      <EnterpriseCard>
        <OdinExclusions />
      </EnterpriseCard>
    </div>
  );
}

function EmployeeExclusionsTab() {
  return (
    <div className="space-y-4">
      <EnterpriseCard>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Dauerhafte Ausschlüsse</h3>
          <p className="text-sm text-gray-500">
            Mitarbeiter, die ODIN dauerhaft oder zeitlich begrenzt nicht automatisch berücksichtigen darf, werden hier zentral verwaltet.
          </p>
        </div>
      </EnterpriseCard>
      <EnterpriseCard>
        <EmployeeExclusions />
      </EnterpriseCard>
    </div>
  );
}

function MaintenanceTab() {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (confirmPhrase !== "RESET TICKETS") return;

    setResetting(true);
    try {
      const { data } = await api.post("/app-settings/ticket-db/reset", {
        confirmReset: true,
        changeNote: changeNote || undefined,
      });

      const totalDeletedRows = Number(data?.totalDeletedRows || 0);
      toast.success(`Ticket-Datenbank zurückgesetzt (${totalDeletedRows} Datensätze entfernt)`);
      setConfirmPhrase("");
      setChangeNote("");
      setResetDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Ticket-Datenbank konnte nicht zurückgesetzt werden");
    } finally {
      setResetting(false);
    }
  };

  return (
    <EnterpriseCard>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Ticket-Datenbank zurücksetzen</h3>
          <p className="text-sm text-gray-500 mt-1">
            Löscht die live eingespielten Ticket-, Snapshot- und ODIN-Laufdaten. Manuell gepflegte Stammdaten bleiben erhalten.
          </p>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
          <div className="text-sm font-semibold text-red-600 dark:text-red-400">Betroffene Bereiche</div>
          <div className="text-sm text-red-900/80 dark:text-red-100/70">
            queue_items, expired_tickets, crawler_runs, crawler_run_deltas, snapshots, commit_imports sowie die daraus abgeleiteten ODIN-Run- und Decision-Logs.
          </div>
        </div>

        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
              <Trash2 className="w-4 h-4" />
              Ticket-Datenbank resetten
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ticket-Datenbank wirklich zurücksetzen?</AlertDialogTitle>
              <AlertDialogDescription>
                Diese Aktion löscht alle aktuellen Ticket-Snapshots und ODIN-Läufe. Tippe RESET TICKETS ein, um den Reset freizugeben.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3 py-2">
              <input
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="RESET TICKETS"
                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
              />
              <input
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Optionale Notiz für das Audit-Log"
                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setConfirmPhrase(""); setChangeNote(""); }}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleReset();
                }}
                disabled={resetting || confirmPhrase !== "RESET TICKETS"}
                className="bg-red-600 hover:bg-red-700"
              >
                {resetting ? "Setze zurück..." : "Reset ausführen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </EnterpriseCard>
  );
}

/* ================================================ */
/* THRESHOLDS TAB                                    */
/* ================================================ */

function ThresholdsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/app-settings");
      setSettings(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      // Only send threshold/tv keys
      const filtered = Object.fromEntries(
        Object.entries(settings).filter(([k]) => k.startsWith("threshold.") || k.startsWith("tv."))
      );
      const { data } = await api.put("/app-settings", filtered);
      setSettings(data);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  const thresholds: { key: string; label: string; unit: string }[] = [
    { key: "threshold.crawler_stale_minutes", label: "Crawler veraltet nach", unit: "Minuten" },
    { key: "threshold.commit_risk_hours", label: "Commit-Risiko ab", unit: "Stunden" },
    { key: "threshold.escalation_minutes", label: "Eskalation nach", unit: "Minuten" },
    { key: "threshold.understaffing_missing", label: "Unterbesetzung ab", unit: "fehlende Personen" },
  ];

  const tvSettings: { key: string; label: string; type: "number" | "toggle" | "text"; unit?: string }[] = [
    { key: "tv.default_duration_ms", label: "Standard-Slide-Dauer", type: "number", unit: "ms" },
    { key: "tv.font_scale", label: "Schriftgröße Faktor", type: "number" },
    { key: "tv.compact_cards", label: "Kompakte Karten", type: "toggle" },
    { key: "tv.auto_scroll", label: "Auto-Scroll", type: "toggle" },
    { key: "tv.animations", label: "Animationen", type: "text" },
    { key: "tv.commit_window_hours", label: "Commit-Fenster", type: "number", unit: "Stunden" },
    { key: "tv.show_stale_tickets", label: "Stale Tickets anzeigen", type: "toggle" },
    { key: "tv.crawler_stale_threshold_minutes", label: "TV Crawler-Stale", type: "number", unit: "Minuten" },
  ];

  return (
    <div className="space-y-6">
      <EnterpriseCard>
        <h3 className="text-sm font-semibold mb-4">Globale Schwellenwerte</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {thresholds.map(t => (
            <div key={t.key}>
              <label className="block text-xs text-gray-500 mb-1">{t.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings[t.key] || ""}
                  onChange={e => setSettings(s => ({ ...s, [t.key]: e.target.value }))}
                  className="w-24 border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
                />
                <span className="text-xs text-gray-400">{t.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </EnterpriseCard>

      <EnterpriseCard>
        <h3 className="text-sm font-semibold mb-4">TV-Modus Darstellung</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tvSettings.map(t => (
            <div key={t.key}>
              <label className="block text-xs text-gray-500 mb-1">{t.label}</label>
              {t.type === "toggle" ? (
                <button
                  onClick={() => setSettings(s => ({ ...s, [t.key]: s[t.key] === "true" ? "false" : "true" }))}
                  className="focus:outline-none"
                >
                  {settings[t.key] === "true"
                    ? <ToggleRight className="w-6 h-6 text-green-500" />
                    : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type={t.type}
                    value={settings[t.key] || ""}
                    onChange={e => setSettings(s => ({ ...s, [t.key]: e.target.value }))}
                    className="w-32 border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
                  />
                  {t.unit && <span className="text-xs text-gray-400">{t.unit}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </EnterpriseCard>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Speichern
        </button>
      </div>
    </div>
  );
}

/* ================================================ */
/* TOGGLES TAB                                       */
/* ================================================ */

function TogglesTab() {
  const [toggles, setToggles] = useState<{ key: string; enabled: boolean; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/dashboard/feature-toggles");
      setToggles(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (key: string) => {
    const item = toggles.find(t => t.key === key);
    if (!item) return;
    try {
      await api.put("/dashboard/feature-toggles", { [key]: !item.enabled });
      setToggles(prev => prev.map(t => t.key === key ? { ...t, enabled: !t.enabled } : t));
    } catch (err) { console.error(err); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <EnterpriseCard>
      <h3 className="text-sm font-semibold mb-4">Feature Toggles</h3>
      <div className="space-y-3">
        {toggles.map(t => (
          <div key={t.key} className="flex items-center justify-between py-2 px-3 rounded bg-gray-50 dark:bg-gray-800/50">
            <div>
              <div className="text-sm font-medium">{t.label || t.key}</div>
              <div className="text-xs text-gray-400">{t.key}</div>
            </div>
            <button onClick={() => toggle(t.key)} className="focus:outline-none">
              {t.enabled
                ? <ToggleRight className="w-7 h-7 text-green-500" />
                : <ToggleLeft className="w-7 h-7 text-gray-400" />}
            </button>
          </div>
        ))}
        {toggles.length === 0 && <div className="text-sm text-gray-400 text-center py-4">Keine Feature Toggles konfiguriert</div>}
      </div>
    </EnterpriseCard>
  );
}

/* ================================================ */
/* FEEDBACK TAB                                      */
/* ================================================ */

function FeedbackTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/app-settings");
      const fb = Object.fromEntries(
        Object.entries(data).filter(([k]) => k.startsWith("feedback."))
      );
      setSettings(fb as Record<string, string>);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try { await api.put("/app-settings", settings); } catch (err) { console.error(err); }
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  const fields: { key: string; label: string; type: "text" | "toggle" | "number" }[] = [
    { key: "feedback.enabled", label: "Feedback-Funktion aktiv", type: "toggle" },
    { key: "feedback.recipients", label: "Empfänger (kommagetrennt)", type: "text" },
    { key: "feedback.cc", label: "CC (kommagetrennt)", type: "text" },
    { key: "feedback.subject_prefix", label: "Betreff-Prefix", type: "text" },
    { key: "feedback.allow_attachments", label: "Anhänge erlauben", type: "toggle" },
    { key: "feedback.allow_screenshots", label: "Screenshots erlauben", type: "toggle" },
    { key: "feedback.max_size_mb", label: "Max. Dateigröße (MB)", type: "number" },
    { key: "feedback.save_to_db_on_failure", label: "Bei Fehler in DB speichern", type: "toggle" },
  ];

  return (
    <EnterpriseCard>
      <h3 className="text-sm font-semibold mb-4">Feedback E-Mail Einstellungen</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
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
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Speichern
        </button>
      </div>
    </EnterpriseCard>
  );
}

/* ================================================ */
/* AUDIT TAB                                         */
/* ================================================ */

function AuditTab() {
  const [entries, setEntries] = useState<SettingsAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await fetchSettingsAudit({ domain: domain || undefined, limit: 100 })); } catch (e) { console.error(e); }
    setLoading(false);
  }, [domain]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <select value={domain} onChange={e => setDomain(e.target.value)} className="border dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800">
          <option value="">Alle Bereiche</option>
          <option value="teams">Teams</option>
          <option value="tv">TV-Modus</option>
          <option value="assignment">ODIN-Logik</option>
          <option value="feedback">Feedback</option>
          <option value="maintenance">Wartung</option>
          <option value="app">App-Settings</option>
          <option value="threshold">Schwellenwerte</option>
          <option value="feature_toggle">Feature Toggles</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="py-2 px-3">Zeitpunkt</th>
              <th className="py-2 px-3">Bereich</th>
              <th className="py-2 px-3">Einstellung</th>
              <th className="py-2 px-3">Alt</th>
              <th className="py-2 px-3">Neu</th>
              <th className="py-2 px-3">Von</th>
              <th className="py-2 px-3">Notiz</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-2 px-3 whitespace-nowrap text-gray-500">{new Date(e.created_at).toLocaleString("de-DE")}</td>
                <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700">{e.domain}</span></td>
                <td className="py-2 px-3 font-mono text-xs">{e.setting_key}</td>
                <td className="py-2 px-3 text-xs text-red-500 truncate" style={{ maxWidth: 150 }}>{e.old_value || "–"}</td>
                <td className="py-2 px-3 text-xs text-green-600 truncate" style={{ maxWidth: 150 }}>{e.new_value || "–"}</td>
                <td className="py-2 px-3 text-xs">{e.changed_by}</td>
                <td className="py-2 px-3 text-xs text-gray-400">{e.change_note || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entries.length === 0 && <div className="text-sm text-gray-400 text-center py-8">Keine Änderungen protokolliert</div>}
    </div>
  );
}

/* ---- Shared ---- */
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );
}
