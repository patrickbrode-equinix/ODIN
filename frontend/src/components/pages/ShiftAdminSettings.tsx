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
  Timer,
  Trash2,
  UserX,
  Users,
} from 'lucide-react';
import { EmployeeSkills, fetchSkills, updateSkills } from '../../api/coverage';
import type { TranslationKey } from '../../context/LanguageContext';
import { useLanguage } from '../../context/LanguageContext';

/* ── locale helpers ── */

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

/* ── interfaces ── */

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

interface DbsConfig {
  enabled: boolean;
  rhythmWeeks: number;
  referenceDate: string;
  weekdays: number[];
  shiftCode: string;
  requiredStaff: number;
  defaultMonthlyTarget: number;
}

interface OvertimeConfig {
  maxOvertimeHours: number;
  overtimeMode: 'show' | 'warn' | 'hard';
  maxDailyHours: number;
  maxWeeklyHours: number;
  dailyMode: 'off' | 'warn' | 'block';
  weeklyMode: 'off' | 'warn' | 'block';
}

interface SkillMatrixProfile extends EmployeeSkills {
  rated_skills: Record<string, number>;
}

/* ── defaults & constants ── */

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

const DEFAULT_DBS_CONFIG: DbsConfig = {
  enabled: true,
  rhythmWeeks: 2,
  referenceDate: '',
  weekdays: [1, 2, 3, 4, 5],
  shiftCode: 'DBS',
  requiredStaff: 1,
  defaultMonthlyTarget: 4,
};

const DEFAULT_OVERTIME_CONFIG: OvertimeConfig = {
  maxOvertimeHours: 0,
  overtimeMode: 'show',
  maxDailyHours: 10,
  maxWeeklyHours: 48,
  dailyMode: 'warn',
  weeklyMode: 'warn',
};

/* ── parsers / normalizers ── */

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

function extractDbsConfig(settings: Record<string, string>): DbsConfig {
  let weekdays = DEFAULT_DBS_CONFIG.weekdays;
  const raw = settings['shiftplan.dbs_weekdays'];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) weekdays = parsed.filter((d: number) => d >= 0 && d <= 6);
    } catch { /* keep default */ }
  }
  return {
    enabled: parseBooleanSetting(settings['shiftplan.dbs_enabled'], DEFAULT_DBS_CONFIG.enabled),
    rhythmWeeks: parseNumberSetting(settings['shiftplan.dbs_rhythm_weeks'], DEFAULT_DBS_CONFIG.rhythmWeeks),
    referenceDate: settings['shiftplan.dbs_reference_date'] ?? DEFAULT_DBS_CONFIG.referenceDate,
    weekdays,
    shiftCode: settings['shiftplan.dbs_shift_code'] || DEFAULT_DBS_CONFIG.shiftCode,
    requiredStaff: parseNumberSetting(settings['shiftplan.dbs_required_staff'], DEFAULT_DBS_CONFIG.requiredStaff),
    defaultMonthlyTarget: parseNumberSetting(settings['shiftplan.dbs_default_monthly_target'], DEFAULT_DBS_CONFIG.defaultMonthlyTarget),
  };
}

function extractOvertimeConfig(settings: Record<string, string>): OvertimeConfig {
  return {
    maxOvertimeHours: parseNumberSetting(settings['shiftplan.max_overtime_hours'], DEFAULT_OVERTIME_CONFIG.maxOvertimeHours),
    overtimeMode: (settings['shiftplan.overtime_mode'] as OvertimeConfig['overtimeMode']) || DEFAULT_OVERTIME_CONFIG.overtimeMode,
    maxDailyHours: parseNumberSetting(settings['shiftplan.max_daily_hours'], DEFAULT_OVERTIME_CONFIG.maxDailyHours),
    maxWeeklyHours: parseNumberSetting(settings['shiftplan.max_weekly_hours'], DEFAULT_OVERTIME_CONFIG.maxWeeklyHours),
    dailyMode: (settings['shiftplan.daily_mode'] as OvertimeConfig['dailyMode']) || DEFAULT_OVERTIME_CONFIG.dailyMode,
    weeklyMode: (settings['shiftplan.weekly_mode'] as OvertimeConfig['weeklyMode']) || DEFAULT_OVERTIME_CONFIG.weeklyMode,
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

/* ── reusable sub-components ── */

function HelpTooltip({ textKey, t }: { textKey: TranslationKey; t: (key: TranslationKey) => string }) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex ml-1">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow((value) => !value)}
        className="text-muted-foreground hover:text-blue-400 transition"
        aria-label="Help"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show ? (
        <div className="theme-popover-surface absolute left-6 top-0 z-50 w-72 rounded-lg border border-blue-500/30 p-3 text-xs leading-relaxed text-muted-foreground shadow-xl">
          {t(textKey)}
        </div>
      ) : null}
    </span>
  );
}

function SectionHelp({ textKey, t }: { textKey: TranslationKey; t: (key: TranslationKey) => string }) {
  const [show, setShow] = useState(false);

  return (
    <button
      type="button"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow((v) => !v); }}
      className="relative text-muted-foreground hover:text-blue-400 transition"
      aria-label="Help"
    >
      <HelpCircle className="w-4 h-4" />
      {show ? (
        <div className="theme-popover-surface absolute left-6 top-0 z-50 w-80 rounded-lg border border-blue-500/30 p-3 text-xs leading-relaxed text-left font-normal normal-case tracking-normal text-muted-foreground shadow-xl">
          {t(textKey)}
        </div>
      ) : null}
    </button>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  helpKey,
  t,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  helpKey?: TranslationKey;
  t?: (key: TranslationKey) => string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="theme-glass-panel overflow-hidden rounded-3xl border shadow-[0_12px_40px_rgba(15,23,42,0.22)] backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-accent/60"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-foreground">{title}</div>
            {helpKey && t ? <SectionHelp textKey={helpKey} t={t} /> : null}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open ? <div className="border-t border-border/60 px-5 pb-5 pt-4">{children}</div> : null}
    </section>
  );
}

/* ── main panel ── */

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
  const [dbsConfig, setDbsConfig] = useState<DbsConfig>(DEFAULT_DBS_CONFIG);
  const [overtimeConfig, setOvertimeConfig] = useState<OvertimeConfig>(DEFAULT_OVERTIME_CONFIG);
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

  /* ── data loading ── */

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
      setDbsConfig(extractDbsConfig(appSettingsRes.data || {}));
      setOvertimeConfig(extractOvertimeConfig(appSettingsRes.data || {}));
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

  /* ── save handlers ── */

  const saveDefinition = async (definition: ShiftDefinition) => {
    setSaving(`def-${definition.id}`);
    try {
      await api.put(`/shift-config/definitions/${definition.id}`, {
        ...definition,
        applicable_days: normalizeApplicableDays(definition.applicable_days),
      });
      showToast(t("shiftAdmin.toastDefSaved"));
    } catch (error: any) {
      showToast(error?.response?.data?.error || t("shiftAdmin.error"), 'err');
    } finally {
      setSaving('');
    }
  };

  const saveRotation = async () => {
    if (!rotation) return;
    setSaving('rotation');
    try {
      await api.put('/shift-config/rotation-rules', rotation);
      await api.put('/app-settings', {
        'shiftplan.max_overtime_hours': overtimeConfig.maxOvertimeHours,
        'shiftplan.overtime_mode': overtimeConfig.overtimeMode,
        'shiftplan.max_daily_hours': overtimeConfig.maxDailyHours,
        'shiftplan.max_weekly_hours': overtimeConfig.maxWeeklyHours,
        'shiftplan.daily_mode': overtimeConfig.dailyMode,
        'shiftplan.weekly_mode': overtimeConfig.weeklyMode,
      });
      showToast(t("shiftAdmin.toastRotationSaved"));
    } catch (error: any) {
      showToast(error?.response?.data?.error || t("shiftAdmin.error"), 'err');
    } finally {
      setSaving('');
    }
  };

  const saveFairness = async () => {
    if (!fairness) return;
    setSaving('fairness');
    try {
      await api.put('/shift-config/fairness-rules', fairness);
      showToast(t("shiftAdmin.toastFairnessSaved"));
    } catch (error: any) {
      showToast(error?.response?.data?.error || t("shiftAdmin.error"), 'err');
    } finally {
      setSaving('');
    }
  };

  const savePlanConfig = async () => {
    if (!planConfig) return;
    setSaving('planconfig');
    try {
      await api.put('/shift-config/planning-config', planConfig);
      showToast(t("shiftAdmin.toastPlanSaved"));
    } catch (error: any) {
      showToast(error?.response?.data?.error || t("shiftAdmin.error"), 'err');
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
      showToast(t("shiftAdmin.toastAdvancedSaved"));
    } catch (error: any) {
      showToast(error?.response?.data?.error || t("shiftAdmin.error"), 'err');
    } finally {
      setSaving('');
    }
  };

  const saveDbsConfig = async () => {
    setSaving('dbs-config');
    try {
      await api.put('/app-settings', {
        'shiftplan.dbs_enabled': dbsConfig.enabled,
        'shiftplan.dbs_rhythm_weeks': dbsConfig.rhythmWeeks,
        'shiftplan.dbs_reference_date': dbsConfig.referenceDate,
        'shiftplan.dbs_weekdays': JSON.stringify(dbsConfig.weekdays),
        'shiftplan.dbs_shift_code': dbsConfig.shiftCode,
        'shiftplan.dbs_required_staff': dbsConfig.requiredStaff,
        'shiftplan.dbs_default_monthly_target': dbsConfig.defaultMonthlyTarget,
      });
      showToast(t("shiftAdmin.toastDbsConfigSaved"));
    } catch (error: any) {
      showToast(error?.response?.data?.error || t("shiftAdmin.error"), 'err');
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
      showToast(t("shiftAdmin.toastDbsPoolSaved"));
    } catch (error: any) {
      showToast(error?.response?.data?.error || t("shiftAdmin.error"), 'err');
    } finally {
      setSaving('');
    }
  };

  const addExclusion = async () => {
    if (!newExclusionName.trim()) return;
    try {
      await api.post('/shift-config/exclusions', { employee_name: newExclusionName.trim(), reason: 'admin_override' });
      setNewExclusionName('');
      showToast(t("shiftAdmin.toastExclAdded"));
      await loadAll();
    } catch (error: any) {
      showToast(error?.response?.data?.error || t("shiftAdmin.error"), 'err');
    }
  };

  const removeExclusion = async (id: number) => {
    try {
      await api.delete(`/shift-config/exclusions/${id}`);
      showToast(t("shiftAdmin.toastExclRemoved"));
      await loadAll();
    } catch (error: any) {
      showToast(error?.response?.data?.error || t("shiftAdmin.error"), 'err');
    }
  };

  /* ── field updaters ── */

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

  const toggleDbsWeekday = (day: number) => {
    setDbsConfig((current) => {
      const nextDays = current.weekdays.includes(day)
        ? current.weekdays.filter((d) => d !== day)
        : [...current.weekdays, day];
      return { ...current, weekdays: nextDays.length ? nextDays : current.weekdays };
    });
  };

  const addDbsEmployee = () => {
    const employeeName = newDbsEmployee.trim();
    if (!employeeName || dbsPool.some((entry) => entry.employee_name === employeeName)) return;
    setDbsPool((current) => [...current, {
      shift_code: 'DBS',
      employee_name: employeeName,
      monthly_max_assignments: dbsConfig.defaultMonthlyTarget,
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
      showToast(t("shiftAdmin.toastSkillExists"), 'err');
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

      showToast(t("shiftAdmin.toastSkillSaved"));
    } catch (error: any) {
      showToast(error?.response?.data?.error || t("shiftAdmin.error"), 'err');
    } finally {
      setSaving('');
    }
  };

  /* ── loading state ── */

  if (loading) {
    const loader = (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
    );

    if (embedded) return loader;

    return <EnterprisePageShell style={{ maxWidth: 'none' }}>{loader}</EnterprisePageShell>;
  }

  /* ── shift type options (translated) ── */
  const shiftTypeOptions = [
    { value: 'early', label: t("shiftAdmin.typeEarly") },
    { value: 'late', label: t("shiftAdmin.typeLate") },
    { value: 'night', label: t("shiftAdmin.typeNight") },
    { value: 'special', label: t("shiftAdmin.typeSpecial") },
  ];

  /* ── shift code options for DBS ── */
  const shiftCodeOptions = definitions.filter((d) => d.is_active).map((d) => ({ value: d.code, label: `${d.code} – ${d.name}` }));

  /* ── render ── */

  const content = (
    <div className="space-y-4">
      {toast ? (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${toast.type === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
          {toast.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.msg}
        </div>
      ) : null}

      {/* ── Overview cards ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="theme-admin-hero rounded-3xl border border-sky-400/25 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.18)]">
          <div className="text-xs uppercase tracking-[0.2em] text-sky-700/80 dark:text-sky-200/70">{t("shiftAdmin.cardDefinitions")}</div>
          <div className="mt-3 text-3xl font-semibold text-foreground">{definitions.filter((definition) => definition.is_active).length}</div>
          <div className="mt-2 text-sm text-muted-foreground">{t("shiftAdmin.cardDefinitionsDesc")}</div>
        </div>
        <div className="theme-admin-hero rounded-3xl border border-fuchsia-400/25 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.18)]">
          <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-700/80 dark:text-fuchsia-200/70">{t("shiftAdmin.cardDbsPool")}</div>
          <div className="mt-3 text-3xl font-semibold text-foreground">{dbsPool.length}</div>
          <div className="mt-2 text-sm text-muted-foreground">{t("shiftAdmin.cardDbsPoolDesc")}</div>
        </div>
        <div className="theme-admin-hero rounded-3xl border border-amber-400/25 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.18)]">
          <div className="text-xs uppercase tracking-[0.2em] text-amber-700/80 dark:text-amber-200/70">{t("shiftAdmin.cardExclusions")}</div>
          <div className="mt-3 text-3xl font-semibold text-foreground">{exclusions.length}</div>
          <div className="mt-2 text-sm text-muted-foreground">{t("shiftAdmin.cardExclusionsDesc")}</div>
        </div>
      </div>

      {/* ── Shift definitions ── */}
      <Section title={t("shiftAdmin.sectionDefinitions")} icon={Clock} helpKey="shiftAdmin.helpSectionDefinitions" t={t}>
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-sky-400/15 bg-sky-500/10 px-4 py-3 text-sm text-slate-200">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <div>{t("shiftAdmin.sectionDefinitionsInfo")}</div>
        </div>

        <div className="space-y-4">
          {definitions.map((definition) => {
            const applicableDays = normalizeApplicableDays(definition.applicable_days);

            return (
              <div key={definition.id} className="rounded-3xl border border-white/10 bg-slate-900/55 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.2)]">
                <div className="grid gap-3 xl:grid-cols-12">
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defCode")}</label>
                    <input value={definition.code} disabled className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200" />
                  </div>
                  <div className="xl:col-span-3">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defName")}</label>
                    <input value={definition.name} onChange={(event) => updateDef(definition.id, 'name', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400/50" />
                  </div>
                  <div className="xl:col-span-2">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defType")}</label>
                    <select value={definition.shift_type} onChange={(event) => updateDef(definition.id, 'shift_type', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/50">
                      {shiftTypeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defFrom")}</label>
                    <input type="time" value={definition.start_time || ''} onChange={(event) => updateDef(definition.id, 'start_time', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  </div>
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defTo")}</label>
                    <input type="time" value={definition.end_time || ''} onChange={(event) => updateDef(definition.id, 'end_time', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  </div>
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defHours")}</label>
                    <input type="number" min="0" step="0.5" value={definition.duration_hours} onChange={(event) => updateDef(definition.id, 'duration_hours', Number.parseFloat(event.target.value) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  </div>
                  <div className="xl:col-span-1">
                    <label className="mb-1 flex items-center text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defMin")} <HelpTooltip textKey="shiftAdmin.helpDefMinMax" t={t} /></label>
                    <input type="number" min="0" value={definition.min_staff} onChange={(event) => updateDef(definition.id, 'min_staff', Number.parseInt(event.target.value, 10) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  </div>
                  <div className="xl:col-span-1">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defMax")}</label>
                    <input type="number" min="0" value={definition.max_staff} onChange={(event) => updateDef(definition.id, 'max_staff', Number.parseInt(event.target.value, 10) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  </div>
                  <div className="xl:col-span-2">
                    <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defColorStatus")}</label>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
                      <input type="color" value={definition.color_hex} onChange={(event) => updateDef(definition.id, 'color_hex', event.target.value)} className="h-8 w-10 cursor-pointer rounded border-none bg-transparent" />
                      <label className="flex items-center gap-2 text-xs text-slate-300">
                        <input type="checkbox" checked={definition.is_active} onChange={(event) => updateDef(definition.id, 'is_active', event.target.checked)} className="rounded border-white/20 bg-slate-950" />
                        {t("shiftAdmin.defActive")}
                      </label>
                    </div>
                  </div>
                </div>

                {definition.shift_type === 'night' ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 flex items-center text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defStartDay")} <HelpTooltip textKey="shiftAdmin.helpDefDayOffset" t={t} /></label>
                      <select value={normalizeShiftDayOffset(definition.start_day_offset)} onChange={(event) => updateDef(definition.id, 'start_day_offset', Number.parseInt(event.target.value, 10) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/50">
                        {shiftDayOffsetOptions.map((option) => (
                          <option key={`start-${option.value}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defEndDay")}</label>
                      <select value={normalizeShiftDayOffset(definition.end_day_offset, 1)} onChange={(event) => updateDef(definition.id, 'end_day_offset', Number.parseInt(event.target.value, 10) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400/50">
                        {shiftDayOffsetOptions.map((option) => (
                          <option key={`end-${option.value}`} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">{t("shiftAdmin.defTimeWindow")}</div>
                      <div>{formatShiftSpanPreview(definition, shiftDayOffsetOptions, isGerman)}</div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div>
                    <div className="mb-2 flex items-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      {t("shiftAdmin.defWeekdayPlanning")}
                      <HelpTooltip textKey="shiftAdmin.helpDefWeekdays" t={t} />
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
                    {saving === `def-${definition.id}` ? t("shiftAdmin.defSaving") : t("shiftAdmin.defSave")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── DBS Configuration ── */}
      <Section title={t("shiftAdmin.sectionDbs")} icon={Users} helpKey="shiftAdmin.helpSectionDbs" t={t}>
        <div className="mb-4 rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/10 px-4 py-3 text-sm text-slate-200">
          {t("shiftAdmin.sectionDbsInfo")}
        </div>

        {/* DBS disabled hint */}
        {!dbsConfig.enabled ? (
          <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {t("shiftAdmin.dbsDisabledHint")}
          </div>
        ) : null}

        {/* DBS global config */}
        <div className="mb-6 space-y-4 rounded-2xl border border-white/10 bg-slate-900/45 p-4">
          {/* Row 1: Enabled toggle */}
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={dbsConfig.enabled} onChange={(event) => setDbsConfig({ ...dbsConfig, enabled: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            <span className="flex items-center">
              {t("shiftAdmin.dbsEnabled")}
              <HelpTooltip textKey="shiftAdmin.helpDbsEnabled" t={t} />
            </span>
          </label>

          {/* Row 2: Rhythm, Reference date, Required staff */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="flex items-center text-xs text-slate-400">
                {t("shiftAdmin.dbsRhythm")}
                <HelpTooltip textKey="shiftAdmin.helpDbsRhythm" t={t} />
              </label>
              <input type="number" min="1" max="8" value={dbsConfig.rhythmWeeks} onChange={(event) => setDbsConfig({ ...dbsConfig, rhythmWeeks: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
            </div>
            <div>
              <label className="flex items-center text-xs text-slate-400">
                {t("shiftAdmin.dbsReferenceDate")}
                <HelpTooltip textKey="shiftAdmin.helpDbsReferenceDate" t={t} />
              </label>
              <input type="date" value={dbsConfig.referenceDate} onChange={(event) => setDbsConfig({ ...dbsConfig, referenceDate: event.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
            </div>
            <div>
              <label className="flex items-center text-xs text-slate-400">
                {t("shiftAdmin.dbsRequiredStaff")}
                <HelpTooltip textKey="shiftAdmin.helpDbsRequiredStaff" t={t} />
              </label>
              <input type="number" min="0" max="10" value={dbsConfig.requiredStaff} onChange={(event) => setDbsConfig({ ...dbsConfig, requiredStaff: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
            </div>
          </div>

          {/* Row 3: Shift code, Default monthly target */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="flex items-center text-xs text-slate-400">
                {t("shiftAdmin.dbsShiftCode")}
                <HelpTooltip textKey="shiftAdmin.helpDbsShiftCode" t={t} />
              </label>
              <select value={dbsConfig.shiftCode} onChange={(event) => setDbsConfig({ ...dbsConfig, shiftCode: event.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                {shiftCodeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="flex items-center text-xs text-slate-400">
                {t("shiftAdmin.dbsDefaultTarget")}
                <HelpTooltip textKey="shiftAdmin.helpDbsDefaultTarget" t={t} />
              </label>
              <input type="number" min="0" max="31" value={dbsConfig.defaultMonthlyTarget} onChange={(event) => setDbsConfig({ ...dbsConfig, defaultMonthlyTarget: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
            </div>
          </div>

          {/* Row 4: DBS weekdays */}
          <div>
            <div className="mb-2 flex items-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              {t("shiftAdmin.dbsWeekdays")}
              <HelpTooltip textKey="shiftAdmin.helpDbsWeekdays" t={t} />
            </div>
            <div className="flex flex-wrap gap-2">
              {weekdayOptions.map((option) => {
                const active = dbsConfig.weekdays.includes(option.value);
                return (
                  <button
                    key={`dbs-wd-${option.value}`}
                    type="button"
                    onClick={() => toggleDbsWeekday(option.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-fuchsia-400/20 text-fuchsia-200 ring-1 ring-fuchsia-300/30' : 'bg-white/5 text-slate-400 ring-1 ring-white/10 hover:bg-white/10 hover:text-slate-200'}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save DBS config */}
          <div className="flex justify-end">
            <button onClick={saveDbsConfig} disabled={saving === 'dbs-config'} className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-fuchsia-300 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving === 'dbs-config' ? t("shiftAdmin.dbsSavingConfig") : t("shiftAdmin.dbsSaveConfig")}
            </button>
          </div>
        </div>

        {/* DBS employee pool */}
        <div className="mb-3 flex items-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
          {t("shiftAdmin.dbsPool")}
        </div>

        <div className="mb-4 flex flex-col gap-3 xl:flex-row">
          <select value={newDbsEmployee} onChange={(event) => setNewDbsEmployee(event.target.value)} className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="">{t("shiftAdmin.dbsSelectEmployee")}</option>
            {employees.filter((employee) => !dbsPool.some((entry) => entry.employee_name === employee)).map((employee) => <option key={employee} value={employee}>{employee}</option>)}
          </select>
          <button onClick={addDbsEmployee} disabled={!newDbsEmployee} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/15 px-4 py-2 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-400/25 disabled:opacity-50">
            <Plus className="h-4 w-4" />
            {t("shiftAdmin.dbsAddEmployee")}
          </button>
        </div>

        <div className="space-y-3">
          {dbsPool.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-400">{t("shiftAdmin.dbsEmptyPool")}</div>
          ) : dbsPool.map((entry) => (
            <div key={entry.employee_name} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-900/55 p-4 xl:grid-cols-[minmax(0,1fr)_220px_auto] xl:items-end">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400">{isGerman ? 'Mitarbeiter' : 'Employee'}</label>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">{entry.employee_name}</div>
              </div>
              <div>
                <label className="mb-1 flex items-center text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  {t("shiftAdmin.dbsMonthlyDays")}
                  <HelpTooltip textKey="shiftAdmin.helpDbsMonthlyDays" t={t} />
                </label>
                <input type="number" min="0" value={entry.monthly_max_assignments} onChange={(event) => updateDbsPoolEntry(entry.employee_name, 'monthly_max_assignments', Number.parseInt(event.target.value, 10) || 0)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <button onClick={() => removeDbsEmployee(entry.employee_name)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20">
                <Trash2 className="h-4 w-4" />
                {t("shiftAdmin.dbsRemove")}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={saveDbsPool} disabled={saving === 'dbs-pool'} className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-fuchsia-300 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving === 'dbs-pool' ? t("shiftAdmin.dbsSavingPool") : t("shiftAdmin.dbsSavePool")}
          </button>
        </div>
      </Section>

      {/* ── Rotation rules & overtime ── */}
      <Section title={t("shiftAdmin.sectionRotation")} icon={RotateCcw} helpKey="shiftAdmin.helpSectionRotation" t={t}>
        {rotation ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.rotMaxConsecutiveSame")} <HelpTooltip textKey="shiftAdmin.helpRotMaxConsecutiveSame" t={t} /></label>
                <input type="number" min="1" max="30" value={rotation.max_consecutive_same} onChange={(event) => setRotation({ ...rotation, max_consecutive_same: Number.parseInt(event.target.value, 10) || 1 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.rotMaxConsecutiveWorkdays")} <HelpTooltip textKey="shiftAdmin.helpRotMaxConsecutiveWorkdays" t={t} /></label>
                <input type="number" min="1" max="30" value={rotation.max_consecutive_workdays} onChange={(event) => setRotation({ ...rotation, max_consecutive_workdays: Number.parseInt(event.target.value, 10) || 1 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.rotMinFreeAfterStreak")} <HelpTooltip textKey="shiftAdmin.helpRotMinFreeAfterStreak" t={t} /></label>
                <input type="number" min="0" max="7" value={rotation.min_free_after_streak} onChange={(event) => setRotation({ ...rotation, min_free_after_streak: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.rotMinRestHours")} <HelpTooltip textKey="shiftAdmin.helpRotMinRestHours" t={t} /></label>
                <input type="number" min="8" max="24" value={rotation.min_hours_between_shifts} onChange={(event) => setRotation({ ...rotation, min_hours_between_shifts: Number.parseInt(event.target.value, 10) || 11 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.rotMaxNightsMonth")} <HelpTooltip textKey="shiftAdmin.helpRotMaxNightsMonth" t={t} /></label>
                <input type="number" min="0" max="31" value={rotation.max_nights_per_month} onChange={(event) => setRotation({ ...rotation, max_nights_per_month: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.rotMaxWeekendsMonth")} <HelpTooltip textKey="shiftAdmin.helpRotMaxWeekendsMonth" t={t} /></label>
                <input type="number" min="0" max="10" value={rotation.max_weekends_per_month} onChange={(event) => setRotation({ ...rotation, max_weekends_per_month: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.rotFreeDaysAfterNight")} <HelpTooltip textKey="shiftAdmin.helpRotFreeDaysAfterNight" t={t} /></label>
                <input type="number" min="0" max="7" value={rotation.free_days_after_night} onChange={(event) => setRotation({ ...rotation, free_days_after_night: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.rotFreeDaysAfterWeekend")} <HelpTooltip textKey="shiftAdmin.helpRotFreeDaysAfterWeekend" t={t} /></label>
                <input type="number" min="0" max="7" value={rotation.free_days_after_weekend} onChange={(event) => setRotation({ ...rotation, free_days_after_weekend: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
                <input type="checkbox" checked={rotation.night_to_early_forbidden} onChange={(event) => setRotation({ ...rotation, night_to_early_forbidden: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
                <span className="flex items-center">{t("shiftAdmin.rotNightToEarlyForbidden")} <HelpTooltip textKey="shiftAdmin.helpRotNightToEarlyForbidden" t={t} /></span>
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
                <input type="checkbox" checked={rotation.late_to_early_forbidden} onChange={(event) => setRotation({ ...rotation, late_to_early_forbidden: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
                <span className="flex items-center">{t("shiftAdmin.rotLateToEarlyForbidden")} <HelpTooltip textKey="shiftAdmin.helpRotLateToEarlyForbidden" t={t} /></span>
              </label>
            </div>

            {/* ── Overtime sub-section ── */}
            <div className="mt-2 rounded-2xl border border-amber-400/15 bg-amber-500/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                <Timer className="h-4 w-4" />
                {t("shiftAdmin.overtimeTitle")}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="flex items-center text-xs text-slate-400">
                    {t("shiftAdmin.overtimeMax")}
                    <HelpTooltip textKey="shiftAdmin.helpOvertimeMax" t={t} />
                  </label>
                  <input type="number" min="0" max="200" value={overtimeConfig.maxOvertimeHours} onChange={(event) => setOvertimeConfig({ ...overtimeConfig, maxOvertimeHours: Math.max(0, Number.parseInt(event.target.value, 10) || 0) })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  <div className="mt-1 text-xs text-slate-500">{t("shiftAdmin.overtimeHint")}</div>
                </div>
                <div>
                  <label className="flex items-center text-xs text-slate-400">
                    {t("shiftAdmin.overtimeMode")}
                    <HelpTooltip textKey="shiftAdmin.helpOvertimeMode" t={t} />
                  </label>
                  <select value={overtimeConfig.overtimeMode} onChange={(event) => setOvertimeConfig({ ...overtimeConfig, overtimeMode: event.target.value as OvertimeConfig['overtimeMode'] })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                    <option value="show">{t("shiftAdmin.overtimeModeShow")}</option>
                    <option value="warn">{t("shiftAdmin.overtimeModeWarn")}</option>
                    <option value="hard">{t("shiftAdmin.overtimeModeHard")}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── Daily / Weekly hour limits sub-section ── */}
            <div className="mt-2 rounded-2xl border border-sky-400/15 bg-sky-500/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/80">
                <Clock className="h-4 w-4" />
                {isGerman ? "Arbeitszeitgrenzen" : "Working Time Limits"}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="text-xs text-slate-400">{isGerman ? "Max. Stunden / Tag" : "Max hours / day"}</label>
                  <input type="number" min="0" max="24" step="0.5" value={overtimeConfig.maxDailyHours} onChange={(e) => setOvertimeConfig({ ...overtimeConfig, maxDailyHours: Math.max(0, Math.min(24, parseFloat(e.target.value) || 0)) })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  <div className="mt-1 text-xs text-slate-500">{isGerman ? "0 = kein Limit" : "0 = no limit"}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-400">{isGerman ? "Modus (Tag)" : "Mode (daily)"}</label>
                  <select value={overtimeConfig.dailyMode} onChange={(e) => setOvertimeConfig({ ...overtimeConfig, dailyMode: e.target.value as OvertimeConfig['dailyMode'] })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                    <option value="off">{isGerman ? "Aus" : "Off"}</option>
                    <option value="warn">{isGerman ? "Warnung" : "Warning"}</option>
                    <option value="block">{isGerman ? "Sperre" : "Block"}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">{isGerman ? "Max. Stunden / Woche" : "Max hours / week"}</label>
                  <input type="number" min="0" max="168" step="0.5" value={overtimeConfig.maxWeeklyHours} onChange={(e) => setOvertimeConfig({ ...overtimeConfig, maxWeeklyHours: Math.max(0, Math.min(168, parseFloat(e.target.value) || 0)) })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
                  <div className="mt-1 text-xs text-slate-500">{isGerman ? "0 = kein Limit" : "0 = no limit"}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-400">{isGerman ? "Modus (Woche)" : "Mode (weekly)"}</label>
                  <select value={overtimeConfig.weeklyMode} onChange={(e) => setOvertimeConfig({ ...overtimeConfig, weeklyMode: e.target.value as OvertimeConfig['weeklyMode'] })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                    <option value="off">{isGerman ? "Aus" : "Off"}</option>
                    <option value="warn">{isGerman ? "Warnung" : "Warning"}</option>
                    <option value="block">{isGerman ? "Sperre" : "Block"}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={saveRotation} disabled={saving === 'rotation'} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving === 'rotation' ? t("shiftAdmin.rotSaving") : t("shiftAdmin.rotSave")}
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      {/* ── Fairness ── */}
      <Section title={t("shiftAdmin.sectionFairness")} icon={Scale} helpKey="shiftAdmin.helpSectionFairness" t={t}>
        {fairness ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
                <input type="checkbox" checked={fairness.balance_nights} onChange={(event) => setFairness({ ...fairness, balance_nights: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
                <span className="flex items-center">{t("shiftAdmin.fairBalanceNights")} <HelpTooltip textKey="shiftAdmin.helpFairBalanceNights" t={t} /></span>
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
                <input type="checkbox" checked={fairness.balance_weekends} onChange={(event) => setFairness({ ...fairness, balance_weekends: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
                <span className="flex items-center">{t("shiftAdmin.fairBalanceWeekends")} <HelpTooltip textKey="shiftAdmin.helpFairBalanceWeekends" t={t} /></span>
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
                <input type="checkbox" checked={fairness.balance_total_load} onChange={(event) => setFairness({ ...fairness, balance_total_load: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
                <span className="flex items-center">{t("shiftAdmin.fairBalanceLoad")} <HelpTooltip textKey="shiftAdmin.helpFairBalanceLoad" t={t} /></span>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.fairMaxDeviation")} <HelpTooltip textKey="shiftAdmin.helpFairMaxDeviation" t={t} /></label>
                <input type="number" min="5" max="100" value={fairness.max_deviation_percent} onChange={(event) => setFairness({ ...fairness, max_deviation_percent: Number.parseInt(event.target.value, 10) || 5 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.fairPriority")} <HelpTooltip textKey="shiftAdmin.helpFairPriority" t={t} /></label>
                <select value={fairness.fairness_vs_preference} onChange={(event) => setFairness({ ...fairness, fairness_vs_preference: event.target.value })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                  <option value="fairness">{t("shiftAdmin.fairOptFairness")}</option>
                  <option value="preference">{t("shiftAdmin.fairOptPreference")}</option>
                  <option value="balanced">{t("shiftAdmin.fairOptBalanced")}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={saveFairness} disabled={saving === 'fairness'} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving === 'fairness' ? t("shiftAdmin.fairSaving") : t("shiftAdmin.fairSave")}
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      {/* ── Planning config ── */}
      <Section title={t("shiftAdmin.sectionPlanning")} icon={Sliders} helpKey="shiftAdmin.helpSectionPlanning" t={t}>
        {planConfig ? (
          <div className="space-y-4">
            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
              <input type="checkbox" checked={planConfig.respect_employee_wishes} onChange={(event) => setPlanConfig({ ...planConfig, respect_employee_wishes: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
              <span className="flex items-center">{t("shiftAdmin.planRespectWishes")} <HelpTooltip textKey="shiftAdmin.helpPlanRespectWishes" t={t} /></span>
            </label>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.planTargetHours")} <HelpTooltip textKey="shiftAdmin.helpPlanTargetHours" t={t} /></label>
                <input type="number" min="0" step="0.5" value={planConfig.monthly_target_hours} onChange={(event) => setPlanConfig({ ...planConfig, monthly_target_hours: Number.parseFloat(event.target.value) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
              </div>
              <div>
                <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.planHardRules")} <HelpTooltip textKey="shiftAdmin.helpPlanHardRules" t={t} /></label>
                <input type="range" min="0" max="100" value={planConfig.hard_rules_priority} onChange={(event) => setPlanConfig({ ...planConfig, hard_rules_priority: Number.parseInt(event.target.value, 10) || 0 })} className="mt-3 w-full" />
                <div className="mt-1 text-xs text-slate-400">{planConfig.hard_rules_priority}%</div>
              </div>
              <div>
                <label className="text-xs text-slate-400">{t("shiftAdmin.planSoftWishes")}</label>
                <input type="range" min="0" max="100" value={planConfig.soft_wishes_priority} onChange={(event) => setPlanConfig({ ...planConfig, soft_wishes_priority: Number.parseInt(event.target.value, 10) || 0 })} className="mt-3 w-full" />
                <div className="mt-1 text-xs text-slate-400">{planConfig.soft_wishes_priority}%</div>
              </div>
              <div>
                <label className="text-xs text-slate-400">{t("shiftAdmin.planFairness")}</label>
                <input type="range" min="0" max="100" value={planConfig.fairness_priority} onChange={(event) => setPlanConfig({ ...planConfig, fairness_priority: Number.parseInt(event.target.value, 10) || 0 })} className="mt-3 w-full" />
                <div className="mt-1 text-xs text-slate-400">{planConfig.fairness_priority}%</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
              {t("shiftAdmin.planAdminOverride")}: <span className="font-semibold text-slate-100">{planConfig.admin_override_priority}%</span>
            </div>

            <div className="flex justify-end">
              <button onClick={savePlanConfig} disabled={saving === 'planconfig'} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving === 'planconfig' ? t("shiftAdmin.planSaving") : t("shiftAdmin.planSave")}
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      {/* ── Issues / control panel ── */}
      <Section title={t("shiftAdmin.sectionIssues")} icon={AlertTriangle} helpKey="shiftAdmin.helpSectionIssues" t={t}>
        <div className="mb-4 rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm text-slate-200">
          {t("shiftAdmin.sectionIssuesInfo")}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.issuePanelEnabled} onChange={(event) => setAdvancedSettings({ ...advancedSettings, issuePanelEnabled: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            {t("shiftAdmin.issuePanel")}
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.issueAutoRefresh} onChange={(event) => setAdvancedSettings({ ...advancedSettings, issueAutoRefresh: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            {t("shiftAdmin.issueAutoRefresh")}
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.issueShowSolutions} onChange={(event) => setAdvancedSettings({ ...advancedSettings, issueShowSolutions: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            {t("shiftAdmin.issueShowSolutions")}
          </label>
        </div>

        <div className="mt-4 max-w-sm">
          <label className="text-xs text-slate-400">{t("shiftAdmin.issuePriorityMode")}</label>
          <select value={advancedSettings.issuePriorityMode} onChange={(event) => setAdvancedSettings({ ...advancedSettings, issuePriorityMode: event.target.value as AdvancedPlanningSettings['issuePriorityMode'] })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="staffing_first">{t("shiftAdmin.issueModeStaffing")}</option>
            <option value="balanced">{t("shiftAdmin.issueModeBalanced")}</option>
            <option value="fairness_first">{t("shiftAdmin.issueModeFairness")}</option>
          </select>
        </div>
      </Section>

      {/* ── Illness / replacement ── */}
      <Section title={t("shiftAdmin.sectionIllness")} icon={Settings2} helpKey="shiftAdmin.helpSectionIllness" t={t}>
        <div className="mb-4 rounded-2xl border border-sky-400/15 bg-sky-500/10 px-4 py-3 text-sm text-slate-200">
          {t("shiftAdmin.sectionIllnessInfo")}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.illnessAutoSwapEnabled} onChange={(event) => setAdvancedSettings({ ...advancedSettings, illnessAutoSwapEnabled: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            {t("shiftAdmin.illnessAutoSwap")}
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.illnessRequireSkillMatch} onChange={(event) => setAdvancedSettings({ ...advancedSettings, illnessRequireSkillMatch: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            {t("shiftAdmin.illnessSkillMatch")}
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200 lg:col-span-2">
            <input type="checkbox" checked={advancedSettings.illnessProtectWorklifeBalance} onChange={(event) => setAdvancedSettings({ ...advancedSettings, illnessProtectWorklifeBalance: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            {t("shiftAdmin.illnessProtectWLB")}
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.illnessBuffer")} <HelpTooltip textKey="shiftAdmin.helpIllnessBuffer" t={t} /></label>
            <input type="number" min="0" value={advancedSettings.illnessMinSourceBuffer} onChange={(event) => setAdvancedSettings({ ...advancedSettings, illnessMinSourceBuffer: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
          </div>
          <div>
            <label className="text-xs text-slate-400">{t("shiftAdmin.illnessRestHours")}</label>
            <input type="number" min="8" value={advancedSettings.illnessMinRestHours} onChange={(event) => setAdvancedSettings({ ...advancedSettings, illnessMinRestHours: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
          </div>
        </div>
      </Section>

      {/* ── Weekend planning ── */}
      <Section title={t("shiftAdmin.sectionWeekend")} icon={CalendarDays} helpKey="shiftAdmin.helpSectionWeekend" t={t}>
        <div className="mb-4 rounded-2xl border border-fuchsia-400/15 bg-fuchsia-500/10 px-4 py-3 text-sm text-slate-200">
          {t("shiftAdmin.sectionWeekendInfo")}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={advancedSettings.weekendVolumeEnabled} onChange={(event) => setAdvancedSettings({ ...advancedSettings, weekendVolumeEnabled: event.target.checked })} className="rounded border-white/20 bg-slate-950" />
            {t("shiftAdmin.weekendVolume")}
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.weekendBuffer")} <HelpTooltip textKey="shiftAdmin.helpWeekendBuffer" t={t} /></label>
            <input type="number" min="0" max="100" value={advancedSettings.weekendBufferPercent} onChange={(event) => setAdvancedSettings({ ...advancedSettings, weekendBufferPercent: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
          </div>
          <div>
            <label className="flex items-center text-xs text-slate-400">{t("shiftAdmin.weekendMinDispatchers")} <HelpTooltip textKey="shiftAdmin.helpWeekendMinDispatchers" t={t} /></label>
            <input type="number" min="0" value={advancedSettings.weekendMinDispatchers} onChange={(event) => setAdvancedSettings({ ...advancedSettings, weekendMinDispatchers: Number.parseInt(event.target.value, 10) || 0 })} className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
          </div>
        </div>
      </Section>

      {/* Save button for advanced settings (issues + illness + weekend) */}
      <div className="flex justify-end">
        <button onClick={saveAdvancedSettings} disabled={saving === 'advanced'} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving === 'advanced' ? t("shiftAdmin.advancedSaving") : t("shiftAdmin.advancedSave")}
        </button>
      </div>

      {/* ── Skills & competency matrix ── */}
      <Section title={t("shiftAdmin.sectionSkills")} icon={Star} defaultOpen={false} helpKey="shiftAdmin.helpSectionSkills" t={t}>
        <div className="mb-4 rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm text-slate-200">
          {t("shiftAdmin.sectionSkillsInfo")}
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3 text-sm text-slate-200">
            <input type="checkbox" checked={skillsEnabled} onChange={(event) => setSkillsEnabled(event.target.checked)} className="mt-0.5 rounded border-white/20 bg-slate-950" />
            <span className="flex items-center">
              {t("shiftAdmin.skillsEnabled")}
              <HelpTooltip textKey="shiftAdmin.helpSkillsEnabled" t={t} />
            </span>
          </label>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
            {t("shiftAdmin.skillsEmployeeCount")}: <span className="font-semibold text-slate-100">{skillProfiles.length}</span><br />
            {t("shiftAdmin.skillsCatalogCount")}: <span className="font-semibold text-slate-100">{skillCatalog.length}</span>
          </div>
        </div>

        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${skillsEnabled ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : 'border-slate-500/20 bg-slate-900/45 text-slate-300'}`}>
          {skillsEnabled ? t("shiftAdmin.skillsActive") : t("shiftAdmin.skillsInactive")}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/45 p-4">
          <div className="mb-3 flex items-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            {t("shiftAdmin.skillCatalog")}
            <HelpTooltip textKey="shiftAdmin.helpSkillCatalog" t={t} />
          </div>
          <div className="mb-3 flex flex-col gap-3 xl:flex-row">
            <input value={newSkillName} onChange={(event) => setNewSkillName(event.target.value)} placeholder={t("shiftAdmin.skillAddPlaceholder")} className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" />
            <button onClick={addSkillToCatalog} disabled={!newSkillName.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-400/15 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-400/25 disabled:opacity-50">
              <Plus className="h-4 w-4" />
              {t("shiftAdmin.skillAdd")}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {skillCatalog.map((skill) => (
              <span key={skill} className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-100">
                {skill}
                <button type="button" onClick={() => removeSkillFromCatalog(skill)} className="text-amber-200/80 transition hover:text-white" aria-label={`${skill} ${isGerman ? 'entfernen' : 'remove'}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {skillProfiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-400">{isGerman ? 'Keine Mitarbeiter für die Skill-Matrix gefunden.' : 'No employees found for the skill matrix.'}</div>
          ) : skillProfiles.map((profile) => (
            <div key={profile.employee_name} className="rounded-2xl border border-white/10 bg-slate-900/55 p-4 shadow-[0_10px_30px_rgba(2,6,23,0.2)]">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{profile.employee_name}</div>
                  <div className="text-xs text-slate-400">{t("shiftAdmin.skillRateInfo")}</div>
                </div>
                <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
                  {t("shiftAdmin.skillRatedCount")}: {Object.keys(profile.rated_skills || {}).length}
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
                              aria-label={`${skill} ${star} ${isGerman ? 'Sterne' : 'stars'}`}
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
            {saving === 'skills' ? t("shiftAdmin.skillSaving") : t("shiftAdmin.skillSave")}
          </button>
        </div>
      </Section>

      {/* ── Employee exclusions ── */}
      <Section title={t("shiftAdmin.sectionExclusions")} icon={UserX} helpKey="shiftAdmin.helpSectionExclusions" t={t}>
        <div className="mb-4 flex flex-col gap-3 xl:flex-row">
          <select value={newExclusionName} onChange={(event) => setNewExclusionName(event.target.value)} className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
            <option value="">{t("shiftAdmin.exclSelectEmployee")}</option>
            {employees.filter((employee) => !exclusions.some((exclusion) => exclusion.employee_name === employee)).map((employee) => <option key={employee} value={employee}>{employee}</option>)}
          </select>
          <button onClick={() => void addExclusion()} disabled={!newExclusionName.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50">
            <UserX className="h-4 w-4" />
            {t("shiftAdmin.exclExclude")}
          </button>
        </div>

        {exclusions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-400">{t("shiftAdmin.exclEmpty")}</div>
        ) : (
          <div className="space-y-3">
            {exclusions.map((exclusion) => (
              <div key={exclusion.id} className="flex flex-col gap-3 rounded-2xl border border-red-400/20 bg-red-500/5 p-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-100">{exclusion.employee_name}</div>
                  <div className="text-xs text-slate-400">{t("shiftAdmin.exclCreatedBy")} {exclusion.created_by} {isGerman ? 'am' : 'on'} {new Date(exclusion.created_at).toLocaleDateString(isGerman ? 'de-DE' : 'en-US', { timeZone: 'Europe/Berlin' })}</div>
                </div>
                <button onClick={() => void removeExclusion(exclusion.id)} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20">
                  <Plus className="h-4 w-4" />
                  {t("shiftAdmin.exclRestore")}
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
