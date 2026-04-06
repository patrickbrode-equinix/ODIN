/* ================================================ */
/* Shift Admin Settings – Full Configuration Panel  */
/* Shift definitions, rotation rules, fairness,     */
/* planning config, exclusions, preferences         */
/* ================================================ */

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/api';
import { EnterprisePageShell, EnterpriseHeader, EnterpriseCard } from '../layout/EnterpriseLayout';
import {
  Settings2, Clock, RotateCcw, Scale, Sliders, Users, UserX,
  HelpCircle, Save, Plus, Trash2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Palette, Shield
} from 'lucide-react';

/* ------------------------------------------------ */
/* TOOLTIP COMPONENT                                */
/* ------------------------------------------------ */

function HelpTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-muted-foreground hover:text-blue-400 transition"
        aria-label="Hilfe"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show && (
        <div className="absolute left-6 top-0 z-50 w-64 p-3 text-xs leading-relaxed rounded-lg border border-blue-500/30 bg-[#0a0f1e]/95 text-muted-foreground shadow-xl">
          {text}
        </div>
      )}
    </span>
  );
}

/* ------------------------------------------------ */
/* TYPES                                            */
/* ------------------------------------------------ */

interface ShiftDefinition {
  id: number; code: string; name: string; short_name: string; shift_type: string;
  start_time: string | null; end_time: string | null; duration_hours: number;
  min_staff: number; max_staff: number; color_hex: string; is_active: boolean; sort_order: number;
}

interface RotationRules {
  max_consecutive_same: number; max_consecutive_workdays: number; min_free_after_streak: number;
  night_to_early_forbidden: boolean; late_to_early_forbidden: boolean;
  min_hours_between_shifts: number; max_nights_per_month: number; max_weekends_per_month: number;
  weekend_rule: string;
}

interface FairnessRules {
  balance_nights: boolean; balance_weekends: boolean; balance_total_load: boolean;
  max_deviation_percent: number; fairness_vs_preference: string;
}

interface PlanningConfig {
  respect_employee_wishes: boolean; hard_rules_priority: number; soft_wishes_priority: number;
  fairness_priority: number; admin_override_priority: number;
}

interface ShiftplanExclusion {
  id: number; employee_name: string; reason: string; reason_text: string | null;
  is_active: boolean; created_by: string; created_at: string;
}

/* ------------------------------------------------ */
/* SECTION COMPONENT                                */
/* ------------------------------------------------ */

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/20 bg-background/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-background/60 transition"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-foreground">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5 pt-2 border-t border-border/10">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------ */
/* MAIN COMPONENT                                   */
/* ------------------------------------------------ */

export default function ShiftAdminSettings() {
  const [definitions, setDefinitions] = useState<ShiftDefinition[]>([]);
  const [rotation, setRotation] = useState<RotationRules | null>(null);
  const [fairness, setFairness] = useState<FairnessRules | null>(null);
  const [planConfig, setPlanConfig] = useState<PlanningConfig | null>(null);
  const [exclusions, setExclusions] = useState<ShiftplanExclusion[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [newExclusionName, setNewExclusionName] = useState('');

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [defRes, rotRes, fairRes, planRes, exclRes, basisRes] = await Promise.all([
        api.get('/shift-config/definitions'),
        api.get('/shift-config/rotation-rules'),
        api.get('/shift-config/fairness-rules'),
        api.get('/shift-config/planning-config'),
        api.get('/shift-config/exclusions'),
        api.get('/shiftplan-control/planning-basis?month=' + new Date().toISOString().slice(0, 7)).catch(() => ({ data: { basis: { employees: [] } } })),
      ]);
      setDefinitions(defRes.data.definitions || []);
      setRotation(rotRes.data.rules || null);
      setFairness(fairRes.data.rules || null);
      setPlanConfig(planRes.data.config || null);
      setExclusions((exclRes.data.exclusions || []).filter((e: ShiftplanExclusion) => e.is_active));
      setEmployees(basisRes.data.basis?.employees || []);
    } catch (e: any) {
      showToast(e?.response?.data?.error || e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ========================
  // SAVE HANDLERS
  // ========================

  const saveDefinition = async (def: ShiftDefinition) => {
    setSaving(`def-${def.id}`);
    try {
      await api.put(`/shift-config/definitions/${def.id}`, def);
      showToast(`Schicht "${def.name}" gespeichert`);
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Fehler', 'err');
    } finally {
      setSaving('');
    }
  };

  const saveRotation = async () => {
    if (!rotation) return;
    setSaving('rotation');
    try {
      await api.put('/shift-config/rotation-rules', rotation);
      showToast('Rotationsregeln gespeichert');
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Fehler', 'err');
    } finally {
      setSaving('');
    }
  };

  const saveFairness = async () => {
    if (!fairness) return;
    setSaving('fairness');
    try {
      await api.put('/shift-config/fairness-rules', fairness);
      showToast('Fairnessregeln gespeichert');
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Fehler', 'err');
    } finally {
      setSaving('');
    }
  };

  const savePlanConfig = async () => {
    if (!planConfig) return;
    setSaving('planconfig');
    try {
      await api.put('/shift-config/planning-config', planConfig);
      showToast('Planungskonfiguration gespeichert');
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Fehler', 'err');
    } finally {
      setSaving('');
    }
  };

  const addExclusion = async () => {
    if (!newExclusionName.trim()) return;
    try {
      await api.post('/shift-config/exclusions', { employee_name: newExclusionName.trim(), reason: 'admin_override' });
      setNewExclusionName('');
      showToast('Mitarbeiter von Schichtplanung ausgeschlossen');
      loadAll();
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Fehler', 'err');
    }
  };

  const removeExclusion = async (id: number) => {
    try {
      await api.delete(`/shift-config/exclusions/${id}`);
      showToast('Ausschluss aufgehoben');
      loadAll();
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Fehler', 'err');
    }
  };

  const updateDef = (id: number, field: string, value: any) => {
    setDefinitions(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  if (loading) {
    return (
      <EnterprisePageShell style={{ maxWidth: 'none' }}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </EnterprisePageShell>
    );
  }

  return (
    <EnterprisePageShell style={{ maxWidth: 'none' }}>
      <EnterpriseHeader
        icon={<Settings2 className="w-6 h-6 text-blue-400" />}
        title="Schichtplaneinstellungen"
        subtitle="Konfiguration aller Regeln, Schichten, Rotations- und Fairnessparameter"
      />

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm ${toast.type === 'ok' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="space-y-4">
        {/* ======================== */}
        {/* SHIFT DEFINITIONS        */}
        {/* ======================== */}
        <Section title="Schichtdefinitionen" icon={Clock}>
          <p className="text-xs text-muted-foreground mb-4">
            Definiere die verfügbaren Schichtarten. Diese werden bei der automatischen Planung verwendet.
            <HelpTooltip text="Jede Schicht benötigt einen eindeutigen Code (z.B. E1), Zeiten und eine Mindest-/Maximalbesetzung. Die Farbdefinition wird im Export und in der UI verwendet." />
          </p>
          <div className="space-y-3">
            {definitions.map(def => (
              <div key={def.id} className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg border border-border/20 bg-background/60">
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Code</label>
                  <input value={def.code} disabled className="w-full px-2 py-1 text-xs rounded border border-border/30 bg-background/40 text-foreground" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-muted-foreground">Name</label>
                  <input value={def.name} onChange={e => updateDef(def.id, 'name', e.target.value)} className="w-full px-2 py-1 text-xs rounded border border-border/30 bg-background/40 text-foreground focus:border-blue-500/50 focus:outline-none" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Typ</label>
                  <select value={def.shift_type} onChange={e => updateDef(def.id, 'shift_type', e.target.value)} className="w-full px-2 py-1 text-xs rounded border border-border/30 bg-background/40 text-foreground">
                    <option value="early">Früh</option>
                    <option value="late">Spät</option>
                    <option value="night">Nacht</option>
                    <option value="special">Sonder</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Von</label>
                  <input type="time" value={def.start_time || ''} onChange={e => updateDef(def.id, 'start_time', e.target.value)} className="w-full px-1 py-1 text-xs rounded border border-border/30 bg-background/40 text-foreground" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Bis</label>
                  <input type="time" value={def.end_time || ''} onChange={e => updateDef(def.id, 'end_time', e.target.value)} className="w-full px-1 py-1 text-xs rounded border border-border/30 bg-background/40 text-foreground" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Std.</label>
                  <input type="number" value={def.duration_hours} onChange={e => updateDef(def.id, 'duration_hours', parseFloat(e.target.value))} className="w-full px-2 py-1 text-xs rounded border border-border/30 bg-background/40 text-foreground" step="0.5" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Min.</label>
                  <input type="number" value={def.min_staff} onChange={e => updateDef(def.id, 'min_staff', parseInt(e.target.value))} className="w-full px-2 py-1 text-xs rounded border border-border/30 bg-background/40 text-foreground" min="0" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Max.</label>
                  <input type="number" value={def.max_staff} onChange={e => updateDef(def.id, 'max_staff', parseInt(e.target.value))} className="w-full px-2 py-1 text-xs rounded border border-border/30 bg-background/40 text-foreground" min="1" />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] text-muted-foreground">Farbe</label>
                  <div className="flex items-center gap-1">
                    <input type="color" value={def.color_hex} onChange={e => updateDef(def.id, 'color_hex', e.target.value)} className="w-6 h-6 rounded border-none cursor-pointer" />
                    <span className="text-[10px] text-muted-foreground">{def.color_hex}</span>
                  </div>
                </div>
                <div className="col-span-1 flex items-center gap-1">
                  <label className="text-[10px] text-muted-foreground">Aktiv</label>
                  <input type="checkbox" checked={def.is_active} onChange={e => updateDef(def.id, 'is_active', e.target.checked)} className="rounded" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => saveDefinition(def)} disabled={saving === `def-${def.id}`} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50">
                    <Save className="w-3 h-3" />
                    {saving === `def-${def.id}` ? '...' : 'Speichern'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ======================== */}
        {/* ROTATION RULES           */}
        {/* ======================== */}
        <Section title="Rotationsregeln" icon={RotateCcw}>
          {rotation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Max. gleiche Schichten hintereinander <HelpTooltip text="Wie viele Tage in Folge ein Mitarbeiter die gleiche Schichtart arbeiten darf. Danach muss gewechselt werden." /></label>
                  <input type="number" value={rotation.max_consecutive_same} onChange={e => setRotation({ ...rotation, max_consecutive_same: parseInt(e.target.value) })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" min="1" max="30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Max. Arbeitstage in Folge <HelpTooltip text="Maximale Anzahl aufeinanderfolgender Arbeitstage ohne freien Tag." /></label>
                  <input type="number" value={rotation.max_consecutive_workdays} onChange={e => setRotation({ ...rotation, max_consecutive_workdays: parseInt(e.target.value) })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" min="1" max="30" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Min. freie Tage nach Streak <HelpTooltip text="Mindestanzahl freier Tage nachdem die maximale Arbeitstage-Folge erreicht wurde." /></label>
                  <input type="number" value={rotation.min_free_after_streak} onChange={e => setRotation({ ...rotation, min_free_after_streak: parseInt(e.target.value) })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" min="0" max="7" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Min. Ruhestunden <HelpTooltip text="Mindestabstand in Stunden zwischen zwei Schichten. Standard: 11 Stunden (gesetzlich)." /></label>
                  <input type="number" value={rotation.min_hours_between_shifts} onChange={e => setRotation({ ...rotation, min_hours_between_shifts: parseInt(e.target.value) })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" min="8" max="24" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Max. Nachtschichten/Monat <HelpTooltip text="Maximale Anzahl Nachtschichten pro Mitarbeiter pro Monat." /></label>
                  <input type="number" value={rotation.max_nights_per_month} onChange={e => setRotation({ ...rotation, max_nights_per_month: parseInt(e.target.value) })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" min="0" max="31" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Max. Wochenend-Schichten/Monat <HelpTooltip text="Maximale Anzahl Wochenend-Einsätze pro Mitarbeiter pro Monat." /></label>
                  <input type="number" value={rotation.max_weekends_per_month} onChange={e => setRotation({ ...rotation, max_weekends_per_month: parseInt(e.target.value) })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" min="0" max="10" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Wochenend-Regel <HelpTooltip text="'Ausgewogen' verteilt Wochenend-Arbeit gleichmäßig. 'Minimieren' vermeidet Wochenenden wenn möglich." /></label>
                  <select value={rotation.weekend_rule} onChange={e => setRotation({ ...rotation, weekend_rule: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground">
                    <option value="balanced">Ausgewogen</option>
                    <option value="minimize">Minimieren</option>
                    <option value="none">Keine Regel</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={rotation.night_to_early_forbidden} onChange={e => setRotation({ ...rotation, night_to_early_forbidden: e.target.checked })} className="rounded" />
                  Nacht → Früh verboten
                  <HelpTooltip text="Wenn aktiviert, darf nach einer Nachtschicht keine Frühschicht am nächsten Tag folgen." />
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={rotation.late_to_early_forbidden} onChange={e => setRotation({ ...rotation, late_to_early_forbidden: e.target.checked })} className="rounded" />
                  Spät → Früh verboten
                  <HelpTooltip text="Wenn aktiviert, darf nach einer Spätschicht keine Frühschicht am nächsten Tag folgen." />
                </label>
              </div>
              <button onClick={saveRotation} disabled={saving === 'rotation'} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 font-medium">
                <Save className="w-3.5 h-3.5" />
                {saving === 'rotation' ? 'Wird gespeichert...' : 'Rotationsregeln speichern'}
              </button>
            </div>
          )}
        </Section>

        {/* ======================== */}
        {/* FAIRNESS RULES           */}
        {/* ======================== */}
        <Section title="Fairnessregeln" icon={Scale}>
          {fairness && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={fairness.balance_nights} onChange={e => setFairness({ ...fairness, balance_nights: e.target.checked })} className="rounded" />
                  Nachtschichten gleichmäßig verteilen
                  <HelpTooltip text="Wenn aktiviert, werden Nachtschichten so gleichmäßig wie möglich unter allen Mitarbeitern verteilt." />
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={fairness.balance_weekends} onChange={e => setFairness({ ...fairness, balance_weekends: e.target.checked })} className="rounded" />
                  Wochenenden gleichmäßig verteilen
                  <HelpTooltip text="Wenn aktiviert, wird die Anzahl der Wochenendeinsätze gleichmäßig verteilt." />
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={fairness.balance_total_load} onChange={e => setFairness({ ...fairness, balance_total_load: e.target.checked })} className="rounded" />
                  Gesamtbelastung ausgleichen
                  <HelpTooltip text="Wenn aktiviert, wird die Gesamtzahl der Schichten gleichmäßig unter Mitarbeitern verteilt." />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Max. Abweichung (%) <HelpTooltip text="Maximale prozentuale Abweichung der Schichtanzahl zwischen Mitarbeitern. Bei 20% darf der Unterschied max. 20% betragen." /></label>
                  <input type="number" value={fairness.max_deviation_percent} onChange={e => setFairness({ ...fairness, max_deviation_percent: parseInt(e.target.value) })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" min="5" max="100" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Priorität <HelpTooltip text="'Fairness' priorisiert gleiche Verteilung. 'Präferenzen' priorisiert Mitarbeiterwünsche. 'Ausgewogen' versucht beides." /></label>
                  <select value={fairness.fairness_vs_preference} onChange={e => setFairness({ ...fairness, fairness_vs_preference: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground">
                    <option value="fairness">Fairness priorisieren</option>
                    <option value="preference">Präferenzen priorisieren</option>
                    <option value="balanced">Ausgewogen</option>
                  </select>
                </div>
              </div>
              <button onClick={saveFairness} disabled={saving === 'fairness'} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 font-medium">
                <Save className="w-3.5 h-3.5" />
                {saving === 'fairness' ? 'Wird gespeichert...' : 'Fairnessregeln speichern'}
              </button>
            </div>
          )}
        </Section>

        {/* ======================== */}
        {/* PLANNING CONFIG          */}
        {/* ======================== */}
        <Section title="Planungsgewichtung" icon={Sliders}>
          {planConfig && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={planConfig.respect_employee_wishes} onChange={e => setPlanConfig({ ...planConfig, respect_employee_wishes: e.target.checked })} className="rounded" />
                Mitarbeiterwünsche berücksichtigen
                <HelpTooltip text="Wenn aktiviert, werden die individuellen Wünsche der Mitarbeiter (bevorzugte Schichten, gesperrte Tage etc.) bei der Planung berücksichtigt." />
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Harte Regeln (0-100) <HelpTooltip text="Gewichtung der harten Regeln (z.B. max. Arbeitstage, verbotene Schichtfolgen). Höher = strenger angewendet." /></label>
                  <input type="range" min="0" max="100" value={planConfig.hard_rules_priority} onChange={e => setPlanConfig({ ...planConfig, hard_rules_priority: parseInt(e.target.value) })} className="w-full mt-1" />
                  <span className="text-xs text-muted-foreground">{planConfig.hard_rules_priority}%</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Weiche Wünsche (0-100) <HelpTooltip text="Gewichtung der Mitarbeiterwünsche. Höher = Wünsche werden stärker berücksichtigt." /></label>
                  <input type="range" min="0" max="100" value={planConfig.soft_wishes_priority} onChange={e => setPlanConfig({ ...planConfig, soft_wishes_priority: parseInt(e.target.value) })} className="w-full mt-1" />
                  <span className="text-xs text-muted-foreground">{planConfig.soft_wishes_priority}%</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Fairness (0-100) <HelpTooltip text="Gewichtung der Fairness (gleichmäßige Verteilung). Höher = fairere Verteilung bevorzugt." /></label>
                  <input type="range" min="0" max="100" value={planConfig.fairness_priority} onChange={e => setPlanConfig({ ...planConfig, fairness_priority: parseInt(e.target.value) })} className="w-full mt-1" />
                  <span className="text-xs text-muted-foreground">{planConfig.fairness_priority}%</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground flex items-center">Admin-Vorgaben (0-100) <HelpTooltip text="Gewichtung der Administratorvorgaben (z.B. feste Zuweisungen, Sperren). Höher = Admin-Entscheidungen haben mehr Einfluss." /></label>
                  <input type="range" min="0" max="100" value={planConfig.admin_override_priority} onChange={e => setPlanConfig({ ...planConfig, admin_override_priority: parseInt(e.target.value) })} className="w-full mt-1" />
                  <span className="text-xs text-muted-foreground">{planConfig.admin_override_priority}%</span>
                </div>
              </div>
              <button onClick={savePlanConfig} disabled={saving === 'planconfig'} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 font-medium">
                <Save className="w-3.5 h-3.5" />
                {saving === 'planconfig' ? 'Wird gespeichert...' : 'Planungskonfiguration speichern'}
              </button>
            </div>
          )}
        </Section>

        {/* ======================== */}
        {/* SHIFTPLAN EXCLUSIONS     */}
        {/* ======================== */}
        <Section title="Mitarbeiter-Ausschlüsse (Schichtplanung)" icon={UserX}>
          <p className="text-xs text-muted-foreground mb-3">
            Mitarbeiter, die von der automatischen Schichtplanung ausgeschlossen sind.
            <HelpTooltip text="Ausgeschlossene Mitarbeiter werden bei der automatischen Draft-Generierung nicht eingeplant. Der Ausschluss kann jederzeit aufgehoben werden." />
          </p>
          <div className="flex items-center gap-2 mb-4">
            <select
              value={newExclusionName}
              onChange={e => setNewExclusionName(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground"
            >
              <option value="">Mitarbeiter auswählen...</option>
              {employees
                .filter(e => !exclusions.some(ex => ex.employee_name === e))
                .map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <button onClick={addExclusion} disabled={!newExclusionName.trim()} className="flex items-center gap-1 text-xs px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-50 font-medium">
              <UserX className="w-3.5 h-3.5" />
              Ausschließen
            </button>
          </div>
          {exclusions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Keine Mitarbeiter ausgeschlossen.</p>
          ) : (
            <div className="space-y-2">
              {exclusions.map(ex => (
                <div key={ex.id} className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                  <div className="flex items-center gap-3">
                    <UserX className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-foreground">{ex.employee_name}</span>
                    <span className="text-xs text-muted-foreground">von {ex.created_by} am {new Date(ex.created_at).toLocaleDateString('de-DE')}</span>
                  </div>
                  <button onClick={() => removeExclusion(ex.id)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white transition">
                    <Plus className="w-3 h-3" />
                    Zurück in Planung
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </EnterprisePageShell>
  );
}
