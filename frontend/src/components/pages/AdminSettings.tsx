/* ------------------------------------------------ */
/* ADMIN SETTINGS PAGE                              */
/* TV Slides, Thresholds, Feature Toggles, Feedback */
/* ------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";
import { fetchTvSlideConfig, updateTvSlideConfig, type TvSlideConfig } from "../../api/tvConfig";
import { fetchSettingsAudit, type SettingsAuditEntry } from "../../api/settingsAudit";
import { api } from "../../api/api";
import {
  Tv, Settings, Zap, MessageSquare, Shield, Clock, Save,
  ToggleLeft, ToggleRight, Loader2, ChevronDown, ChevronRight,
  History, GripVertical
} from "lucide-react";

type TabId = "tv" | "thresholds" | "toggles" | "feedback" | "audit";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "tv",         label: "TV-Modus",             icon: Tv },
  { id: "thresholds", label: "Schwellenwerte",        icon: Settings },
  { id: "toggles",    label: "Feature Toggles",       icon: Zap },
  { id: "feedback",   label: "Feedback",              icon: MessageSquare },
  { id: "audit",      label: "Änderungsprotokoll",    icon: History },
];

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<TabId>("tv");

  return (
    <EnterprisePageShell>
      <EnterpriseHeader title="Admin-Einstellungen" subtitle="Systemkonfiguration und Feature-Flags" />
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

      {activeTab === "tv" && <TVSettingsTab />}
      {activeTab === "thresholds" && <ThresholdsTab />}
      {activeTab === "toggles" && <TogglesTab />}
      {activeTab === "feedback" && <FeedbackTab />}
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Slide-Dauern, Reihenfolge und Sichtbarkeit für den TV-Modus konfigurieren.</p>

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
            {slides.sort((a, b) => a.sort_order - b.sort_order).map(s => (
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
                <td className="py-2 px-3 text-xs text-red-500 max-w-[150px] truncate">{e.old_value || "–"}</td>
                <td className="py-2 px-3 text-xs text-green-600 max-w-[150px] truncate">{e.new_value || "–"}</td>
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
