/* ================================================ */
/* Employee Preferences – Mitarbeiterwünsche        */
/* Full self-service preference management          */
/* ================================================ */

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/api';
import { EnterpriseCard } from '../layout/EnterpriseLayout';
import {
  Heart, Moon, Sun, CalendarDays, UserX, Users, Briefcase,
  HelpCircle, Save, CheckCircle2, AlertTriangle,
} from 'lucide-react';

function HelpTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1">
      <button type="button" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="text-muted-foreground hover:text-blue-400 transition" aria-label="Hilfe">
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
  max_nights_per_month: number | null;
  preferred_days: number[];
  blocked_days: number[];
  avoid_colleagues: string[];
  workload_preference: string;
  notes: string;
}

const SHIFT_CODES = ['E1', 'E2', 'L1', 'L2', 'N'];
const SHIFT_LABELS: Record<string, string> = { E1: 'Frühschicht 1', E2: 'Frühschicht 2', L1: 'Spätschicht 1', L2: 'Spätschicht 2', N: 'Nachtschicht' };
const DAY_LABELS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const DEFAULTS: Preferences = {
  preferred_shifts: [], unwanted_shifts: [], max_nights_per_month: null,
  preferred_days: [], blocked_days: [], avoid_colleagues: [],
  workload_preference: 'normal', notes: '',
};

export default function EmployeePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [colleagues, setColleagues] = useState<string[]>([]);
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
      const [prefRes, collRes] = await Promise.all([
        api.get('/shift-config/employee-preferences'),
        api.get('/user/eligible-colleagues').catch(() => ({ data: { colleagues: [] } })),
      ]);
      if (prefRes.data.preferences) {
        setPrefs({
          preferred_shifts: prefRes.data.preferences.preferred_shifts || [],
          unwanted_shifts: prefRes.data.preferences.unwanted_shifts || [],
          max_nights_per_month: prefRes.data.preferences.max_nights_per_month,
          preferred_days: prefRes.data.preferences.preferred_days || [],
          blocked_days: prefRes.data.preferences.blocked_days || [],
          avoid_colleagues: prefRes.data.preferences.avoid_colleagues || [],
          workload_preference: prefRes.data.preferences.workload_preference || 'normal',
          notes: prefRes.data.preferences.notes || '',
        });
      }
      setColleagues(collRes.data.colleagues || []);
    } catch (e: any) {
      showToast(e?.response?.data?.error || e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/shift-config/employee-preferences', prefs);
      showToast('Wünsche gespeichert');
      setDirty(false);
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Fehler beim Speichern', 'err');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof Preferences, value: any) => {
    setPrefs(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const toggleInArray = (field: 'preferred_shifts' | 'unwanted_shifts' | 'preferred_days' | 'blocked_days' | 'avoid_colleagues', value: any) => {
    setPrefs(prev => {
      const arr = (prev[field] as any[]) || [];
      const next = arr.includes(value) ? arr.filter((v: any) => v !== value) : [...arr, value];
      return { ...prev, [field]: next };
    });
    setDirty(true);
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
          Bevorzugte Schichten
          <HelpTip text="Wähle die Schichten, die du bevorzugst. Die Planung versucht, dich diesen Schichten zuzuordnen." />
        </h3>
        <div className="flex flex-wrap gap-2">
          {SHIFT_CODES.map(code => (
            <button key={code} onClick={() => toggleInArray('preferred_shifts', code)}
              className={`px-3 py-1.5 text-xs rounded-full border transition font-medium ${
                prefs.preferred_shifts.includes(code)
                  ? 'border-green-500/50 bg-green-500/15 text-green-400'
                  : 'border-border/30 bg-background/40 text-muted-foreground hover:border-green-500/30'
              }`}>
              {code} – {SHIFT_LABELS[code]}
            </button>
          ))}
        </div>
      </EnterpriseCard>

      {/* Unwanted Shifts */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Moon className="w-4 h-4 text-purple-400" />
          Unerwünschte Schichten
          <HelpTip text="Wähle die Schichten, die du vermeiden möchtest. Die Planung versucht, dich nicht diesen Schichten zuzuordnen." />
        </h3>
        <div className="flex flex-wrap gap-2">
          {SHIFT_CODES.map(code => (
            <button key={code} onClick={() => toggleInArray('unwanted_shifts', code)}
              className={`px-3 py-1.5 text-xs rounded-full border transition font-medium ${
                prefs.unwanted_shifts.includes(code)
                  ? 'border-red-500/50 bg-red-500/15 text-red-400'
                  : 'border-border/30 bg-background/40 text-muted-foreground hover:border-red-500/30'
              }`}>
              {code} – {SHIFT_LABELS[code]}
            </button>
          ))}
        </div>
      </EnterpriseCard>

      {/* Max Nights + Workload */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Moon className="w-4 h-4 text-indigo-400" />
          Nachtschichten & Belastung
          <HelpTip text="Lege fest, wie viele Nachtschichten du maximal pro Monat machen möchtest, und deine generelle Belastungspräferenz." />
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Max. Nachtschichten/Monat (leer = keine Begrenzung)</label>
            <input type="number" value={prefs.max_nights_per_month ?? ''} onChange={e => update('max_nights_per_month', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground" min="0" max="31" placeholder="Keine Begrenzung" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Belastungspräferenz</label>
            <select value={prefs.workload_preference} onChange={e => update('workload_preference', e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground">
              <option value="light">Reduziert</option>
              <option value="normal">Normal</option>
              <option value="heavy">Erhöht</option>
            </select>
          </div>
        </div>
      </EnterpriseCard>

      {/* Preferred & Blocked Days */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-blue-400" />
          Bevorzugte & Gesperrte Wochentage
          <HelpTip text="Wähle Tage, an denen du bevorzugt (grün) oder ungern (rot) arbeiten möchtest." />
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((label, idx) => {
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
        <p className="text-[10px] text-muted-foreground mt-2">✓ = bevorzugt, ✗ = gesperrt</p>
      </EnterpriseCard>

      {/* Avoid Colleagues */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <UserX className="w-4 h-4 text-red-400" />
          Nicht mit diesen Kollegen arbeiten
          <HelpTip text="Wähle Kollegen, mit denen du nach Möglichkeit nicht gleichzeitig eingeplant werden möchtest. Dies ist ein weicher Wunsch." />
        </h3>
        <div className="flex flex-wrap gap-2">
          {colleagues.map(name => (
            <button key={name} onClick={() => toggleInArray('avoid_colleagues', name)}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                prefs.avoid_colleagues.includes(name)
                  ? 'border-red-500/50 bg-red-500/15 text-red-400 font-medium'
                  : 'border-border/30 bg-background/40 text-muted-foreground hover:border-red-500/30'
              }`}>
              {name}
            </button>
          ))}
          {colleagues.length === 0 && <p className="text-xs text-muted-foreground italic">Keine Kollegen verfügbar.</p>}
        </div>
      </EnterpriseCard>

      {/* Notes */}
      <EnterpriseCard>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-gray-400" />
          Anmerkungen
          <HelpTip text="Zusätzliche Hinweise für die Planer, z.B. besondere Umstände, Teilzeit, oder andere Wünsche." />
        </h3>
        <textarea value={prefs.notes} onChange={e => update('notes', e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-border/30 bg-background/40 text-foreground min-h-[80px]"
          placeholder="Optionale Anmerkungen..." />
      </EnterpriseCard>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving || !dirty}
          className="flex items-center gap-1.5 text-sm px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 font-medium">
          <Save className="w-4 h-4" />
          {saving ? 'Wird gespeichert...' : 'Wünsche speichern'}
        </button>
      </div>
    </div>
  );
}
