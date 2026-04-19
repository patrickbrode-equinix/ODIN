/* ------------------------------------------------ */
/* ADMIN SETTINGS PAGE                              */
/* TV Slides, Thresholds, Feature Toggles, Feedback */
/* ------------------------------------------------ */

import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { fetchTvSlideConfig, updateTvSlideConfig, type TvSlideConfig } from "../../api/tvConfig";
import { fetchSettingsAudit, type SettingsAuditEntry } from "../../api/settingsAudit";
import { api } from "../../api/api";
import AssignmentRulesEditor from "./AssignmentRulesEditor";
import { ShiftPlanningSettingsPanel } from "./ShiftAdminSettings";
import { TeamsCommunicationCenterPanel } from "./TeamsCommunicationCenter";
import AccessDenied from "./AccessDenied";
import OdinExclusions from "../odinlogic/OdinExclusions";
import EmployeeExclusions from "../odinlogic/EmployeeExclusions";
import { InfoTooltip } from "../ui/InfoTooltip";
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
  History, GripVertical, Brain, Trash2, CalendarClock,
  Scale, Shuffle, BarChart3, CheckCircle2, CircleDot,
} from "lucide-react";

type TabId = "shiftplan" | "teams" | "tv" | "thresholds" | "toggles" | "feedback" | "odin" | "maintenance" | "audit";

const TAB_SPECS: { id: TabId; icon: ElementType; accent: string }[] = [
  { id: "shiftplan", icon: CalendarClock, accent: "from-sky-500/25 via-cyan-500/10 to-transparent" },
  { id: "teams", icon: MessageSquare, accent: "from-cyan-500/25 via-sky-500/10 to-transparent" },
  { id: "tv", icon: Tv, accent: "from-indigo-500/25 via-blue-500/10 to-transparent" },
  { id: "thresholds", icon: Settings, accent: "from-amber-500/25 via-orange-500/10 to-transparent" },
  { id: "toggles", icon: Zap, accent: "from-emerald-500/25 via-green-500/10 to-transparent" },
  { id: "feedback", icon: MessageSquare, accent: "from-rose-500/25 via-pink-500/10 to-transparent" },
  { id: "odin", icon: Brain, accent: "from-violet-500/25 via-fuchsia-500/10 to-transparent" },
  { id: "maintenance", icon: Trash2, accent: "from-red-600/25 via-orange-500/10 to-transparent" },
  { id: "audit", icon: History, accent: "from-zinc-500/25 via-slate-500/10 to-transparent" },
];

function getTabs(t: (key: any) => string, language: string) {
  const isGerman = language === "de";
  return TAB_SPECS.map((tab) => {
    switch (tab.id) {
      case "shiftplan":
        return { ...tab, label: t('admin.tabShiftplan'), description: t('admin.tabShiftplanDesc') };
      case "teams":
        return { ...tab, label: "Teams", description: t('admin.tabTeamsDesc') };
      case "tv":
        return { ...tab, label: t('admin.tabTv'), description: t('admin.tabTvDesc') };
      case "thresholds":
        return { ...tab, label: t('admin.tabThresholds'), description: t('admin.tabThresholdsDesc') };
      case "toggles":
        return { ...tab, label: isGerman ? 'Funktionsschalter' : 'Feature toggles', description: t('admin.tabTogglesDesc') };
      case "feedback":
        return { ...tab, label: t('admin.tabFeedback'), description: t('admin.tabFeedbackDesc') };
      case "odin":
        return { ...tab, label: isGerman ? 'Auto-Zuweisung' : 'Auto assignment', description: t('admin.tabOdinDesc') };
      case "maintenance":
        return { ...tab, label: t('admin.tabMaintenance'), description: t('admin.tabMaintenanceDesc') };
      case "audit":
        return { ...tab, label: t('admin.tabAudit'), description: t('admin.tabAuditDesc') };
      default:
        return { ...tab, label: tab.id, description: tab.id };
    }
  });
}

const TAB_ACCESS: Record<TabId, Array<{ pageKey: string; min?: "view" | "write" }>> = {
  shiftplan: [{ pageKey: "shiftplan_control", min: "view" }],
  teams: [{ pageKey: "teams_center", min: "view" }],
  tv: [{ pageKey: "admin_settings", min: "view" }],
  thresholds: [{ pageKey: "admin_settings", min: "view" }],
  toggles: [{ pageKey: "admin_settings", min: "view" }],
  feedback: [{ pageKey: "admin_settings", min: "view" }],
  odin: [{ pageKey: "odin_logic", min: "view" }],
  maintenance: [{ pageKey: "admin_settings", min: "view" }],
  audit: [{ pageKey: "admin_settings", min: "view" }],
};

const THRESHOLD_HELP: Record<string, { de: ReactNode; en: ReactNode }> = {
  "threshold.crawler_stale_minutes": {
    de: <p>Ab diesem Alter gelten Crawler-Daten als veraltet. ODIN und TV können dann Schutzmechanismen oder Warnungen auslösen.</p>,
    en: <p>After this age, crawler data is treated as stale. ODIN and the TV mode can then trigger safeguards or warnings.</p>,
  },
  "threshold.commit_risk_hours": {
    de: <p>Unterhalb dieser Restzeit werden Tickets im Dashboard und in operativen Ansichten als commit-kritisch behandelt.</p>,
    en: <p>Below this remaining time, tickets are treated as commit-critical in the dashboard and in operational views.</p>,
  },
  "threshold.escalation_minutes": {
    de: <p>Nach dieser Zeit ohne Reaktion können Folgeprozesse oder Eskalationen greifen.</p>,
    en: <p>After this amount of time without a reaction, follow-up processes or escalations can start.</p>,
  },
  "threshold.understaffing_missing": {
    de: <p>Definiert, ab wie vielen fehlenden Personen eine Schicht als unterbesetzt gilt. Diese Schwelle steuert die Unterbesetzungswarnung.</p>,
    en: <p>Defines from how many missing people a shift is considered understaffed. This threshold drives the understaffing warning.</p>,
  },
};

const TV_SETTINGS_HELP: Record<string, { de: ReactNode; en: ReactNode }> = {
  "tv.default_duration_ms": {
    de: <p>Standardlaufzeit pro Slide in Millisekunden. Einzelne Slides können in der Slide-Liste separat überschrieben werden.</p>,
    en: <p>Default runtime per slide in milliseconds. Individual slides can override this value in the slide list.</p>,
  },
  "tv.font_scale": {
    de: <p>Globaler Skalierungsfaktor für TV-Typografie. Höhere Werte vergrößern Texte auf allen Slides.</p>,
    en: <p>Global scaling factor for TV typography. Higher values increase text size on all slides.</p>,
  },
  "tv.compact_cards": {
    de: <p>Reduziert Innenabstände und Kartenhöhen. Sinnvoll für kleine Displays oder hohe Datendichte.</p>,
    en: <p>Reduces internal spacing and card height. Useful for smaller displays or high information density.</p>,
  },
  "tv.auto_scroll": {
    de: <p>Erlaubt automatisches Scrollen in Listen, wenn mehr Inhalte vorhanden sind als auf eine TV-Seite passen.</p>,
    en: <p>Allows lists to scroll automatically when more content exists than fits on one TV page.</p>,
  },
  "tv.animations": {
    de: <p>Steuert das Animationsprofil des TV-Modus, z. B. zurückhaltend oder auffällig.</p>,
    en: <p>Controls the animation profile of the TV mode, for example subtle or attention-grabbing.</p>,
  },
  "tv.commit_window_hours": {
    de: <p>Legt fest, wie weit in die Zukunft commit-relevante Tickets im TV priorisiert gezeigt werden.</p>,
    en: <p>Defines how far into the future commit-relevant tickets are prioritized in the TV mode.</p>,
  },
  "tv.show_stale_tickets": {
    de: <p>Wenn aktiv, bleiben auch ältere Tickets sichtbar. Deaktiviert bedeutet: Fokus auf aktuelle operative Daten.</p>,
    en: <p>If enabled, older tickets remain visible. When disabled, the focus stays on current operational data.</p>,
  },
  "tv.crawler_stale_threshold_minutes": {
    de: <p>Eigene Stale-Schwelle für TV-Anzeigen. Kann bewusst strenger oder lockerer als die globale Schwelle sein.</p>,
    en: <p>Dedicated stale threshold for TV views. It can intentionally be stricter or looser than the global threshold.</p>,
  },
};

const FEEDBACK_HELP: Record<string, { de: ReactNode; en: ReactNode }> = {
  "feedback.enabled": {
    de: <p>Schaltet die Feedback-Funktion insgesamt frei oder aus.</p>,
    en: <p>Enables or disables the feedback feature as a whole.</p>,
  },
  "feedback.allow_screenshots": {
    de: <p>Erlaubt explizit Bild-/Screenshot-Uploads für visuelle Fehlermeldungen.</p>,
    en: <p>Explicitly allows image or screenshot uploads for visual issue reports.</p>,
  },
  "feedback.max_size_mb": {
    de: <p>Maximale Größe aller hochgeladenen Dateien pro Feedback in Megabyte.</p>,
    en: <p>Maximum total size of all uploaded files per feedback entry in megabytes.</p>,
  },
};

type FeedbackEntry = {
  id: number;
  type: string;
  title: string;
  description: string;
  senderName: string | null;
  senderEmail: string | null;
  screenshotName: string | null;
  status: 'open' | 'in_progress' | 'done';
  createdAt: string;
};

const FEATURE_TOGGLE_HELP: Record<string, { de: ReactNode; en: ReactNode }> = {
  auto_assign: {
    de: <p>Schaltet automatische Zuweisungsfunktionen auf Feature-Ebene frei oder aus.</p>,
    en: <p>Enables or disables automatic assignment functions on a feature level.</p>,
  },
  teams_tt: {
    de: <p>Steuert Teams-Benachrichtigungen für Trouble Tickets.</p>,
    en: <p>Controls Teams notifications for trouble tickets.</p>,
  },
  teams_update: {
    de: <p>Erlaubt Update-Nachrichten an Teams bei Status- oder Inhaltsänderungen.</p>,
    en: <p>Allows update messages to Teams when status or content changes.</p>,
  },
  teams_expedite: {
    de: <p>Hebt Expedite-relevante Teams-Kommunikation gesondert hervor.</p>,
    en: <p>Highlights expedite-related Teams communication separately.</p>,
  },
  teams_assign: {
    de: <p>Steuert Teams-Meldungen für echte Ticket-Zuweisungen.</p>,
    en: <p>Controls Teams messages for real ticket assignments.</p>,
  },
  teams_info: {
    de: <p>Aktiviert rein informative Teams-Nachrichten ohne direkte Handlungsaufforderung.</p>,
    en: <p>Enables purely informational Teams messages without a direct action request.</p>,
  },
};

const TV_SLIDE_HELP: Record<string, { de: ReactNode; en: ReactNode }> = {
  active: {
    de: <p>Aktive Slides rotieren im TV-Modus. Inaktive Slides bleiben vollständig verborgen.</p>,
    en: <p>Active slides rotate in TV mode. Inactive slides stay completely hidden.</p>,
  },
  slide: {
    de: <p>Name des Slides. Der Assignment-Slide bildet die ODIN-Zuweisung prominent ab und lässt sich hier genauso steuern wie andere Slides.</p>,
    en: <p>Name of the slide. The assignment slide prominently displays ODIN assignment decisions and can be controlled like any other slide.</p>,
  },
  duration: {
    de: <p>Anzeigezeit dieses Slides in Sekunden. Überschreibt die Standard-Slide-Dauer.</p>,
    en: <p>Display time of this slide in seconds. Overrides the default slide duration.</p>,
  },
  order: {
    de: <p>Bestimmt die Reihenfolge innerhalb der TV-Rotation.</p>,
    en: <p>Determines the order within the TV rotation.</p>,
  },
  data: {
    de: <p>Wenn aktiv, erscheint der Slide nur dann, wenn passende Daten vorhanden sind.</p>,
    en: <p>If enabled, the slide only appears when matching data is available.</p>,
  },
};

function isTabId(value: string | null): value is TabId {
  return TAB_SPECS.some((tab) => tab.id === value);
}

export default function AdminSettings() {
  const { language, t } = useLanguage();
  const isGerman = language === "de";
  const tabs = useMemo(() => getTabs(t, language), [language, t]);
  const { canAccess } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessibleTabs = useMemo(
    () => tabs.filter((tab) => TAB_ACCESS[tab.id].some((requirement) => canAccess(requirement.pageKey, requirement.min || "view"))),
    [canAccess, tabs]
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
      <EnterpriseHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />

      <div className="mb-6 rounded-4xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.88))] p-6 text-slate-100 shadow-[0_24px_60px_rgba(2,6,23,0.35)]">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.28em] text-sky-200/70">{t('admin.controlCenter')}</div>
          <h2 className="mt-3 text-2xl font-semibold">{t('admin.allSettings')}</h2>
          <p className="mt-2 text-sm text-slate-300">
            {t('admin.tilesDescription')}
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
      {activeTab === "maintenance" && <MaintenanceTab />}
      {activeTab === "audit" && <AuditTab />}
    </EnterprisePageShell>
  );
}

/* ================================================ */
/* TV SETTINGS TAB                                   */
/* ================================================ */

function TVSettingsTab() {
  const { language, t } = useLanguage();
  const isGerman = language === "de";
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

  const visibleSlides = [...slides].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-sm text-gray-500">
        <span>{t('admin.tvConfigHint')}</span>
        <InfoTooltip title={t('admin.tvSlides')} side="right" align="start" width="w-96">
          <p>{isGerman ? "Alle TV-Slides werden hier zentral gepflegt. Der Assignment-Slide ist wieder ein regulärer Bestandteil der Rotation und zeigt ODIN-Entscheidungen prominent an." : "All TV slides are maintained centrally here. The assignment slide is a regular part of the rotation again and highlights ODIN decisions prominently."}</p>
        </InfoTooltip>
      </div>
      <p className="text-xs text-blue-500/80">{t('admin.tvHeaderNote')}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="py-2 px-3 w-8"></th>
              <th className="py-2 px-3"><span className="inline-flex items-center gap-1">{t('common.active')} <InfoTooltip title={t('common.active')} side="right">{TV_SLIDE_HELP.active[isGerman ? "de" : "en"]}</InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="inline-flex items-center gap-1">Slide <InfoTooltip title="Slide" side="right">{TV_SLIDE_HELP.slide[isGerman ? "de" : "en"]}</InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="inline-flex items-center gap-1">{t('admin.durationSec')} <InfoTooltip title={t('admin.duration')} side="right">{TV_SLIDE_HELP.duration[isGerman ? "de" : "en"]}</InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="inline-flex items-center gap-1">{t('admin.order')} <InfoTooltip title={t('admin.order')} side="right">{TV_SLIDE_HELP.order[isGerman ? "de" : "en"]}</InfoTooltip></span></th>
              <th className="py-2 px-3"><span className="inline-flex items-center gap-1">{t('admin.onlyWithData')} <InfoTooltip title={t('admin.onlyWithData')} side="right">{TV_SLIDE_HELP.data[isGerman ? "de" : "en"]}</InfoTooltip></span></th>
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
            {t('admin.saveChanges')}
          </button>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400">
        {slides.length > 0 && slides[0].updated_by && (
          <span>{t('admin.lastChangedBy')} {slides[0].updated_by} {t('admin.on')} {new Date(slides[0].updated_at!).toLocaleString(isGerman ? "de-DE" : "en-GB")}</span>
        )}
      </div>
    </div>
  );
}

function OdinRulesTab() {
  const { language, t } = useLanguage();
  const isGerman = language === "de";
  return (
    <div className="space-y-4">
      <EnterpriseCard>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">{t('admin.odinLogic')}</h3>
            <InfoTooltip title={t('admin.odinLogic')} side="right" align="start" width="w-96">
              <p>{isGerman ? "Hier liegen die zentralen Regeln für Priorisierung, Rollen, Lastgrenzen und Ausschlüsse. Damit ist die gesamte operative ODIN-Steuerung an einem Ort gebündelt." : "This is where the core rules for prioritization, roles, load limits, and exclusions live. It bundles the entire operational ODIN control surface in one place."}</p>
            </InfoTooltip>
          </div>
          <p className="text-sm text-gray-500">
            {t('admin.odinLogicDesc')}
          </p>
        </div>
      </EnterpriseCard>
      <EnterpriseCard>
        <AssignmentRulesEditor embedded />
      </EnterpriseCard>
      <EnterpriseCard>
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">{t('admin.ticketExclusions')}</h3>
            <InfoTooltip title={t('admin.ticketExclusions')} side="right" align="start" width="w-96">
              <p>{isGerman ? "Systemnamen und Subtypes in diesem Bereich werden bewusst aus der automatischen Zuweisung ausgeschlossen und landen im manuellen Review." : "System names and subtypes in this area are intentionally excluded from automatic assignment and land in manual review."}</p>
            </InfoTooltip>
          </div>
          <p className="text-sm text-gray-500">{t('admin.ticketExclusionsDesc')}</p>
        </div>
        <OdinExclusions />
      </EnterpriseCard>
      <EnterpriseCard>
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">{t('admin.employeeExclusions')}</h3>
            <InfoTooltip title={t('admin.employeeExclusions')} side="right" align="start" width="w-96">
              <p>{isGerman ? "Hier werden Personen gepflegt, die ODIN dauerhaft oder vorübergehend nicht automatisch berücksichtigen darf." : "Manage people here that ODIN must not consider automatically, either permanently or temporarily."}</p>
            </InfoTooltip>
          </div>
          <p className="text-sm text-gray-500">{t('admin.employeeExclusionsDesc')}</p>
        </div>
        <EmployeeExclusions />
      </EnterpriseCard>
      <FairnessPanel />
    </div>
  );
}

function ManualExclusionsTab() {
  const { language, t } = useLanguage();
  const isGerman = language === "de";
  return (
    <div className="space-y-4">
      <EnterpriseCard>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">{t('admin.manualExclusionList')}</h3>
            <InfoTooltip title={t('admin.manualExclusionList')} side="right" align="start"><p>{isGerman ? "Separater Direktzugriff auf die Ticket-Ausschlusslisten für Systemnamen und Subtypes." : "Separate direct access to the ticket exclusion lists for system names and subtypes."}</p></InfoTooltip>
          </div>
          <p className="text-sm text-gray-500">
            {t('admin.manualExclusionSubDesc')}
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
  const { language, t } = useLanguage();
  const isGerman = language === "de";
  return (
    <div className="space-y-4">
      <EnterpriseCard>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">{t('admin.permanentExclusions')}</h3>
            <InfoTooltip title={t('admin.permanentExclusions')} side="right" align="start"><p>{isGerman ? "Separater Direktzugriff auf Personen, die ODIN bei Auto-Assignments auslassen soll." : "Separate direct access to people ODIN should skip during auto assignments."}</p></InfoTooltip>
          </div>
          <p className="text-sm text-gray-500">
            {t('admin.permanentExclusionsDesc')}
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
  const { language, t } = useLanguage();
  const isGerman = language === "de";
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
      toast.success(isGerman ? `Ticket-Datenbank zurückgesetzt (${totalDeletedRows} Datensätze entfernt)` : `Ticket database reset (${totalDeletedRows} records removed)`);
      setConfirmPhrase("");
      setChangeNote("");
      setResetDialogOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || (isGerman ? "Ticket-Datenbank konnte nicht zurückgesetzt werden" : "Ticket database could not be reset"));
    } finally {
      setResetting(false);
    }
  };

  return (
    <EnterpriseCard>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">{t('admin.resetTicketDb')}</h3>
            <InfoTooltip title={t('admin.resetTicketDb')} side="right" align="start" width="w-96">
              <p>{isGerman ? "Löscht operative Ticket- und Snapshot-Daten, ohne Stammdaten zu entfernen. Diese Aktion ist nur für bereinigte Neustarts oder Wartungsfälle gedacht." : "Deletes operational ticket and snapshot data without removing master data. This action is only intended for clean restarts or maintenance cases."}</p>
            </InfoTooltip>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.resetTicketDbDesc')}
          </p>
        </div>

        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
          <div className="text-sm font-semibold text-red-600 dark:text-red-400">{t('admin.affectedAreas')}</div>
          <div className="text-sm text-red-900/80 dark:text-red-100/70">
            queue_items, expired_tickets, crawler_runs, crawler_run_deltas, snapshots, commit_imports sowie die daraus abgeleiteten ODIN-Run- und Decision-Logs.
          </div>
        </div>

        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogTrigger asChild>
            <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
              <Trash2 className="w-4 h-4" />
              {t('admin.resetTicketDb')}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin.resetDialogTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin.resetDialogDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-3 py-2">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <span>{t('admin.authPhrase')}</span>
                  <InfoTooltip title={t('admin.authPhrase')} side="right"><p>{isGerman ? "Nur wenn exakt RESET TICKETS eingetragen wird, kann der Reset ausgelöst werden." : "The reset can only be triggered if RESET TICKETS is entered exactly."}</p></InfoTooltip>
                </div>
                <input
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder="RESET TICKETS"
                  className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <span>{t('admin.auditNote')}</span>
                  <InfoTooltip title={t('admin.auditNote')} side="right"><p>{isGerman ? "Optionale fachliche Erklärung für das Änderungsprotokoll, z. B. warum ein Reset notwendig war." : "Optional business explanation for the change log, for example why a reset was necessary."}</p></InfoTooltip>
                </div>
                <input
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder={t('admin.auditNotePlaceholder')}
                  className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
                />
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setConfirmPhrase(""); setChangeNote(""); }}>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleReset();
                }}
                disabled={resetting || confirmPhrase !== "RESET TICKETS"}
                className="bg-red-600 hover:bg-red-700"
              >
                {resetting ? t('admin.resetting') : t('admin.runReset')}
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
  const { language, t } = useLanguage();
  const isGerman = language === "de";
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

  const localeKey = isGerman ? "de" : "en";
  const thresholds: { key: string; label: string; unit: string; help: ReactNode }[] = [
    { key: "threshold.crawler_stale_minutes", label: t('admin.crawlerStaleAfter'), unit: t('admin.minutes'), help: THRESHOLD_HELP["threshold.crawler_stale_minutes"][localeKey] },
    { key: "threshold.commit_risk_hours", label: t('admin.commitRiskBelow'), unit: t('admin.hours'), help: THRESHOLD_HELP["threshold.commit_risk_hours"][localeKey] },
    { key: "threshold.escalation_minutes", label: t('admin.escalateAfter'), unit: t('admin.minutes'), help: THRESHOLD_HELP["threshold.escalation_minutes"][localeKey] },
    { key: "threshold.understaffing_missing", label: t('admin.understaffingFrom'), unit: t('admin.missingPeople'), help: THRESHOLD_HELP["threshold.understaffing_missing"][localeKey] },
  ];

  const tvSettings: { key: string; label: string; type: "number" | "toggle" | "text"; unit?: string; help: ReactNode }[] = [
    { key: "tv.default_duration_ms", label: t('admin.defaultSlideDuration'), type: "number", unit: "ms", help: TV_SETTINGS_HELP["tv.default_duration_ms"][localeKey] },
    { key: "tv.font_scale", label: t('admin.fontScaleFactor'), type: "number", help: TV_SETTINGS_HELP["tv.font_scale"][localeKey] },
    { key: "tv.compact_cards", label: t('admin.compactCards'), type: "toggle", help: TV_SETTINGS_HELP["tv.compact_cards"][localeKey] },
    { key: "tv.auto_scroll", label: t('admin.autoScroll'), type: "toggle", help: TV_SETTINGS_HELP["tv.auto_scroll"][localeKey] },
    { key: "tv.animations", label: t('admin.animations'), type: "text", help: TV_SETTINGS_HELP["tv.animations"][localeKey] },
    { key: "tv.commit_window_hours", label: t('admin.commitWindow'), type: "number", unit: t('admin.hours'), help: TV_SETTINGS_HELP["tv.commit_window_hours"][localeKey] },
    { key: "tv.show_stale_tickets", label: t('admin.showStaleTickets'), type: "toggle", help: TV_SETTINGS_HELP["tv.show_stale_tickets"][localeKey] },
    { key: "tv.crawler_stale_threshold_minutes", label: t('admin.tvCrawlerStale'), type: "number", unit: t('admin.minutes'), help: TV_SETTINGS_HELP["tv.crawler_stale_threshold_minutes"][localeKey] },
  ];

  return (
    <div className="space-y-6">
      <EnterpriseCard>
        <div className="mb-4 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold">{t('admin.globalThresholds')}</h3>
          <InfoTooltip title={t('admin.globalThresholds')} side="right" align="start"><p>{isGerman ? "Diese Grenzwerte beeinflussen Warnungen, Eskalationen und TV-/Dashboard-Verhalten systemweit." : "These limits influence warnings, escalations, and TV/dashboard behavior across the system."}</p></InfoTooltip>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {thresholds.map(t => (
            <div key={t.key}>
              <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500"><span>{t.label}</span><InfoTooltip title={t.label} side="right">{t.help}</InfoTooltip></div>
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
        <div className="mb-4 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold">{t('admin.tvModePresentation')}</h3>
          <InfoTooltip title={t('admin.tvModePresentation')} side="right" align="start"><p>{isGerman ? "Diese Werte beeinflussen die generelle Darstellung des TV-Dashboards unabhängig von einzelnen Slides." : "These values influence the overall appearance of the TV dashboard independently of individual slides."}</p></InfoTooltip>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tvSettings.map(t => (
            <div key={t.key}>
              <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500"><span>{t.label}</span><InfoTooltip title={t.label} side="right">{t.help}</InfoTooltip></div>
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
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}

/* ================================================ */
/* TOGGLES TAB                                       */
/* ================================================ */

function TogglesTab() {
  const { language, t } = useLanguage();
  const isGerman = language === "de";
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
      <div className="mb-4 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold">{isGerman ? "Funktionsschalter" : "Feature toggles"}</h3>
        <InfoTooltip title={isGerman ? "Funktionsschalter" : "Feature toggles"} side="right" align="start"><p>{isGerman ? "Funktionsschalter schalten Funktionen kurzfristig frei oder aus, ohne dass dafür Code geändert werden muss." : "Feature toggles enable or disable functions quickly without changing code."}</p></InfoTooltip>
      </div>
      <div className="space-y-3">
        {toggles.map(t => (
          <div key={t.key} className="flex items-center justify-between py-2 px-3 rounded bg-gray-50 dark:bg-gray-800/50">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span>{t.label || t.key}</span>
                <InfoTooltip title={t.label || t.key} side="right">{FEATURE_TOGGLE_HELP[t.key]?.[isGerman ? "de" : "en"] || <p>{isGerman ? `Technischer Schalter für ${t.key}. Nur deaktivieren oder aktivieren, wenn die Auswirkung bekannt ist.` : `Technical switch for ${t.key}. Only disable or enable it if the impact is known.`}</p>}</InfoTooltip>
              </div>
              <div className="text-xs text-gray-400">{t.key}</div>
            </div>
            <button onClick={() => toggle(t.key)} className="focus:outline-none">
              {t.enabled
                ? <ToggleRight className="w-7 h-7 text-green-500" />
                : <ToggleLeft className="w-7 h-7 text-gray-400" />}
            </button>
          </div>
        ))}
        {toggles.length === 0 && <div className="text-sm text-gray-400 text-center py-4">{t('admin.noToggles')}</div>}
      </div>
    </EnterpriseCard>
  );
}

/* ================================================ */
/* FEEDBACK TAB                                      */
/* ================================================ */

function FeedbackTab() {
  const { language, t } = useLanguage();
  const isGerman = language === "de";
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, entriesRes] = await Promise.all([
        api.get("/app-settings"),
        api.get<FeedbackEntry[]>("/feedback/entries", { params: { limit: 100 } }),
      ]);
      const fb = Object.fromEntries(
        Object.entries(data).filter(([k]) => k.startsWith("feedback."))
      );
      setSettings(fb as Record<string, string>);
      setEntries(Array.isArray(entriesRes.data) ? entriesRes.data : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const reloadEntries = useCallback(async () => {
    try {
      const entriesRes = await api.get<FeedbackEntry[]>("/feedback/entries", { params: { limit: 100 } });
      setEntries(Array.isArray(entriesRes.data) ? entriesRes.data : []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/app-settings", settings);
      toast.success(isGerman ? "Einstellungen gespeichert" : "Settings saved");
    } catch (err) {
      console.error(err);
      toast.error(isGerman ? "Fehler beim Speichern" : "Error saving");
    }
    setSaving(false);
  };

  const updateStatus = async (id: number, status: FeedbackEntry['status']) => {
    setUpdatingId(id);
    try {
      const { data } = await api.patch<FeedbackEntry>(`/feedback/entries/${id}/status`, { status });
      setEntries(prev => prev.map(e => e.id === id ? { ...e, ...data } : e));
      toast.success(t('admin.feedbackStatusUpdated'));
    } catch (err) {
      console.error(err);
      toast.error(isGerman ? "Fehler beim Status-Update" : "Error updating status");
    }
    setUpdatingId(null);
  };

  const deleteEntry = async (id: number) => {
    setUpdatingId(id);
    try {
      await api.delete(`/feedback/entries/${id}`);
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success(t('admin.feedbackDeleted'));
    } catch (err) {
      console.error(err);
      toast.error(isGerman ? "Fehler beim Löschen" : "Error deleting");
    }
    setUpdatingId(null);
  };

  if (loading) return <LoadingSpinner />;

  const statusConfig: Record<FeedbackEntry['status'], { label: string; icon: typeof Clock; colorClass: string }> = {
    open: { label: t('admin.feedbackOpen'), icon: Clock, colorClass: 'bg-slate-500/15 text-slate-300' },
    in_progress: { label: t('admin.feedbackInProgress'), icon: CircleDot, colorClass: 'bg-amber-500/15 text-amber-300' },
    done: { label: t('admin.feedbackDone'), icon: CheckCircle2, colorClass: 'bg-emerald-500/15 text-emerald-300' },
  };

  const fields: { key: string; label: string; type: "text" | "toggle" | "number"; help: ReactNode }[] = [
    { key: "feedback.enabled", label: t('admin.feedbackEnabled'), type: "toggle", help: FEEDBACK_HELP["feedback.enabled"][isGerman ? "de" : "en"] },
    { key: "feedback.allow_screenshots", label: t('admin.allowScreenshots'), type: "toggle", help: FEEDBACK_HELP["feedback.allow_screenshots"][isGerman ? "de" : "en"] },
    { key: "feedback.max_size_mb", label: t('admin.maxFileSize'), type: "number", help: FEEDBACK_HELP["feedback.max_size_mb"][isGerman ? "de" : "en"] },
  ];

  return (
    <div className="space-y-4">
      <EnterpriseCard>
        <div className="mb-4 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold">{t('admin.feedbackRules')}</h3>
          <InfoTooltip title={t('admin.feedbackRules')} side="right" align="start"><p>{isGerman ? "Hier steuerst du nur noch, ob Feedback aktiv ist und ob Screenshots in den gespeicherten User-Eintraegen erlaubt sind." : "Control here whether feedback is active and whether screenshots are allowed in stored user entries."}</p></InfoTooltip>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {fields.map(f => (
            <div key={f.key}>
              <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500"><span>{f.label}</span><InfoTooltip title={f.label} side="right">{f.help}</InfoTooltip></div>
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
            {t('common.save')}
          </button>
        </div>
      </EnterpriseCard>

      <EnterpriseCard>
        <div className="mb-4 flex items-center gap-1.5">
          <h3 className="text-sm font-semibold">{t('admin.submittedFeedback')}</h3>
          <InfoTooltip title={t('admin.submittedFeedback')} side="right" align="start"><p>{isGerman ? "Hier erscheinen nur Feedbacks, die Nutzer in ODIN erfasst haben. Mail-Einstellungen oder Weiterleitungen gibt es nicht mehr." : "Only feedback captured directly in ODIN appears here. Mail settings and forwarding are no longer used."}</p></InfoTooltip>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
            {t('admin.noFeedback')}
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const status = statusConfig[entry.status] || statusConfig.open;
              const StatusIcon = status.icon;
              const isUpdating = updatingId === entry.id;

              return (
                <div key={entry.id} className={`rounded-2xl border bg-white/[0.03] p-4 transition ${entry.status === 'done' ? 'border-emerald-500/20 opacity-70' : 'border-white/10'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${entry.type === "Bug" ? "bg-red-500/15 text-red-300" : "bg-blue-500/15 text-blue-300"}`}>
                          {entry.type}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.colorClass}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                        <span className="text-sm font-semibold text-slate-100">{entry.title}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {t('admin.from')} {entry.senderName || entry.senderEmail || t('admin.unknown')} {t('admin.on')} {new Date(entry.createdAt).toLocaleString(isGerman ? "de-DE" : "en-GB")}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {entry.screenshotName ? (
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-300">
                          Screenshot: {entry.screenshotName}
                        </span>
                      ) : null}
                      {/* Status buttons */}
                      {entry.status !== 'in_progress' ? (
                        <button
                          onClick={() => updateStatus(entry.id, 'in_progress')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50"
                          title={t('admin.feedbackInProgress')}
                        >
                          <CircleDot className="w-3 h-3" />
                          {t('admin.feedbackInProgress')}
                        </button>
                      ) : null}
                      {entry.status !== 'done' ? (
                        <button
                          onClick={() => updateStatus(entry.id, 'done')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                          title={t('admin.feedbackDone')}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {t('admin.feedbackDone')}
                        </button>
                      ) : null}
                      {entry.status === 'done' ? (
                        <button
                          onClick={() => updateStatus(entry.id, 'open')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-400/25 bg-slate-500/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-slate-500/20 disabled:opacity-50"
                          title={t('admin.feedbackOpen')}
                        >
                          <Clock className="w-3 h-3" />
                          {t('admin.feedbackOpen')}
                        </button>
                      ) : null}
                      {/* Delete button with confirmation */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            disabled={isUpdating}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-400/25 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                            title={t('admin.feedbackDelete')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('admin.feedbackDeleteTitle')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('admin.feedbackDeleteConfirm')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('admin.feedbackCancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteEntry(entry.id)} className="bg-red-600 hover:bg-red-700">
                              {t('admin.feedbackDelete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                    {entry.description}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </EnterpriseCard>
    </div>
  );
}

/* ================================================ */
/* AUDIT TAB                                         */
/* ================================================ */

function AuditTab() {
  const { language, t } = useLanguage();
  const isGerman = language === "de";
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
          <option value="">{t('admin.allAreas')}</option>
          <option value="teams">Teams</option>
          <option value="tv">{t('admin.tabTv')}</option>
          <option value="assignment">{t('admin.odinLogic')}</option>
          <option value="feedback">Feedback</option>
          <option value="maintenance">{t('admin.tabMaintenance')}</option>
          <option value="app">{t('admin.appSettings')}</option>
          <option value="threshold">{t('admin.tabThresholds')}</option>
          <option value="feature_toggle">{isGerman ? 'Funktionsschalter' : 'Feature toggles'}</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b dark:border-gray-700">
              <th className="py-2 px-3">{t('admin.timestamp')}</th>
              <th className="py-2 px-3">{t('admin.area')}</th>
              <th className="py-2 px-3">{t('admin.setting')}</th>
              <th className="py-2 px-3">{t('admin.old')}</th>
              <th className="py-2 px-3">{t('admin.new')}</th>
              <th className="py-2 px-3">{t('admin.by')}</th>
              <th className="py-2 px-3">{t('admin.note')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-2 px-3 whitespace-nowrap text-gray-500">{new Date(e.created_at).toLocaleString(isGerman ? "de-DE" : "en-GB")}</td>
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
      {entries.length === 0 && <div className="text-sm text-gray-400 text-center py-8">{t('admin.noChangesLogged')}</div>}
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

/* ================================================ */
/* FAIRNESS & VARIETY PANEL (Block 8)               */
/* ================================================ */

interface FairnessSettings {
  consecutive_category_limit: number;
  fair_distribution_mode: 'strict' | 'balanced' | 'relaxed';
  tie_breaker_strategy: 'random' | 'round_robin' | 'least_recent';
  last_assignment_memory_days: number;
  variety_weight: number;
}

const FAIRNESS_DEFAULTS: FairnessSettings = {
  consecutive_category_limit: 0,
  fair_distribution_mode: 'balanced',
  tie_breaker_strategy: 'random',
  last_assignment_memory_days: 7,
  variety_weight: 0.30,
};

const FAIRNESS_COPY = {
  de: {
    title: 'Fairness, Vielfalt & Round-Robin',
    description: 'Steuert, wie ODIN die Arbeit gleichmäßig verteilt und für Abwechslung sorgt. Diese Einstellungen beeinflussen die Tie-Breaker-Logik bei gleichwertigen Kandidaten.',
    consecutiveLimitLabel: 'Max. aufeinanderfolgende Tickets gleicher Kategorie',
    consecutiveLimitHelp: '0 = unbegrenzt. Sobald ein Mitarbeiter diese Grenze erreicht, wird ein Kategorie-Refresh erzwungen.',
    distributionModeLabel: 'Verteilungsmodus',
    distributionStrict: 'Streng egalitär',
    distributionBalanced: 'Ausgewogen (Standard)',
    distributionRelaxed: 'Locker (bevorzugt die schnellste Zuweisung)',
    tieBreakerLabel: 'Tie-Breaker-Strategie',
    tieBreakerRandom: 'Zufällig',
    tieBreakerRoundRobin: 'Round-Robin (reihum)',
    tieBreakerLeastRecent: 'Am längsten ohne Zuweisung',
    memoryDaysLabel: 'Zuweisungsgedächtnis (Tage)',
    memoryDaysHelp: 'ODIN berücksichtigt vergangene Zuweisungen in diesem Zeitfenster für die faire Verteilung.',
    varietyWeightLabel: 'Abwechslungsgewicht',
    varietyWeightHelp: 'Wert zwischen 0 (nur Effizienz) und 1 (maximale Abwechslung). Standard: 0.30',
    saved: 'Fairness-Einstellungen gespeichert',
    saveFailed: 'Fehler beim Speichern',
    saveButton: 'Speichern',
    saving: 'Wird gespeichert…',
  },
  en: {
    title: 'Fairness, variety & round-robin',
    description: 'Controls how ODIN distributes work evenly and ensures variety. These settings influence the tie-breaker logic when candidates are equally qualified.',
    consecutiveLimitLabel: 'Max consecutive tickets of same category',
    consecutiveLimitHelp: '0 = unlimited. Once an employee hits this limit, a category refresh is forced.',
    distributionModeLabel: 'Distribution mode',
    distributionStrict: 'Strict egalitarian',
    distributionBalanced: 'Balanced (default)',
    distributionRelaxed: 'Relaxed (prefers fastest assignment)',
    tieBreakerLabel: 'Tie-breaker strategy',
    tieBreakerRandom: 'Random',
    tieBreakerRoundRobin: 'Round-robin',
    tieBreakerLeastRecent: 'Least recently assigned',
    memoryDaysLabel: 'Assignment memory (days)',
    memoryDaysHelp: 'ODIN considers past assignments in this window for fair distribution.',
    varietyWeightLabel: 'Variety weight',
    varietyWeightHelp: 'Value between 0 (efficiency only) and 1 (maximum variety). Default: 0.30',
    saved: 'Fairness settings saved',
    saveFailed: 'Failed to save',
    saveButton: 'Save',
    saving: 'Saving…',
  },
} as const;

function FairnessPanel() {
  const { language } = useLanguage();
  const copy = FAIRNESS_COPY[language as keyof typeof FAIRNESS_COPY] || FAIRNESS_COPY.en;
  const [settings, setSettings] = useState<FairnessSettings>(FAIRNESS_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/fairness-settings');
      if (res.data?.settings) {
        setSettings({ ...FAIRNESS_DEFAULTS, ...res.data.settings });
      }
    } catch { /* first use */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/fairness-settings', settings);
      toast.success(copy.saved);
      setDirty(false);
    } catch {
      toast.error(copy.saveFailed);
    }
    setSaving(false);
  };

  const update = <K extends keyof FairnessSettings>(key: K, value: FairnessSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  if (loading) return <EnterpriseCard><LoadingSpinner /></EnterpriseCard>;

  return (
    <EnterpriseCard>
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold">{copy.title}</h3>
        </div>
        <p className="text-sm text-gray-500">{copy.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Consecutive category limit */}
        <div>
          <label className="text-xs text-muted-foreground font-medium">{copy.consecutiveLimitLabel}</label>
          <p className="text-[10px] text-muted-foreground/60 mb-1">{copy.consecutiveLimitHelp}</p>
          <input type="number" min={0} max={50} value={settings.consecutive_category_limit}
            onChange={e => update('consecutive_category_limit', Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" />
        </div>

        {/* Distribution mode */}
        <div>
          <label className="text-xs text-muted-foreground font-medium">{copy.distributionModeLabel}</label>
          <select value={settings.fair_distribution_mode} onChange={e => update('fair_distribution_mode', e.target.value as any)}
            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground">
            <option value="strict">{copy.distributionStrict}</option>
            <option value="balanced">{copy.distributionBalanced}</option>
            <option value="relaxed">{copy.distributionRelaxed}</option>
          </select>
        </div>

        {/* Tie-breaker */}
        <div>
          <label className="text-xs text-muted-foreground font-medium">{copy.tieBreakerLabel}</label>
          <select value={settings.tie_breaker_strategy} onChange={e => update('tie_breaker_strategy', e.target.value as any)}
            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground">
            <option value="random">{copy.tieBreakerRandom}</option>
            <option value="round_robin">{copy.tieBreakerRoundRobin}</option>
            <option value="least_recent">{copy.tieBreakerLeastRecent}</option>
          </select>
        </div>

        {/* Memory window */}
        <div>
          <label className="text-xs text-muted-foreground font-medium">{copy.memoryDaysLabel}</label>
          <p className="text-[10px] text-muted-foreground/60 mb-1">{copy.memoryDaysHelp}</p>
          <input type="number" min={1} max={90} value={settings.last_assignment_memory_days}
            onChange={e => update('last_assignment_memory_days', Math.max(1, Math.min(90, parseInt(e.target.value) || 7)))}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" />
        </div>

        {/* Variety weight */}
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground font-medium">{copy.varietyWeightLabel}</label>
          <p className="text-[10px] text-muted-foreground/60 mb-1">{copy.varietyWeightHelp}</p>
          <div className="flex items-center gap-3">
            <input type="range" min={0} max={100} step={5}
              value={Math.round(settings.variety_weight * 100)}
              onChange={e => update('variety_weight', parseInt(e.target.value) / 100)}
              className="flex-1 accent-emerald-500" />
            <span className="text-sm font-mono w-12 text-right text-foreground">{settings.variety_weight.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button onClick={save} disabled={saving || !dirty}
          className="flex items-center gap-1.5 text-sm px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50 font-medium">
          <Save className="w-4 h-4" />
          {saving ? copy.saving : copy.saveButton}
        </button>
      </div>
    </EnterpriseCard>
  );
}
