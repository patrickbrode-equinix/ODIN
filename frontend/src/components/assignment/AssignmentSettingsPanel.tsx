/* ================================================ */
/* ODIN-Logik — Settings Panel                      */
/* ================================================ */

import { useState, useEffect } from 'react';
import { useAssignmentStore } from '../../store/assignmentStore';
import { Save, RefreshCw } from 'lucide-react';
import type { AssignmentSettings } from '../../types/assignment';

const SETTING_DEFS: { key: string & keyof AssignmentSettings; label: string; type: 'select' | 'boolean' | 'number' | 'text'; options?: string[] }[] = [
  { key: 'assignment.mode', label: 'Modus', type: 'select', options: ['shadow', 'dry-run'] },
  { key: 'assignment.siteStrictness', label: 'Site-Strenge', type: 'boolean' },
  { key: 'assignment.responsibilityStrictness', label: 'Verantwortungsbereich-Strenge', type: 'boolean' },
  { key: 'assignment.enableRotationTieBreaker', label: 'Rotation Tie-Breaker', type: 'boolean' },
  { key: 'assignment.fallbackTieBreaker', label: 'Fallback Tie-Breaker', type: 'select', options: ['stable-id', 'random'] },
  { key: 'assignment.planningWindowHours', label: 'Planungsfenster (Std.)', type: 'number' },
  { key: 'assignment.maxTicketsPerRun', label: 'Max. Tickets pro Run', type: 'number' },
  { key: 'assignment.stopOnCriticalError', label: 'Stop bei kritischem Fehler', type: 'boolean' },
  { key: 'assignment.supportedTicketTypes', label: 'Unterstützte Tickettypen', type: 'text' },
];

export function AssignmentSettingsPanel() {
  const { settings, settingsSaving, updateSettings, fetchSettings } = useAssignmentStore();
  const [local, setLocal] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      setLocal({ ...settings });
    }
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await updateSettings(local as Partial<AssignmentSettings>);
  };

  return (
    <div className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground">Einstellungen</h3>
        <div className="flex gap-2">
          <button
            onClick={() => fetchSettings()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border/40 bg-background/60 hover:bg-background/80 transition text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3 h-3" />
            Neu laden
          </button>
          <button
            onClick={handleSave}
            disabled={settingsSaving}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
          >
            <Save className="w-3 h-3" />
            {settingsSaving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {SETTING_DEFS.map((def) => (
          <div key={def.key} className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{def.label}</label>
            {def.type === 'select' ? (
              <select
                className="text-sm rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-foreground"
                value={local[def.key] || ''}
                onChange={(e) => handleChange(def.key, e.target.value)}
              >
                {def.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : def.type === 'boolean' ? (
              <select
                className="text-sm rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-foreground"
                value={local[def.key] || 'false'}
                onChange={(e) => handleChange(def.key, e.target.value)}
              >
                <option value="true">Ja</option>
                <option value="false">Nein</option>
              </select>
            ) : def.type === 'number' ? (
              <input
                type="number"
                className="text-sm rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-foreground"
                value={local[def.key] || ''}
                onChange={(e) => handleChange(def.key, e.target.value)}
              />
            ) : (
              <input
                type="text"
                className="text-sm rounded-md border border-border/40 bg-background/60 px-2 py-1.5 text-foreground"
                value={local[def.key] || ''}
                onChange={(e) => handleChange(def.key, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
