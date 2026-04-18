/* ================================================ */
/* Shift Admin Settings                             */
/* Reusable panel for Admin Settings + legacy page  */
/* ================================================ */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/api';
import { EnterpriseHeader, EnterprisePageShell } from '../layout/EnterpriseLayout';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Settings2,
  Sliders,
  Star,
  Trash2,
  UserX,
  Users,
} from 'lucide-react';
import { EmployeeSkills, fetchSkills, updateSkills } from '../../api/coverage';
import { useLanguage } from '../../context/LanguageContext';

function getWeekdayOptions(isGerman: boolean) {
  return [
    { value: 1, label: isGerman ? 'Mo' : 'Mon' },
    { value: 2, label: isGerman ? 'Di' : 'Tue' },
    { value: 3, label: isGerman ? 'Mi' : 'Wed' },
    { value: 4, label: isGerman ? 'Do' : 'Thu' },
    { value: 5, label: isGerman ? 'Fr' : 'Fri' },
    { value: 6, label: isGerman ? 'Sa' : 'Sat' },
    { value: 0, label: isGerman ? 'So' : 'Sun' },
  ] as const;
}

function getShiftDayOffsetOptions(isGerman: boolean) {
  return [
    { value: 0, label: isGerman ? 'Plan-Tag' : 'Planned day' },
    { value: 1, label: isGerman ? 'Folgetag' : 'Next day' },
  ] as const;
}

interface ShiftDefinition {
  id: number;
  code: string;
  name: string;
  short_name: string;
  shift_type: string;
  start_time: string | null;
  end_time: string | null;
  start_day_offset: number;
  end_day_offset: number;
  duration_hours: number;
  min_staff: number;
  max_staff: number;
  color_hex: string;
  is_active: boolean;
  sort_order: number;
  applicable_days: number[];
}

interface RotationRules {
  max_consecutive_same: number;
  max_consecutive_workdays: number;
  min_free_after_streak: number;
  night_to_early_forbidden: boolean;
  late_to_early_forbidden: boolean;
  min_hours_between_shifts: number;
  max_nights_per_month: number;
  max_weekends_per_month: number;
  weekend_rule: string;
  free_days_after_night: number;
  free_days_after_weekend: number;
}

interface FairnessRules {
  balance_nights: boolean;
  balance_weekends: boolean;
  balance_total_load: boolean;
  max_deviation_percent: number;
  fairness_vs_preference: string;
}

interface PlanningConfig {
  respect_employee_wishes: boolean;
  hard_rules_priority: number;
  soft_wishes_priority: number;
  fairness_priority: number;
  admin_override_priority: number;
  monthly_target_hours: number;
}

interface ShiftplanExclusion {
  id: number;
  employee_name: string;
  reason: string;
  reason_text: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

interface SpecialPoolEntry {
  id?: number;
  shift_code: string;
  employee_name: string;
  monthly_max_assignments: number;
  sort_order: number;
  is_active: boolean;
}

interface AdvancedPlanningSettings {
  issuePanelEnabled: boolean;
  issueAutoRefresh: boolean;
  issueShowSolutions: boolean;
  issuePriorityMode: 'staffing_first' | 'balanced' | 'fairness_first';
  illnessAutoSwapEnabled: boolean;
  illnessMinSourceBuffer: number;
  illnessMinRestHours: number;
  illnessRequireSkillMatch: boolean;
  illnessProtectWorklifeBalance: boolean;
  weekendVolumeEnabled: boolean;
  weekendBufferPercent: number;
  weekendMinDispatchers: number;
}

interface SkillMatrixProfile extends EmployeeSkills {
  rated_skills: Record<string, number>;
}

const DEFAULT_SKILL_CATALOG = [
  'Cross Connect',
  'Metro Connect',
  'Panel Installation',
  'Deinstalls',
  'Power',
  'Migration',
  'Provide Access',
  'LOS',
  'Colo Planung',
  'Colo Ausfuhrung',
  'Antenne',
  'Begleitung',
] as const;

const DEFAULT_ADVANCED_SETTINGS: AdvancedPlanningSettings = {
  issuePanelEnabled: true,
  issueAutoRefresh: true,
  issueShowSolutions: true,
  issuePriorityMode: 'balanced',
  illnessAutoSwapEnabled: false,
  illnessMinSourceBuffer: 1,
  illnessMinRestHours: 11,
  illnessRequireSkillMatch: true,
  illnessProtectWorklifeBalance: true,
  weekendVolumeEnabled: false,
  weekendBufferPercent: 15,
  weekendMinDispatchers: 1,
};

function parseBooleanSetting(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return fallback;
}

function parseNumberSetting(value: unknown, fallback: number) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractAdvancedPlanningSettings(settings: Record<string, string>): AdvancedPlanningSettings {
  return {
    issuePanelEnabled: parseBooleanSetting(settings['shiftplan.issue_panel_enabled'], DEFAULT_ADVANCED_SETTINGS.issuePanelEnabled),
    issueAutoRefresh: parseBooleanSetting(settings['shiftplan.issue_auto_refresh'], DEFAULT_ADVANCED_SETTINGS.issueAutoRefresh),
    issueShowSolutions: parseBooleanSetting(settings['shiftplan.issue_show_solutions'], DEFAULT_ADVANCED_SETTINGS.issueShowSolutions),
    issuePriorityMode: (settings['shiftplan.issue_priority_mode'] as AdvancedPlanningSettings['issuePriorityMode']) || DEFAULT_ADVANCED_SETTINGS.issuePriorityMode,
    illnessAutoSwapEnabled: parseBooleanSetting(settings['shiftplan.illness_auto_swap_enabled'], DEFAULT_ADVANCED_SETTINGS.illnessAutoSwapEnabled),
    illnessMinSourceBuffer: parseNumberSetting(settings['shiftplan.illness_min_source_buffer'], DEFAULT_ADVANCED_SETTINGS.illnessMinSourceBuffer),
    illnessMinRestHours: parseNumberSetting(settings['shiftplan.illness_min_rest_hours'], DEFAULT_ADVANCED_SETTINGS.illnessMinRestHours),
    illnessRequireSkillMatch: parseBooleanSetting(settings['shiftplan.illness_require_skill_match'], DEFAULT_ADVANCED_SETTINGS.illnessRequireSkillMatch),
    illnessProtectWorklifeBalance: parseBooleanSetting(settings['shiftplan.illness_protect_worklife_balance'], DEFAULT_ADVANCED_SETTINGS.illnessProtectWorklifeBalance),
    weekendVolumeEnabled: parseBooleanSetting(settings['shiftplan.weekend_volume_enabled'], DEFAULT_ADVANCED_SETTINGS.weekendVolumeEnabled),
    weekendBufferPercent: parseNumberSetting(settings['shiftplan.weekend_buffer_percent'], DEFAULT_ADVANCED_SETTINGS.weekendBufferPercent),
    weekendMinDispatchers: parseNumberSetting(settings['shiftplan.weekend_min_dispatchers'], DEFAULT_ADVANCED_SETTINGS.weekendMinDispatchers),
  };
}

function normalizeApplicableDays(value: unknown): number[] {
  const fallback = [1, 2, 3, 4, 5, 6, 0];

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => Number.parseInt(String(entry), 10))
      .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6);
    return normalized.length ? [...new Set(normalized)] : fallback;
  }

  if (typeof value === 'string') {
    try {
      return normalizeApplicableDays(JSON.parse(value));
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function formatApplicableDays(days: number[], weekdayOptions: ReadonlyArray<{ value: number; label: string }>, isGerman: boolean) {
  const normalized = normalizeApplicableDays(days);
  if (normalized.length === weekdayOptions.length) return isGerman ? 'Mo bis So' : 'Mon to Sun';
  return weekdayOptions.filter((option) => normalized.includes(option.value)).map((option) => option.label).join(', ');
}

function normalizeShiftDayOffset(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

function normalizeSkillCatalog(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      return normalizeSkillCatalog(JSON.parse(value));
    } catch {
      return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))];
    }
  }

  return [...DEFAULT_SKILL_CATALOG];
}

function normalizeRatedSkills(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .map(([skill, rating]) => {
        const normalizedSkill = String(skill || '').trim();
        const normalizedRating = Number.parseInt(String(rating ?? ''), 10);

        if (!normalizedSkill) return null;
        if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) return null;

        return [normalizedSkill, normalizedRating];
      })
      .filter(Boolean) as Array<[string, number]>
  );
}

function buildSkillProfile(employeeName: string, existing?: EmployeeSkills): SkillMatrixProfile {
  return {
    employee_name: employeeName,
    can_sh: existing?.can_sh ?? false,
    can_tt: existing?.can_tt ?? false,
    can_cc: existing?.can_cc ?? false,
    updated_at: existing?.updated_at ?? '',
    rated_skills: normalizeRatedSkills(existing?.rated_skills),
  };
}

function formatShiftSpanPreview(definition: ShiftDefinition, shiftDayOffsetOptions: ReadonlyArray<{ value: number; label: string }>, isGerman: boolean) {
  const fallbackLabel = isGerman ? 'Plan-Tag' : 'Planned day';
  const startLabel = shiftDayOffsetOptions.find((option) => option.value === normalizeShiftDayOffset(definition.start_day_offset))?.label || fallbackLabel;
  const endLabel = shiftDayOffsetOptions.find((option) => option.value === normalizeShiftDayOffset(definition.end_day_offset))?.label || fallbackLabel;
  return `${startLabel} ${definition.start_time || '—'} ${isGerman ? 'bis' : 'to'} ${endLabel} ${definition.end_time || '—'}`;
}

function HelpTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow((value) => !value)}
        className="text-muted-foreground hover:text-blue-400 transition"
        aria-label="Hilfe"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show ? (
        <div className="absolute left-6 top-0 z-50 w-64 rounded-lg border border-blue-500/30 bg-[#0a0f1e]/95 p-3 text-xs leading-relaxed text-muted-foreground shadow-xl">
          {text}
        </div>
      ) : null}
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40 shadow-[0_12px_40px_rgba(15,23,42,0.22)] backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold text-slate-100">{title}</div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open ? <div className="border-t border-white/10 px-5 pb-5 pt-4">{children}</div> : null}
    </section>
  );
}

export function ShiftPlanningSettingsPanel({ embedded = false }: { embedded?: boolean }) {
  const { language, t } = useLanguage();
  const isGerman = language === 'de';
  const weekdayOptions = getWeekdayOptions(isGerman);
  const shiftDayOffsetOptions = getShiftDayOffsetOptions(isGerman);
  const [definitions, setDefinitions] = useState<ShiftDefinition[]>([]);
  const [rotation, setRotation] = useState<RotationRules | null>(null);
  const [fairness, setFairness] = useState<FairnessRules | null>(null);
  const [planConfig, setPlanConfig] = useState<PlanningConfig | null>(null);
  const [exclusions, setExclusions] = useState<ShiftplanExclusion[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [dbsPool, setDbsPool] = useState<SpecialPoolEntry[]>([]);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedPlanningSettings>(DEFAULT_ADVANCED_SETTINGS);
  const [skillsEnabled, setSkillsEnabled] = useState(false);
  const [skillCatalog, setSkillCatalog] = useState<string[]>([...DEFAULT_SKILL_CATALOG]);
  const [skillProfiles, setSkillProfiles] = useState<SkillMatrixProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [newExclusionName, setNewExclusionName] = useState('');
  const [newDbsEmployee, setNewDbsEmployee] = useState('');
  const [newSkillName, setNewSkillName] = useState('');

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [defRes, rotRes, fairRes, planRes, exclRes, basisRes, poolRes, appSettingsRes, skillsRes] = await Promise.all([
        api.get('/shift-config/definitions'),
        api.get('/shift-config/rotation-rules'),
        api.get('/shift-config/fairness-rules'),
        api.get('/shift-config/planning-config'),
        api.get('/shift-config/exclusions'),
        api.get('/shiftplan-control/planning-basis?month=' + new Date().toISOString().slice(0, 7)).catch(() => ({ data: { basis: { employees: [] } } })),
        api.get('/shift-config/special-pools/DBS').catch(() => ({ data: { assignments: [] } })),
        api.get('/app-settings').catch(() => ({ data: {} })),
        fetchSkills().catch(() => []),
      ]);

      const loadedEmployees = basisRes.data.basis?.employees || [];
      const configuredSkillCatalog = normalizeSkillCatalog(appSettingsRes.data?.['shiftplan.skill_catalog']);
      const allSkillProfiles = Array.isArray(skillsRes) ? skillsRes : [];
      const knownEmployees = [...new Set([
        ...loadedEmployees,
        ...allSkillProfiles.map((entry) => String(entry.employee_name || '').trim()).filter(Boolean),
      ])].sort((left, right) => left.localeCompare(right, 'de'));
      const skillsByEmployee = new Map(allSkillProfiles.map((entry) => [entry.employee_name, entry]));

      setDefinitions((defRes.data.definitions || []).map((definition: ShiftDefinition) => ({
        ...definition,
        applicable_days: normalizeApplicableDays(definition.applicable_days),
        start_day_offset: normalizeShiftDayOffset(definition.start_day_offset, 0),
        end_day_offset: normalizeShiftDayOffset(definition.end_day_offset, definition.shift_type === 'night' ? 1 : 0),
      })));
      setRotation(rotRes.data.rules || null);
      setFairness(fairRes.data.rules || null);
      setPlanConfig(planRes.data.config || null);
      setExclusions((exclRes.data.exclusions || []).filter((entry: ShiftplanExclusion) => entry.is_active));
      setEmployees(loadedEmployees);
      setDbsPool(poolRes.data.assignments || []);
      setAdvancedSettings(extractAdvancedPlanningSettings(appSettingsRes.data || {}));
      setSkillsEnabled(parseBooleanSetting(appSettingsRes.data?.['shiftplan.skills_enabled'], false));
      setSkillCatalog(configuredSkillCatalog);
      setSkillProfiles(knownEmployees.map((employee) => buildSkillProfile(employee, skillsByEmployee.get(employee))));
    } catch (error: any) {
      showToast(error?.response?.data?.error || error.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveDefinition = async (definition: ShiftDefinition) => {
    setSaving(`def-${definition.id}`);
    try {
      await api.put(`/shift-config/definitions/${definition.id}`, {
        ...definition,
        applicable_days: normalizeApplicableDays(definition.applicable_days),
      });
      showToast(`Schicht "${definition.name}" gespeichert`);
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Fehler', 'err');
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
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Fehler', 'err');
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
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Fehler', 'err');
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
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Fehler', 'err');
    } finally {
      setSaving('');
    }
  };

  const saveAdvancedSettings = async () => {
    setSaving('advanced');
    try {
      await api.put('/app-settings', {
        'shiftplan.issue_panel_enabled': advancedSettings.issuePanelEnabled,
        'shiftplan.issue_auto_refresh': advancedSettings.issueAutoRefresh,
        'shiftplan.issue_show_solutions': advancedSettings.issueShowSolutions,
        'shiftplan.issue_priority_mode': advancedSettings.issuePriorityMode,
        'shiftplan.illness_auto_swap_enabled': advancedSettings.illnessAutoSwapEnabled,
        'shiftplan.illness_min_source_buffer': advancedSettings.illnessMinSourceBuffer,
        'shiftplan.illness_min_rest_hours': advancedSettings.illnessMinRestHours,
        'shiftplan.illness_require_skill_match': advancedSettings.illnessRequireSkillMatch,
        'shiftplan.illness_protect_worklife_balance': advancedSettings.illnessProtectWorklifeBalance,
        'shiftplan.weekend_volume_enabled': advancedSettings.weekendVolumeEnabled,
        'shiftplan.weekend_buffer_percent': advancedSettings.weekendBufferPercent,
        'shiftplan.weekend_min_dispatchers': advancedSettings.weekendMinDispatchers,
      });
      showToast('Autopilot- und Leitstandseinstellungen gespeichert');
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Fehler', 'err');
    } finally {
      setSaving('');
    }
  };

  const saveDbsPool = async () => {
    setSaving('dbs-pool');
    try {
      const payload = dbsPool.map((entry, index) => ({
        employee_name: entry.employee_name,
        monthly_max_assignments: Math.max(Number.parseInt(String(entry.monthly_max_assignments ?? 0), 10) || 0, 0),
        sort_order: index,
      }));
      const { data } = await api.put('/shift-config/special-pools/DBS', { assignments: payload });
      setDbsPool(data.assignments || []);
      showToast('DBS-Pool gespeichert');
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Fehler', 'err');
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
      await loadAll();
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Fehler', 'err');
    }
  };

  const removeExclusion = async (id: number) => {
    try {
      await api.delete(`/shift-config/exclusions/${id}`);
      showToast('Ausschluss aufgehoben');
      await loadAll();
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Fehler', 'err');
    }
  };

  const updateDef = (id: number, field: keyof ShiftDefinition, value: unknown) => {
    setDefinitions((current) => current.map((definition) => definition.id === id ? { ...definition, [field]: value } : definition));
  };

  const toggleApplicableDay = (id: number, day: number) => {
    setDefinitions((current) => current.map((definition) => {
      if (definition.id !== id) return definition;
      const currentDays = normalizeApplicableDays(definition.applicable_days);
      const nextDays = currentDays.includes(day)
        ? currentDays.filter((entry) => entry !== day)
        : [...currentDays, day];
      return { ...definition, applicable_days: normalizeApplicableDays(nextDays) };
    }));
  };

  const addDbsEmployee = () => {
    const employeeName = newDbsEmployee.trim();
    if (!employeeName || dbsPool.some((entry) => entry.employee_name === employeeName)) return;
    setDbsPool((current) => [...current, {
      shift_code: 'DBS',
      employee_name: employeeName,
      monthly_max_assignments: 4,
      sort_order: current.length,
      is_active: true,
    }]);
    setNewDbsEmployee('');
  };

  const updateDbsPoolEntry = (employeeName: string, field: keyof SpecialPoolEntry, value: unknown) => {
    setDbsPool((current) => current.map((entry) => entry.employee_name === employeeName ? { ...entry, [field]: value } : entry));
  };

  const removeDbsEmployee = (employeeName: string) => {
    setDbsPool((current) => current.filter((entry) => entry.employee_name !== employeeName));
  };

  const addSkillToCatalog = () => {
    const skillName = newSkillName.trim();
    if (!skillName) return;

    if (skillCatalog.some((entry) => entry.toLowerCase() === skillName.toLowerCase())) {
      showToast('Skill existiert bereits', 'err');
      return;
    }

    setSkillCatalog((current) => [...current, skillName]);
    setNewSkillName('');
  };

  const removeSkillFromCatalog = (skillName: string) => {
    setSkillCatalog((current) => current.filter((entry) => entry !== skillName));
    setSkillProfiles((current) => current.map((profile) => {
      const nextRatedSkills = { ...profile.rated_skills };
      delete nextRatedSkills[skillName];
      return { ...profile, rated_skills: nextRatedSkills };
    }));
  };

  const setSkillRating = (employeeName: string, skillName: string, rating: number) => {
    setSkillProfiles((current) => current.map((profile) => {
      if (profile.employee_name !== employeeName) return profile;

      const nextRatedSkills = { ...profile.rated_skills };
      if (rating <= 0) delete nextRatedSkills[skillName];
      else nextRatedSkills[skillName] = rating;

      return { ...profile, rated_skills: nextRatedSkills };
    }));
  };

  const saveSkillProfiles = async () => {
    setSaving('skills');
    try {
      await api.put('/app-settings', {
        'shiftplan.skills_enabled': skillsEnabled,
        'shiftplan.skill_catalog': JSON.stringify(skillCatalog),
      });

      await Promise.all(skillProfiles.map((profile) => updateSkills({
        employee_name: profile.employee_name,
        can_sh: profile.can_sh,
        can_tt: profile.can_tt,
        can_cc: profile.can_cc,
        rated_skills: profile.rated_skills,
      })));

      showToast('Skill-Matrix gespeichert');
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Fehler', 'err');
    } finally {
      setSaving('');
    }
  };

  if (loading) {
    const loader = (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
    );

    if (embedded) return loader;

    return <EnterprisePageShell style={{ maxWidth: 'none' }}>{loader}</EnterprisePageShell>;
  }

  const content = (
    <div className="space-y-4">
      {toast ? (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${toast.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
          {toast.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.msg}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.88))] p-5 text-slate-100 shadow-[0_20px_50px_rgba(2,6,23,0.35)]">
          <div className="text-xs uppercase tracking-[0.2em] text-sky-200/70">Schichtdesign</div>
          <div className="mt-3 text-3xl font-semibold">{definitions.filter((definition) => definition.is_active).length}</div>
          <div className="mt-2 text-sm text-slate-300">Aktive Definitionen, inklusive Wochenend-Varianten und DBS.</div>
        </div>
        <div className="rounded-3xl border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.16),transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.88))] p-5 text-slate-100 shadow-[0_20px_50px_rgba(2,6,23,0.35)]">
          <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-200/70">DBS-Pool</div>
          <div className="mt-3 text-3xl font-semibold">{dbsPool.length}</div>
          <div className="mt-2 text-sm text-slate-300">Fest hinterlegte Mitarbeiter mit individuellem Monatslimit.</div>
        </div>
        <div className="rounded-3xl border border-amber-400/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.88))] p-5 text-slate-100 shadow-[0_20px_50px_rgba(2,6,23,0.35)]">
          <div className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Ausschlüsse</div>
          <div className="mt-3 text-3xl font-semibold">{exclusions.length}</div>
          <div className="mt-2 text-sm text-slate-300">Mitarbeiter, die derzeit nicht in automatische Entwürfe einfließen.</div>
        </div>
      </div>

      <Section title="Schichtdefinitionen" icon={Clock}>
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/10 px-4 py-3 text-sm text-slate-200">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <div>
            Die Wochentage steuern jetzt direkt, an welchen Tagen eine Schicht von der Engine gebaut wird. Fur Nachtschichten kann zusatzlich exakt festgelegt werden, ob Beginn und Ende am Plan-Tag oder erst am Folgetag liegen.
          </div>
        </div>

        <div className="space-y-4">
          {definitions.map((definition) => {
            const applicableDays = normalizeApplicableDays(definition.applicable_days);

            return (
              <div key={definition.id} className="rounded-3xl border border-white/10 bg-slate-900/55 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.2)]">
                <div className="grid gap-3 xl:grid-cols-12">
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Code</label>
                    <input value={definition.code} disabled className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200" />
                  </div>
                  <div className="xl:col-span-3">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Name</label>
                    <input value={definition.name} onChange={(event) => updateDef(definition.id, 'name', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400/50" />
                  </div>
                  <div className="xl:col-span-2">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Typ</label>
                    <select value={definition.shift_type} onChange={(event) => updateDef(definition.id, 'shift_type', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/50">
                      <option value="early">Früh</option>
                      <option value="late">Spät</option>
                      <option value="night">Nacht</option>
                      <option value="special">Sonder</option>
                    </select>
                  </div>
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Von</label>
                    <input type="time" value={definition.start_time || ''} onChange={(event) => updateDef(definition.id, 'start_time', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  </div>
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Bis</label>
                    <input type="time" value={definition.end_time || ''} onChange={(event) => updateDef(definition.id, 'end_time', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  </div>
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Stunden</label>
                    <input type="number" min="0" step="0.5" value={definition.duration_hours} onChange={(event) => updateDef(definition.id, 'duration_hours', Number.parseFloat(event.target.value) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  </div>
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Min</label>
                    <input type="number" min="0" value={definition.min_staff} onChange={(event) => updateDef(definition.id, 'min_staff', Number.parseInt(event.target.value, 10) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  </div>
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Max</label>
                    <input type="number" min="0" value={definition.max_staff} onChange={(event) => updateDef(definition.id, 'max_staff', Number.parseInt(event.target.value, 10) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  </div>
                  <div className="xl:col-span-2">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Farbe und Status</label>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
                      <input type="color" value={definition.color_hex} onChange={(event) => updateDef(definition.id, 'color_hex', event.target.value)} className="h-8 w-10 cursor-pointer rounded border-none bg-transparent" />
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <input type="checkbox" checked={definition.is_active} onChange={(event) => updateDef(definition.id, 'is_active', event.target.checked)} className="rounded border-white/20 bg-slate-950" />
                        Aktiv
                      </label>
                    </div>
                  </div>
                </div>

                {definition.shift_type === 'night' ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Starttag</label>
                      <select value={normalizeShiftDayOffset(definition.start_day_offset)} onChange={(event) => updateDef(definition.id, 'start_day_offset', Number.parseInt(event.target.value, 10) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/50">
                        {shiftDayOffsetOptions.map((option) => (
                          <option key={`start-${option.value}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Endtag</label>
                      <select value={normalizeShiftDayOffset(definition.end_day_offset, 1)} onChange={(event) => updateDef(definition.id, 'end_day_offset', Number.parseInt(event.target.value, 10) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/50">
                        {shiftDayOffsetOptions.map((option) => (
                          <option key={`end-${option.value}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">Zeitfenster</div>
                      <div>{formatShiftSpanPreview(definition, shiftDayOffsetOptions, isGerman)}</div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div>
                    <div className="mb-2 flex items-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      Planung pro Wochentag
                      <HelpTooltip text="Nur an aktivierten Tagen wird die Schicht in die Tages-Slots aufgenommen. Damit lassen sich reine Samstag- oder Sa/So-Positionen direkt über die Definition steuern." />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {weekdayOptions.map((option) => {
                        const active = applicableDays.includes(option.value);
                        return (
                          <button
                            key={`${definition.id}-${option.value}`}
                            type="button"
                            onClick={() => toggleApplicableDay(definition.id, option.value)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-sky-400/20 text-sky-200 ring-1 ring-sky-300/30' : 'bg-white/5 text-slate-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-slate-200'}`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">{t("shiftAdmin.activeOn")}: {formatApplicableDays(applicableDays, weekdayOptions, isGerman)}</div>
                  </div>

                  <button onClick={() => void saveDefinition(definition)} disabled={saving === `def-${definition.id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
                    <Save className="h-4 w-4" />
                    {saving === `def-${definition.id}` ? 'Speichert...' : 'Schicht speichern'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="DBS-Pool und Monatslimits" icon={Users}>
        <div className="mb-4 rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/10 px-4 py-3 text-sm text-slate-200">
          DBS wird mit fester Mitarbeitergruppe geplant. Hinterlegte Mitarbeiter werden für DBS vor anderen Schichten berücksichtigt und jeweils nur bis zu ihrem Monatslimit verwendet.
        </div>

        <div className="mb-4 flex flex-col gap-3 xl:flex-row">
          <select value={newDbsEmployee} onChange={(event) => setNewDbsEmployee(event.target.value)} className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="">Mitarbeiter für DBS auswählen...</option>
            {employees.filter((employee) => !dbsPool.some((entry) => entry.employee_name === employee)).map((employee) => <option key={employee} value={employee}>{employee}</option>)}
          </select>
          <button onClick={addDbsEmployee} disabled={!newDbsEmployee} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/15 px-4 py-2 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-400/25 disabled:opacity-50">
            <Plus className="h-4 w-4" />
            Mitarbeiter hinzufügen
          </button>
        </div>

        <div className="space-y-3">
          {dbsPool.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-400">Noch kein DBS-Pool hinterlegt.</div>
          ) : dbsPool.map((entry) => (
            <div key={entry.employee_name} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/55 p-4 xl:grid-cols-[minmax(0,1fr)_220px_auto] xl:items-end">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">Mitarbeiter</label>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">{entry.employee_name}</div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">DBS-Tage pro Monat</label>
                <input type="number" min="0" value={entry.monthly_max_assignments} onChange={(event) => updateDbsPoolEntry(entry.employee_name, 'monthly_max_assignments', Number.parseInt(event.target.value, 10) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <button onClick={() => removeDbsEmployee(entry.employee_name)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20">
                <Trash2 className="h-4 w-4" />
                Entfernen
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={saveDbsPool} disabled={saving === 'dbs-pool'} className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-fuchsia-300 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving === 'dbs-pool' ? 'Speichert...' : 'DBS-Pool speichern'}
          </button>
        </div>
      </Section>

      <Section title="Skills und Kompetenzmatrix" icon={Star} defaultOpen={false}>
        <div className="mb-4 rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm text-slate-200">
          Hier kann eine detailierte Skill-Matrix pro Mitarbeiter gepflegt werden. Die neue Matrix ist optional aktivierbar und startet bewusst getrennt von den bestehenden SH-, TT- und CC-Coverage-Merkmalen.
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={skillsEnabled} onChange={(event) => setSkillsEnabled(event.target.checked)} className="mt-0.5 rounded border-white/20 bg-slate-950" />
            <span>
              Skill-Matrix aktivieren
              <HelpTooltip text="Wenn diese Option aktiv ist, wird die Skill-Matrix nicht nur angezeigt, sondern auch in der Schichtplanung als fachliches Bewertungskriterium verwendet. Im deaktivierten Zustand bleibt sie reine Stammdatenpflege ohne Einfluss auf die automatische Planung." />
            </span>
          </label>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
            Mitarbeiter: <span className="font-semibold text-slate-100">{skillProfiles.length}</span><br />
            Skills im Katalog: <span className="font-semibold text-slate-100">{skillCatalog.length}</span>
          </div>
        </div>

        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${skillsEnabled ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : 'border-slate-500/20 bg-slate-900/45 text-slate-300'}`}>
          {skillsEnabled
            ? 'Die Skill-Matrix ist aktiv. Bewertete und passende Skills fließen jetzt in die automatische Schichtplanung ein.'
            : 'Die Skill-Matrix ist derzeit nur gepflegt, aber nicht aktiv. Solange der Schalter aus ist, beeinflussen diese Skills die automatische Schichtplanung nicht.'}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/45 p-4">
          <div className="mb-3 flex items-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Skill-Katalog
            <HelpTooltip text="Lege hier die Skill-Namen fest, die im Team bewertet werden sollen. Sterne bedeuten 1 bis 5 Kompetenzstufen. Ein erneuter Klick auf denselben Stern entfernt die Bewertung wieder." />
          </div>
          <div className="mb-3 flex flex-col gap-3 xl:flex-row">
            <input value={newSkillName} onChange={(event) => setNewSkillName(event.target.value)} placeholder="Neuen Skill hinzufugen..." className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
            <button onClick={addSkillToCatalog} disabled={!newSkillName.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-400/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-400/25 disabled:opacity-50">
              <Plus className="h-4 w-4" />
              Skill hinzufugen
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {skillCatalog.map((skill) => (
              <span key={skill} className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">
                {skill}
                <button type="button" onClick={() => removeSkillFromCatalog(skill)} className="text-amber-200/80 transition hover:text-white" aria-label={`${skill} entfernen`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {skillProfiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-400">Keine Mitarbeiter fur die Skill-Matrix gefunden.</div>
          ) : skillProfiles.map((profile) => (
            <div key={profile.employee_name} className="rounded-2xl border border-white/10 bg-slate-900/55 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.2)]">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{profile.employee_name}</div>
                  <div className="text-xs text-slate-400">Bewerte die vorhandenen Skills mit 1 bis 5 Sternen. 0 bedeutet noch nicht bewertet.</div>
                </div>
                <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
                  Bewertete Skills: {Object.keys(profile.rated_skills || {}).length}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {skillCatalog.map((skill) => {
                  const rating = profile.rated_skills?.[skill] ?? 0;

                  return (
                    <div key={`${profile.employee_name}-${skill}`} className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-slate-100">{skill}</div>
                        <div className="text-xs text-slate-400">{rating}/5</div>
                      </div>
                      <div className="mt-3 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = rating >= star;
                          const nextRating = rating === star ? 0 : star;

                          return (
                            <button
                              key={`${profile.employee_name}-${skill}-${star}`}
                              type="button"
                              onClick={() => setSkillRating(profile.employee_name, skill, nextRating)}
                              className={`rounded-full p-1 transition ${active ? 'text-amber-300 hover:text-amber-200' : 'text-slate-600 hover:text-amber-200'}`}
                              aria-label={`${skill} mit ${star} Sternen bewerten`}
                            >
                              <Star className={`h-4 w-4 ${active ? 'fill-current' : ''}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={saveSkillProfiles} disabled={saving === 'skills'} className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-300 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving === 'skills' ? 'Speichert...' : 'Skill-Matrix speichern'}
          </button>
        </div>
      </Section>

      <Section title="Rotationsregeln" icon={RotateCcw}>
        {rotation ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="text-xs text-slate-400">Max. gleiche Schichten hintereinander <HelpTooltip text="Wie viele Tage in Folge ein Mitarbeiter dieselbe Schichtart arbeiten darf." /></label>
                <input type="number" min="1" max="30" value={rotation.max_consecutive_same} onChange={(event) => setRotation({ ...rotation, max_consecutive_same: Number.parseInt(event.target.value, 10) || 1 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Max. Arbeitstage in Folge</label>
                <input type="number" min="1" max="30" value={rotation.max_consecutive_workdays} onChange={(event) => setRotation({ ...rotation, max_consecutive_workdays: Number.parseInt(event.target.value, 10) || 1 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Min. freie Tage nach Serie</label>
                <input type="number" min="0" max="7" value={rotation.min_free_after_streak} onChange={(event) => setRotation({ ...rotation, min_free_after_streak: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Min. Ruhestunden</label>
                <input type="number" min="8" max="24" value={rotation.min_hours_between_shifts} onChange={(event) => setRotation({ ...rotation, min_hours_between_shifts: Number.parseInt(event.target.value, 10) || 11 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Max. Nächte pro Monat</label>
                <input type="number" min="0" max="31" value={rotation.max_nights_per_month} onChange={(event) => setRotation({ ...rotation, max_nights_per_month: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Max. Wochenenden pro Monat</label>
                <input type="number" min="0" max="10" value={rotation.max_weekends_per_month} onChange={(event) => setRotation({ ...rotation, max_weekends_per_month: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Freie Tage nach Nacht</label>
                <input type="number" min="0" max="7" value={rotation.free_days_after_night} onChange={(event) => setRotation({ ...rotation, free_days_after_night: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Freie Tage nach Wochenende</label>
                <input type="number" min="0" max="7" value={rotation.free_days_after_weekend} onChange={(event) => setRotation({ ...rotation, free_days_after_weekend: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
                <input type="checkbox" checked={rotation.night_to_early_forbidden} onChange={(event) => setRotation({ ...rotation, night_to_early_forbidden: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
                Nacht → Früh verboten
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
                <input type="checkbox" checked={rotation.late_to_early_forbidden} onChange={(event) => setRotation({ ...rotation, late_to_early_forbidden: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
                Spät → Früh verboten
              </label>
            </div>

            <div className="flex justify-end">
              <button onClick={saveRotation} disabled={saving === 'rotation'} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving === 'rotation' ? 'Speichert...' : 'Rotationsregeln speichern'}
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Fairnessregeln" icon={Scale}>
        {fairness ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
                <input type="checkbox" checked={fairness.balance_nights} onChange={(event) => setFairness({ ...fairness, balance_nights: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
                Nachtschichten ausgleichen
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
                <input type="checkbox" checked={fairness.balance_weekends} onChange={(event) => setFairness({ ...fairness, balance_weekends: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
                Wochenenden ausgleichen
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
                <input type="checkbox" checked={fairness.balance_total_load} onChange={(event) => setFairness({ ...fairness, balance_total_load: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
                Gesamtbelastung ausgleichen
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400">Max. Abweichung (%)</label>
                <input type="number" min="5" max="100" value={fairness.max_deviation_percent} onChange={(event) => setFairness({ ...fairness, max_deviation_percent: Number.parseInt(event.target.value, 10) || 5 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Priorität</label>
                <select value={fairness.fairness_vs_preference} onChange={(event) => setFairness({ ...fairness, fairness_vs_preference: event.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                  <option value="fairness">Fairness priorisieren</option>
                  <option value="preference">Präferenzen priorisieren</option>
                  <option value="balanced">Ausgewogen</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={saveFairness} disabled={saving === 'fairness'} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving === 'fairness' ? 'Speichert...' : 'Fairnessregeln speichern'}
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Planungsgewichtung" icon={Sliders}>
        {planConfig ? (
          <div className="space-y-4">
            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
              <input type="checkbox" checked={planConfig.respect_employee_wishes} onChange={(event) => setPlanConfig({ ...planConfig, respect_employee_wishes: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
              Mitarbeiterwünsche berücksichtigen
            </label>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="text-xs text-slate-400">Monatliche Sollzeit</label>
                <input type="number" min="0" step="0.5" value={planConfig.monthly_target_hours} onChange={(event) => setPlanConfig({ ...planConfig, monthly_target_hours: Number.parseFloat(event.target.value) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Harte Regeln (%)</label>
                <input type="range" min="0" max="100" value={planConfig.hard_rules_priority} onChange={(event) => setPlanConfig({ ...planConfig, hard_rules_priority: Number.parseInt(event.target.value, 10) || 0 })} className="mt-3 w-full" />
                <div className="mt-1 text-xs text-slate-400">{planConfig.hard_rules_priority}%</div>
              </div>
              <div>
                <label className="text-xs text-slate-400">Wünsche (%)</label>
                <input type="range" min="0" max="100" value={planConfig.soft_wishes_priority} onChange={(event) => setPlanConfig({ ...planConfig, soft_wishes_priority: Number.parseInt(event.target.value, 10) || 0 })} className="mt-3 w-full" />
                <div className="mt-1 text-xs text-slate-400">{planConfig.soft_wishes_priority}%</div>
              </div>
              <div>
                <label className="text-xs text-slate-400">Fairness (%)</label>
                <input type="range" min="0" max="100" value={planConfig.fairness_priority} onChange={(event) => setPlanConfig({ ...planConfig, fairness_priority: Number.parseInt(event.target.value, 10) || 0 })} className="mt-3 w-full" />
                <div className="mt-1 text-xs text-slate-400">{planConfig.fairness_priority}%</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
              Admin-Vorgaben Gewichtung: <span className="font-semibold text-slate-100">{planConfig.admin_override_priority}%</span>
            </div>

            <div className="flex justify-end">
              <button onClick={savePlanConfig} disabled={saving === 'planconfig'} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving === 'planconfig' ? 'Speichert...' : 'Planungskonfiguration speichern'}
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Problemerkennung und Leitstand" icon={AlertTriangle}>
        <div className="mb-4 rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm text-slate-200">
          Diese Einstellungen steuern die neue Problem- und Lösungsansicht im Schichtplan. Bestehende Mindestbesetzungsregeln bleiben die fachliche Grundlage, die Oberfläche priorisiert nur ihre Darstellung.
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.issuePanelEnabled} onChange={(event) => setAdvancedSettings({ ...advancedSettings, issuePanelEnabled: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            Problem-Panel im Schichtplan aktivieren
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.issueAutoRefresh} onChange={(event) => setAdvancedSettings({ ...advancedSettings, issueAutoRefresh: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            Hinweise nach Berechnung automatisch aktualisieren
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.issueShowSolutions} onChange={(event) => setAdvancedSettings({ ...advancedSettings, issueShowSolutions: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            Lösungsvorschläge im Panel anzeigen
          </label>
        </div>

        <div className="mt-4 max-w-sm">
          <label className="text-xs text-slate-400">Priorisierungsmodus</label>
          <select value={advancedSettings.issuePriorityMode} onChange={(event) => setAdvancedSettings({ ...advancedSettings, issuePriorityMode: event.target.value as AdvancedPlanningSettings['issuePriorityMode'] })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="staffing_first">Besetzung zuerst</option>
            <option value="balanced">Ausgewogen</option>
            <option value="fairness_first">Fairness zuerst</option>
          </select>
        </div>
      </Section>

      <Section title="Autonome Krankheits- und Ersatzplanung" icon={Settings2}>
        <div className="mb-4 rounded-2xl border border-sky-400/15 bg-sky-500/10 px-4 py-3 text-sm text-slate-200">
          Diese Regeln schaffen die Grundlage für spätere automatische Schichtwechsel bei Krankheit. Aktiviert wird die eigentliche Automatik erst, wenn der geplante Autopilot-Lauf implementiert ist.
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.illnessAutoSwapEnabled} onChange={(event) => setAdvancedSettings({ ...advancedSettings, illnessAutoSwapEnabled: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            Automatische Ersatzsuche bei Krankheit vorbereiten
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.illnessRequireSkillMatch} onChange={(event) => setAdvancedSettings({ ...advancedSettings, illnessRequireSkillMatch: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            Skill-Match als Pflichtkriterium erzwingen
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200 lg:col-span-2">
            <input type="checkbox" checked={advancedSettings.illnessProtectWorklifeBalance} onChange={(event) => setAdvancedSettings({ ...advancedSettings, illnessProtectWorklifeBalance: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            Work-Life-Balance und Folgebelastung bei automatischen Vorschlägen schützen
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="text-xs text-slate-400">Min. Puffer in der Quellschicht</label>
            <input type="number" min="0" value={advancedSettings.illnessMinSourceBuffer} onChange={(event) => setAdvancedSettings({ ...advancedSettings, illnessMinSourceBuffer: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Min. Ruhezeit in Stunden</label>
            <input type="number" min="8" value={advancedSettings.illnessMinRestHours} onChange={(event) => setAdvancedSettings({ ...advancedSettings, illnessMinRestHours: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
          </div>
        </div>
      </Section>

      <Section title="Wochenendplanung nach Ticketvolumen" icon={CalendarDays}>
        <div className="mb-4 rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/10 px-4 py-3 text-sm text-slate-200">
          Hier wird vorbereitet, dass Wochenendbesetzung später automatisch aus Ticketlast und Sicherheitsaufschlag abgeleitet werden kann.
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.weekendVolumeEnabled} onChange={(event) => setAdvancedSettings({ ...advancedSettings, weekendVolumeEnabled: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            Wochenendplanung auf Ticketvolumen vorbereiten
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="text-xs text-slate-400">Sicherheitsaufschlag (%)</label>
            <input type="number" min="0" max="100" value={advancedSettings.weekendBufferPercent} onChange={(event) => setAdvancedSettings({ ...advancedSettings, weekendBufferPercent: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Min. Dispatcher am Wochenende</label>
            <input type="number" min="0" value={advancedSettings.weekendMinDispatchers} onChange={(event) => setAdvancedSettings({ ...advancedSettings, weekendMinDispatchers: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <button onClick={saveAdvancedSettings} disabled={saving === 'advanced'} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving === 'advanced' ? 'Speichert...' : 'Leitstand & Autopilot speichern'}
        </button>
      </div>

      <Section title="Mitarbeiter-Ausschlüsse" icon={UserX}>
        <div className="mb-4 flex flex-col gap-3 xl:flex-row">
          <select value={newExclusionName} onChange={(event) => setNewExclusionName(event.target.value)} className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="">Mitarbeiter auswählen...</option>
            {employees.filter((employee) => !exclusions.some((exclusion) => exclusion.employee_name === employee)).map((employee) => <option key={employee} value={employee}>{employee}</option>)}
          </select>
          <button onClick={() => void addExclusion()} disabled={!newExclusionName.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50">
            <UserX className="h-4 w-4" />
            Ausschließen
          </button>
        </div>

        {exclusions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-400">Keine Mitarbeiter ausgeschlossen.</div>
        ) : (
          <div className="space-y-3">
            {exclusions.map((exclusion) => (
              <div key={exclusion.id} className="flex flex-col gap-3 rounded-2xl border border-red-400/20 bg-red-500/5 p-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-100">{exclusion.employee_name}</div>
                  <div className="text-xs text-slate-400">Angelegt von {exclusion.created_by} am {new Date(exclusion.created_at).toLocaleDateString('de-DE')}</div>
                </div>
                <button onClick={() => void removeExclusion(exclusion.id)} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20">
                  <Plus className="h-4 w-4" />
                  Zurück in Planung
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );

  if (embedded) return content;

  return (
    <EnterprisePageShell style={{ maxWidth: 'none' }}>
      <EnterpriseHeader
        icon={<Settings2 className="h-6 w-6 text-blue-400" />}
        title={t("shiftAdmin.title")}
        subtitle={t("shiftAdmin.subtitle")}
      />
      {content}
    </EnterprisePageShell>
  );
}

export default function ShiftAdminSettings() {
  return <ShiftPlanningSettingsPanel />;
}
