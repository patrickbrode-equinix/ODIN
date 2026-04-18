/* ================================================ */
/* Employee Preferences – Mitarbeiterwünsche        */
/* Full self-service preference management          */
/* ================================================ */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../api/api';
import { EnterpriseCard } from '../layout/EnterpriseLayout';
import { dispatchColleagueSelections, listenColleagueSelections } from '../../utils/colleaguePreferenceSync';
import { getEligibleColleagues, type EligibleColleague } from '../../api/userPreferences';
import { useLanguage, getLanguageLocale } from '../../context/LanguageContext';
import { formatAbsoluteDateTime, formatRelativeTime } from '../../utils/loginStatus';
import {
  Heart, Moon, Sun, CalendarDays, UserX, Users, Briefcase,
  HelpCircle, Save, CheckCircle2, AlertTriangle,
} from 'lucide-react';

const COPY = {
  de: {
    help: 'Hilfe',
    conflictResolved: 'Konflikt bereinigt: Wunschkollegen wurden aus der Ausschlussliste entfernt.',
    colleagueConflict: 'Konflikt in den Kollegenlisten',
    saved: 'Wünsche gespeichert',
    saveFailed: 'Fehler beim Speichern',
    alreadyPreferredSuffix: 'ist bereits als Wunschkollege ausgewählt.',
    preferredShifts: 'Bevorzugte Schichten',
    preferredShiftsHelp: 'Wähle die Schichten, die du bevorzugst. Die Planung versucht, dich diesen Schichten zuzuordnen.',
    unwantedShifts: 'Unerwünschte Schichten',
    unwantedShiftsHelp: 'Wähle die Schichten, die du vermeiden möchtest. Die Planung versucht, dich nicht diesen Schichten zuzuordnen.',
    holidays: 'Feiertagswünsche',
    holidaysHelp: 'Wähle bundesweite und hessische Feiertage, an denen du nach Möglichkeit nicht eingeplant werden möchtest. Diese Auswahl wirkt als weicher Mitarbeiterwunsch in der Schichtplanung.',
    ramadanHint: 'Wenn du Ramadan auswählst, behandelt die Planung das als Entlastungswunsch im Ramadan-Zeitraum. Spät- und besonders Nachtschichten werden dann nach Möglichkeit schwächer priorisiert.',
    nightsLoad: 'Nachtschichten & Belastung',
    nightsLoadHelp: 'Lege fest, wie viele Nachtschichten du maximal pro Monat machen möchtest, und deine generelle Belastungspräferenz.',
    maxNights: 'Max. Nachtschichten/Monat (leer = keine Begrenzung)',
    noLimit: 'Keine Begrenzung',
    workload: 'Belastungspräferenz',
    workloadLight: 'Reduziert',
    workloadNormal: 'Normal',
    workloadHeavy: 'Erhöht',
    workloadBody: 'Belastung beschreibt, wie stark du insgesamt verplant werden möchtest. Reduziert bevorzugt eine eher leichtere Planung, Normal steht für die übliche Verteilung und Erhöht signalisiert, dass du bei Bedarf auch stärker berücksichtigt werden kannst.',
    workloadHint: 'Diese Einstellung ist ein weicher Wunsch. Harte Regeln, gesetzliche Grenzen, faire Verteilung und Mindestbesetzung haben weiterhin Vorrang vor der Belastungspräferenz.',
    weekDays: 'Bevorzugte & Gesperrte Wochentage',
    weekDaysHelp: 'Wähle Tage, an denen du bevorzugt (grün) oder ungern (rot) arbeiten möchtest.',
    weekDayLegend: '✓ = bevorzugt, ✗ = gesperrt',
    avoidColleagues: 'Nicht mit diesen Kollegen arbeiten',
    avoidHelp: 'Wähle Kollegen, mit denen du nach Möglichkeit nicht gleichzeitig eingeplant werden möchtest. Dies ist ein weicher Wunsch.',
    avoidHint: 'Sobald ein Mitarbeiter in den Wunschkollegen ausgewählt ist, wird er hier automatisch gesperrt. Umgekehrt werden Konflikte direkt bereinigt, damit beide Listen logisch konsistent bleiben.',
    searchEmployees: 'Mitarbeiter suchen',
    filterByName: 'Nach Namen filtern...',
    excludedEmployees: 'Mitarbeiter ausgeschlossen',
    lockedByPreferred: 'Bereits in Wunschkollegen ausgewählt',
    softExclude: 'Als weicher Ausschlusswunsch speichern',
    neverLoggedIn: 'Noch nie eingeloggt',
    noMatchingEmployees: 'Keine passenden Mitarbeiter gefunden.',
    noColleagues: 'Keine Kollegen verfügbar.',
    notes: 'Anmerkungen',
    notesHelp: 'Zusätzliche Hinweise für die Planer, z.B. besondere Umstände, Teilzeit, oder andere Wünsche.',
    notesPlaceholder: 'Optionale Anmerkungen...',
    saving: 'Wird gespeichert...',
    savePreferences: 'Wünsche speichern',
  },
  en: {
    help: 'Help',
    conflictResolved: 'Conflict resolved: preferred colleagues were removed from the exclusion list.',
    colleagueConflict: 'Conflict in colleague lists',
    saved: 'Preferences saved',
    saveFailed: 'Failed to save',
    alreadyPreferredSuffix: 'is already selected as a preferred colleague.',
    preferredShifts: 'Preferred shifts',
    preferredShiftsHelp: 'Choose the shifts you prefer. Planning will try to assign you to these shifts.',
    unwantedShifts: 'Unwanted shifts',
    unwantedShiftsHelp: 'Choose the shifts you want to avoid. Planning will try not to assign you to these shifts.',
    holidays: 'Holiday preferences',
    holidaysHelp: 'Choose nationwide and Hessen public holidays on which you should preferably not be scheduled. This acts as a soft planning preference.',
    ramadanHint: 'If you select Ramadan, planning treats this as a reduced-load preference during Ramadan. Late and especially night shifts are then deprioritized when possible.',
    nightsLoad: 'Night shifts & workload',
    nightsLoadHelp: 'Set how many night shifts you want to work at most per month and your general workload preference.',
    maxNights: 'Max. night shifts/month (empty = no limit)',
    noLimit: 'No limit',
    workload: 'Workload preference',
    workloadLight: 'Reduced',
    workloadNormal: 'Normal',
    workloadHeavy: 'Increased',
    workloadBody: 'Workload describes how heavily you want to be scheduled overall. Reduced prefers a lighter plan, Normal is the standard distribution, and Increased signals that you can be considered more strongly if needed.',
    workloadHint: 'This is a soft preference. Hard rules, legal limits, fair distribution, and minimum staffing still take priority over workload preference.',
    weekDays: 'Preferred & blocked weekdays',
    weekDaysHelp: 'Choose the days on which you prefer to work (green) or prefer not to work (red).',
    weekDayLegend: '✓ = preferred, ✗ = blocked',
    avoidColleagues: 'Do not work with these colleagues',
    avoidHelp: 'Choose colleagues you should preferably not be scheduled with at the same time. This is a soft preference.',
    avoidHint: 'As soon as an employee is selected as a preferred colleague, they are automatically blocked here. Conflicts are also cleaned up directly so both lists remain logically consistent.',
    searchEmployees: 'Search employees',
    filterByName: 'Filter by name...',
    excludedEmployees: 'employees excluded',
    lockedByPreferred: 'Already selected in preferred colleagues',
    softExclude: 'Store as a soft exclusion preference',
    neverLoggedIn: 'Never logged in',
    noMatchingEmployees: 'No matching employees found.',
    noColleagues: 'No colleagues available.',
    notes: 'Notes',
    notesHelp: 'Additional notes for planners, for example special circumstances, part-time status, or other wishes.',
    notesPlaceholder: 'Optional notes...',
    saving: 'Saving...',
    savePreferences: 'Save preferences',
  },
} as const;

function HelpTip({ text }: { text: string }) {
  const { language } = useLanguage();
  const copy = COPY[language as keyof typeof COPY] || COPY.en;
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <button type="button" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="text-muted-foreground hover:text-blue-400 transition" aria-label={copy.help}>
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show && (
        <div className="absolute left-6 top-0 z-50 w-56 p-2.5 text-xs leading-relaxed rounded-lg border border-blue-500/30 bg-[#0a0f1e]/95 text-muted-foreground shadow-xl">
          {text}
        </div>
      )}
    </span>
  );
}

interface Preferences {
  preferred_shifts: string[];
  unwanted_shifts: string[];
  preferred_holidays: string[];
  max_nights_per_month: number | null;
  preferred_days: number[];
  blocked_days: number[];
  avoid_colleagues: string[];
  workload_preference: string;
  notes: string;
}

const SHIFT_CODES = ['E1', 'E2', 'L1', 'L2', 'N'];
const SHIFT_LABELS_DE: Record<string, string> = { E1: 'Frühschicht 1', E2: 'Frühschicht 2', L1: 'Spätschicht 1', L2: 'Spätschicht 2', N: 'Nachtschicht' };
const SHIFT_LABELS_EN: Record<string, string> = { E1: 'Early shift 1', E2: 'Early shift 2', L1: 'Late shift 1', L2: 'Late shift 2', N: 'Night shift' };
const DAY_LABELS_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DAY_LABELS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOLIDAY_OPTIONS_DE = [
  { value: 'Neujahr', label: 'Neujahr', scope: 'Bundesweit' },
  { value: 'Karfreitag', label: 'Karfreitag', scope: 'Bundesweit' },
  { value: 'Ostermontag', label: 'Ostermontag', scope: 'Bundesweit' },
  { value: 'Tag der Arbeit', label: 'Tag der Arbeit', scope: 'Bundesweit' },
  { value: 'Christi Himmelfahrt', label: 'Christi Himmelfahrt', scope: 'Bundesweit' },
  { value: 'Pfingstmontag', label: 'Pfingstmontag', scope: 'Bundesweit' },
  { value: 'Tag der Deutschen Einheit', label: 'Tag der Deutschen Einheit', scope: 'Bundesweit' },
  { value: '1. Weihnachtstag', label: '1. Weihnachtstag', scope: 'Bundesweit' },
  { value: '2. Weihnachtstag', label: '2. Weihnachtstag', scope: 'Bundesweit' },
  { value: 'Fronleichnam', label: 'Fronleichnam', scope: 'Hessen' },
  { value: 'Ramadan', label: 'Ramadan', scope: 'Entlastungswunsch' },
] as const;
const HOLIDAY_OPTIONS_EN = [
  { value: 'Neujahr', label: "New Year's Day", scope: 'Nationwide' },
  { value: 'Karfreitag', label: 'Good Friday', scope: 'Nationwide' },
  { value: 'Ostermontag', label: 'Easter Monday', scope: 'Nationwide' },
  { value: 'Tag der Arbeit', label: 'Labour Day', scope: 'Nationwide' },
  { value: 'Christi Himmelfahrt', label: 'Ascension Day', scope: 'Nationwide' },
  { value: 'Pfingstmontag', label: 'Whit Monday', scope: 'Nationwide' },
  { value: 'Tag der Deutschen Einheit', label: 'German Unity Day', scope: 'Nationwide' },
  { value: '1. Weihnachtstag', label: 'Christmas Day', scope: 'Nationwide' },
  { value: '2. Weihnachtstag', label: 'Boxing Day', scope: 'Nationwide' },
  { value: 'Fronleichnam', label: 'Corpus Christi', scope: 'Hessen' },
  { value: 'Ramadan', label: 'Ramadan', scope: 'Reduced-load preference' },
] as const;

const DEFAULTS: Preferences = {
  preferred_shifts: [], unwanted_shifts: [], preferred_holidays: [], max_nights_per_month: null,
  preferred_days: [], blocked_days: [], avoid_colleagues: [],
  workload_preference: 'normal', notes: '',
};

function normalizeNameList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function isSameList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export default function EmployeePreferences() {
  const { language } = useLanguage();
  const locale = getLanguageLocale(language);
  const copy = COPY[language as keyof typeof COPY] || COPY.en;
  const isGerman = language === 'de';
  const shiftLabels = isGerman ? SHIFT_LABELS_DE : SHIFT_LABELS_EN;
  const dayLabels = isGerman ? DAY_LABELS_DE : DAY_LABELS_EN;
  const holidayOptions = isGerman ? HOLIDAY_OPTIONS_DE : HOLIDAY_OPTIONS_EN;
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [colleagues, setColleagues] = useState<EligibleColleague[]>([]);
  const [preferredColleagues, setPreferredColleagues] = useState<string[]>([]);
  const [colleagueSearch, setColleagueSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [dirty, setDirty] = useState(false);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prefRes, collRes, preferredRes] = await Promise.all([
        api.get('/shift-config/employee-preferences'),
        getEligibleColleagues().catch(() => []),
        api.get('/user/preferred-colleagues').catch(() => ({ data: [] })),
      ]);
      if (prefRes.data.preferences) {
        setPrefs({
          preferred_shifts: prefRes.data.preferences.preferred_shifts || [],
          unwanted_shifts: prefRes.data.preferences.unwanted_shifts || [],
          preferred_holidays: prefRes.data.preferences.preferred_holidays || [],
          max_nights_per_month: prefRes.data.preferences.max_nights_per_month,
          preferred_days: prefRes.data.preferences.preferred_days || [],
          blocked_days: prefRes.data.preferences.blocked_days || [],
          avoid_colleagues: normalizeNameList(prefRes.data.preferences.avoid_colleagues || []),
          workload_preference: prefRes.data.preferences.workload_preference || 'normal',
          notes: prefRes.data.preferences.notes || '',
        });
      } else {
        setPrefs(DEFAULTS);
      }
      const normalizedPreferred = normalizeNameList(preferredRes.data);
      setPreferredColleagues(normalizedPreferred);
      setColleagues(collRes);
    } catch (e: any) {
      showToast(e?.response?.data?.error || e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return listenColleagueSelections(({ preferred }) => {
      const normalizedPreferred = normalizeNameList(preferred);
      setPreferredColleagues((current) => isSameList(current, normalizedPreferred) ? current : normalizedPreferred);
      setPrefs((current) => {
        const nextAvoid = current.avoid_colleagues.filter((name) => !normalizedPreferred.includes(name));
        if (nextAvoid.length === current.avoid_colleagues.length) return current;
        setDirty(true);
        showToast(copy.conflictResolved, 'err');
        return { ...current, avoid_colleagues: nextAvoid };
      });
    });
  }, [copy.conflictResolved]);

  useEffect(() => {
    dispatchColleagueSelections({
      preferred: preferredColleagues,
      avoid: prefs.avoid_colleagues,
    });
  }, [preferredColleagues, prefs.avoid_colleagues]);

  const filteredColleagues = useMemo(() => {
    const query = colleagueSearch.trim().toLowerCase();
    if (!query) return colleagues;
    return colleagues.filter((entry) => entry.name.toLowerCase().includes(query));
  }, [colleagues, colleagueSearch]);

  const handleSave = async () => {
    const overlap = prefs.avoid_colleagues.filter((name) => preferredColleagues.includes(name));
    if (overlap.length > 0) {
      showToast(`${copy.colleagueConflict}: ${overlap.join(', ')}`, 'err');
      return;
    }
    setSaving(true);
    try {
      await api.put('/shift-config/employee-preferences', prefs);
      showToast(copy.saved);
      setDirty(false);
    } catch (e: any) {
      showToast(e?.response?.data?.error || copy.saveFailed, 'err');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof Preferences, value: any) => {
    setPrefs(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const toggleInArray = (field: 'preferred_shifts' | 'unwanted_shifts' | 'preferred_holidays' | 'preferred_days' | 'blocked_days' | 'avoid_colleagues', value: any) => {
    setPrefs(prev => {
      const arr = (prev[field] as any[]) || [];
      const next = arr.includes(value) ? arr.filter((v: any) => v !== value) : [...arr, value];
      return { ...prev, [field]: next };
    });
    setDirty(true);
  };

  const toggleAvoidColleague = (name: string) => {
    if (preferredColleagues.includes(name)) {
      showToast(`${name} ${copy.alreadyPreferredSuffix}`, 'err');
      return;
    }
    toggleInArray('avoid_colleagues', name);
  };

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" /></div>;

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${toast.type === 'ok' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Preferred Shifts */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Sun className="w-4 h-4 text-amber-400" />
          {copy.preferredShifts}
          <HelpTip text={copy.preferredShiftsHelp} />
        </h3>
        <div className="flex flex-wrap gap-2">
          {SHIFT_CODES.map(code => (
            <button key={code} onClick={() => toggleInArray('preferred_shifts', code)}
              className={`px-3 py-1.5 text-xs rounded-full border transition font-medium ${
                prefs.preferred_shifts.includes(code)
                  ? 'border-green-500/50 bg-green-500/15 text-green-400'
                  : 'border-border/30 bg-background/40 text-muted-foreground hover:border-green-500/30'
              }`}>
              {code} – {shiftLabels[code]}
            </button>
          ))}
        </div>
      </EnterpriseCard>

      {/* Unwanted Shifts */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Moon className="w-4 h-4 text-purple-400" />
          {copy.unwantedShifts}
          <HelpTip text={copy.unwantedShiftsHelp} />
        </h3>
        <div className="flex flex-wrap gap-2">
          {SHIFT_CODES.map(code => (
            <button key={code} onClick={() => toggleInArray('unwanted_shifts', code)}
              className={`px-3 py-1.5 text-xs rounded-full border transition font-medium ${
                prefs.unwanted_shifts.includes(code)
                  ? 'border-red-500/50 bg-red-500/15 text-red-400'
                  : 'border-border/30 bg-background/40 text-muted-foreground hover:border-red-500/30'
              }`}>
              {code} – {shiftLabels[code]}
            </button>
          ))}
        </div>
      </EnterpriseCard>

      {/* Holiday Preferences */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-rose-400" />
          {copy.holidays}
          <HelpTip text={copy.holidaysHelp} />
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {holidayOptions.map((holiday) => {
            const checked = prefs.preferred_holidays.includes(holiday.value);
            return (
              <label key={holiday.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 transition ${checked ? 'border-rose-500/40 bg-rose-500/10' : 'border-border/30 bg-background/40 hover:border-rose-500/25'}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleInArray('preferred_holidays', holiday.value)}
                  className="mt-0.5 h-4 w-4 rounded border-border/40 bg-background/80 text-rose-500"
                />
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${checked ? 'text-rose-300' : 'text-foreground'}`}>{holiday.label}</div>
                  <div className="text-[11px] text-muted-foreground">{holiday.scope}</div>
                </div>
              </label>
            );
          })}
        </div>
        <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          {copy.ramadanHint}
        </div>
      </EnterpriseCard>

      {/* Max Nights + Workload */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Moon className="w-4 h-4 text-indigo-400" />
          {copy.nightsLoad}
          <HelpTip text={copy.nightsLoadHelp} />
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">{copy.maxNights}</label>
            <input type="number" value={prefs.max_nights_per_month ?? ''} onChange={e => update('max_nights_per_month', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" min="0" max="31" placeholder={copy.noLimit} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{copy.workload}</label>
            <select value={prefs.workload_preference} onChange={e => update('workload_preference', e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground">
              <option value="light">{copy.workloadLight}</option>
              <option value="normal">{copy.workloadNormal}</option>
              <option value="heavy">{copy.workloadHeavy}</option>
            </select>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {copy.workloadBody}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          {copy.workloadHint}
        </div>
      </EnterpriseCard>

      {/* Preferred & Blocked Days */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-blue-400" />
          {copy.weekDays}
          <HelpTip text={copy.weekDaysHelp} />
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {dayLabels.map((label, idx) => {
            const isPref = prefs.preferred_days.includes(idx);
            const isBlocked = prefs.blocked_days.includes(idx);
            return (
              <div key={idx} className="text-center">
                <span className="text-[10px] text-muted-foreground">{label.slice(0, 2)}</span>
                <div className="flex flex-col gap-1 mt-1">
                  <button onClick={() => { if (isBlocked) toggleInArray('blocked_days', idx); toggleInArray('preferred_days', idx); }}
                    className={`px-2 py-1 text-[10px] rounded border transition ${isPref ? 'border-green-500/50 bg-green-500/15 text-green-400' : 'border-border/30 bg-background/40 text-muted-foreground'}`}>
                    ✓
                  </button>
                  <button onClick={() => { if (isPref) toggleInArray('preferred_days', idx); toggleInArray('blocked_days', idx); }}
                    className={`px-2 py-1 text-[10px] rounded border transition ${isBlocked ? 'border-red-500/50 bg-red-500/15 text-red-400' : 'border-border/30 bg-background/40 text-muted-foreground'}`}>
                    ✗
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">{copy.weekDayLegend}</p>
      </EnterpriseCard>

      {/* Avoid Colleagues */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <UserX className="w-4 h-4 text-red-400" />
          {copy.avoidColleagues}
          <HelpTip text={copy.avoidHelp} />
        </h3>
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          {copy.avoidHint}
        </div>
        {colleagues.length > 8 && (
          <div>
            <label className="text-xs text-muted-foreground">{copy.searchEmployees}</label>
            <input
              type="text"
              value={colleagueSearch}
              onChange={(event) => setColleagueSearch(event.target.value)}
              placeholder={copy.filterByName}
              className="mt-1 w-full rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-sm text-foreground"
            />
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">{prefs.avoid_colleagues.length} {copy.excludedEmployees}</p>
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {filteredColleagues.map((entry) => {
            const checked = prefs.avoid_colleagues.includes(entry.name);
            const lockedByPreferred = preferredColleagues.includes(entry.name);
            const absoluteLastLogin = formatAbsoluteDateTime(entry.lastLogin, locale);
            const relativeLastLogin = formatRelativeTime(entry.lastLogin, locale);
            return (
              <label
                key={entry.name}
                className={`flex items-center gap-3 rounded-lg border p-2.5 transition ${
                  checked
                    ? 'border-red-500/40 bg-red-500/15'
                    : 'border-border/20 bg-background/30 hover:border-red-500/25'
                } ${lockedByPreferred ? 'opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={lockedByPreferred}
                  onChange={() => toggleAvoidColleague(entry.name)}
                  className="h-4 w-4 rounded border-border/40 bg-background/80 text-red-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${entry.hasLoggedIn ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]' : 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.45)]'}`} />
                    <div className={`text-sm font-medium ${checked ? 'text-red-300' : 'text-foreground'}`}>{entry.name}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {lockedByPreferred ? copy.lockedByPreferred : copy.softExclude}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {entry.hasLoggedIn
                      ? `${absoluteLastLogin || entry.lastLogin} • ${relativeLastLogin || '-'}`
                      : copy.neverLoggedIn}
                  </div>
                </div>
              </label>
            );
          })}
          {filteredColleagues.length === 0 && (
            <p className="py-2 text-xs italic text-muted-foreground">
              {colleagueSearch ? copy.noMatchingEmployees : copy.noColleagues}
            </p>
          )}
        </div>
      </EnterpriseCard>

      {/* Notes */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-gray-400" />
          {copy.notes}
          <HelpTip text={copy.notesHelp} />
        </h3>
        <textarea value={prefs.notes} onChange={e => update('notes', e.target.value)}
          className="w-full min-h-20 rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-sm text-foreground"
          placeholder={copy.notesPlaceholder} />
      </EnterpriseCard>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving || !dirty}
          className="flex items-center gap-1.5 text-sm px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 font-medium">
          <Save className="w-4 h-4" />
          {saving ? copy.saving : copy.savePreferences}
        </button>
      </div>
    </div>
  );
}
