/* ================================================ */
/* ODIN-Logik — Settings Panel                      */
/* Full explanatory tooltips for every setting       */
/* ================================================ */

import { useState, useEffect } from 'react';
import { useAssignmentStore } from '../../store/assignmentStore';
import { Save, RefreshCw } from 'lucide-react';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import type { AssignmentSettings } from '../../types/assignment';

interface SettingDef {
  key: string & keyof AssignmentSettings;
  label: string;
  type: 'select' | 'boolean' | 'number' | 'text';
  options?: string[];
  tooltip: React.ReactNode;
}

const SETTING_DEFS: SettingDef[] = [
  {
    key: 'assignment.mode',
    label: 'Modus',
    type: 'select',
    options: ['shadow', 'dry-run', 'live'],
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Legt den Betriebsmodus der Assignment Engine fest.</p>
        <p><strong>Shadow:</strong> Die Engine führt den kompletten Zuweisungslauf durch, speichert alle Entscheidungen in der Datenbank — aber ändert <em>keine</em> Ticketzuweisungen im Produktivsystem. Ideal für Validierung und Auditing.</p>
        <p><strong>Dry-Run:</strong> Wie Shadow, aber explizit als einmaliger Testlauf markiert. Wird nicht in reguläre Statistiken einbezogen.</p>
        <p><strong>Live:</strong> Die Engine führt den gesamten Zuweisungsprozess aus und wendet die Ergebnisse <em>produktiv</em> an — Tickets werden tatsächlich zugewiesen. Nur verwenden, wenn die Logik zuvor im Shadow-Modus validiert wurde.</p>
        <p><strong>⚠ Hinweis:</strong> Der Wechsel zu „Live" erfordert zusätzlich die explizite Aktivierung der automatischen Zuweisung über die Steuerleiste oben. Eine versehentliche Produktivzuweisung wird durch eine Sicherheitsabfrage verhindert.</p>
      </>
    ),
  },
  {
    key: 'assignment.crawlerMaxAgeMinutes',
    label: 'Crawler Max-Alter (Min.)',
    type: 'number',
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Legt fest, wie alt die zuletzt eingegangenen Crawler-Daten maximal sein dürfen (in Minuten), bevor die Engine den Lauf abbricht.</p>
        <p><strong>Auswirkung:</strong> Wenn keine frischen Daten vom Jarvis-Crawler vorliegen, arbeitet die Engine potenziell mit veralteten Ticketständen. Diese Schutzregel verhindert Fehlzuweisungen auf Basis veralteter Informationen.</p>
        <p><strong>Zu niedriger Wert:</strong> Die Engine blockiert unnötig oft, weil selbst kurze Crawler-Pausen zum Abbruch führen.</p>
        <p><strong>Zu hoher Wert:</strong> Es besteht das Risiko, dass auf veraltete Ticketdaten entschieden wird, die bereits manuell bearbeitet wurden.</p>
        <p><strong>Empfehlung:</strong> 5–15 Minuten. Standard: 10 Minuten.</p>
      </>
    ),
  },
  {
    key: 'assignment.siteStrictness',
    label: 'Site-Strenge',
    type: 'boolean',
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Wenn aktiviert, dürfen Tickets nur Mitarbeitern zugewiesen werden, die der gleichen Site (z. B. FR2, FR5) zugeordnet sind wie das Ticket.</p>
        <p><strong>Aktiv:</strong> Strenger Site-Abgleich. Ein Mitarbeiter in FR2 erhält keine Tickets aus FR5. Reduziert die Kandidatenmenge, stellt aber sicher, dass Techniker physisch vor Ort sind.</p>
        <p><strong>Inaktiv:</strong> Tickets können site-übergreifend zugewiesen werden. Sinnvoll bei Unterbesetzung oder wenn Sites personell eng zusammenarbeiten.</p>
        <p><strong>Risiko:</strong> Bei aktiver Site-Strenge und wenigen verfügbaren Mitarbeitern einer Site kann es verstärkt zu „Manual Review"-Entscheidungen kommen.</p>
      </>
    ),
  },
  {
    key: 'assignment.responsibilityStrictness',
    label: 'Verantwortungsbereich-Strenge',
    type: 'boolean',
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Wenn aktiviert, wird geprüft, ob der Verantwortungsbereich (Responsibility) des Mitarbeiters zum Ticket passt.</p>
        <p><strong>Aktiv:</strong> Nur Mitarbeiter mit passendem Zuständigkeitsbereich werden als Kandidaten berücksichtigt. Stellt sicher, dass Tickets an fachlich geeignete Personen gehen.</p>
        <p><strong>Inaktiv:</strong> Der Verantwortungsbereich wird bei der Zuweisung ignoriert. Alle Mitarbeiter aus der passenden Schicht sind grundsätzlich Kandidaten.</p>
        <p><strong>Typische Nutzung:</strong> Im Regelbetrieb aktiviert, wird bei akuter Unterbesetzung gelegentlich deaktiviert.</p>
      </>
    ),
  },
  {
    key: 'assignment.enableRotationTieBreaker',
    label: 'Rotation Tie-Breaker',
    type: 'boolean',
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Wenn mehrere Mitarbeiter nach allen Bewertungskriterien vollkommen gleichwertig sind, bestimmt dieser Tie-Breaker, ob eine Rotation stattfindet.</p>
        <p><strong>Aktiv:</strong> Bei Gleichstand wird der Mitarbeiter bevorzugt, der am längsten kein Ticket erhalten hat. Sorgt für fairere Verteilung über die Schicht.</p>
        <p><strong>Inaktiv:</strong> Bei Gleichstand greift der Fallback-Tie-Breaker (z. B. stabile Worker-ID). Es entscheidet dann ein deterministischer, aber nicht rotierender Mechanismus.</p>
        <p><strong>Hinweis:</strong> Die Rotation bezieht sich nur auf den absoluten Gleichstand nach System-Gruppierung, Queue-Reinheit und Auslastung.</p>
      </>
    ),
  },
  {
    key: 'assignment.fallbackTieBreaker',
    label: 'Fallback Tie-Breaker',
    type: 'select',
    options: ['stable-id', 'random'],
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Bestimmt den letzten Entscheidungsmechanismus, wenn alle anderen Bewertungskriterien keinen eindeutigen Gewinner ergeben.</p>
        <p><strong>stable-id:</strong> Die niedrigste Worker-ID gewinnt. Dies macht jede Entscheidung exakt reproduzierbar — identische Inputs führen immer zum selben Ergebnis. Ideal für Auditing und Nachvollziehbarkeit.</p>
        <p><strong>random:</strong> Eine zufällige Auswahl unter den Gleichstand-Kandidaten. Kann fairere Verteilung bewirken, erschwert aber die Nachvollziehbarkeit.</p>
        <p><strong>Empfehlung:</strong> „stable-id" für produktive Umgebungen, wenn Auditierbarkeit Priorität hat.</p>
      </>
    ),
  },
  {
    key: 'assignment.planningWindowHours',
    label: 'Planungsfenster (Std.)',
    type: 'number',
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Legt fest, wie weit in die Zukunft die Engine bei der Ticketverarbeitung vorausschaut (in Stunden).</p>
        <p><strong>Auswirkung:</strong> Tickets mit einer Commit-Time, die weiter als dieses Fenster in der Zukunft liegt, werden in diesem Lauf nicht berücksichtigt, sondern erst in einem späteren Lauf verarbeitet.</p>
        <p><strong>Wichtig:</strong> Tickets, die bereits überfällig sind (Commit-Time in der Vergangenheit), werden unabhängig vom Planungsfenster <em>immer</em> als dringend behandelt.</p>
        <p><strong>Zu kleiner Wert:</strong> Tickets werden erst kurz vor der Deadline eingeplant, was zu Engpässen führen kann.</p>
        <p><strong>Zu großer Wert:</strong> Tickets aus weit entfernter Zukunft konkurrieren mit akut dringenden Tickets.</p>
      </>
    ),
  },
  {
    key: 'assignment.maxTicketsPerRun',
    label: 'Max. Tickets pro Run',
    type: 'number',
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Begrenzt die maximale Anzahl an Tickets, die in einem einzelnen Engine-Lauf verarbeitet werden.</p>
        <p><strong>Auswirkung:</strong> Verhindert, dass ein einzelner Lauf bei extremer Ticketlast (z. B. nach längerem Crawler-Ausfall) zu lange dauert oder das System überlastet.</p>
        <p><strong>Nicht verarbeitete Tickets:</strong> Überschüssige Tickets werden im nächsten Lauf verarbeitet.</p>
        <p><strong>Empfehlung:</strong> 200–500 für normale Betriebslast.</p>
      </>
    ),
  },
  {
    key: 'assignment.stopOnCriticalError',
    label: 'Stop bei kritischem Fehler',
    type: 'boolean',
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Bestimmt, ob die Engine den gesamten Lauf bei einem kritischen Verarbeitungsfehler sofort abbricht.</p>
        <p><strong>Aktiv:</strong> Beim ersten kritischen Fehler (z. B. DB-Fehler, ungültige Datenstruktur) wird der gesamte Lauf abgebrochen. Bereits getroffene Entscheidungen des Laufs werden verworfen. Sicherer, da keine potenziell inkonsistenten Teilergebnisse entstehen.</p>
        <p><strong>Inaktiv:</strong> Die Engine überspringt fehlerhafte Tickets und verarbeitet die restlichen weiter. Das fehlerhafte Ticket wird als „error" geloggt. Resilienter, aber potenziell inkonsistent.</p>
        <p><strong>Empfehlung:</strong> Im Shadow-Betrieb deaktiviert lassen, um möglichst viele Daten zu sammeln. Im Live-Betrieb aktivieren für maximale Sicherheit.</p>
      </>
    ),
  },
  {
    key: 'assignment.supportedTicketTypes',
    label: 'Unterstützte Tickettypen',
    type: 'text',
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Kommagetrennte Liste der Tickettypen, die die Engine verarbeiten darf.</p>
        <p><strong>Mögliche Werte:</strong> TroubleTicket, SmartHands, CrossConnect, Scheduled, Other</p>
        <p><strong>Auswirkung:</strong> Tickets, deren normalisierter Typ nicht in dieser Liste steht, werden als „not_relevant" eingestuft und nicht zugewiesen. Dies schützt vor ungewollter Zuweisung unbekannter oder neuer Tickettypen.</p>
        <p><strong>Beispiel:</strong> <code>TroubleTicket,SmartHands,CrossConnect</code></p>
        <p><strong>Hinweis:</strong> Groß-/Kleinschreibung wird bei der Prüfung normalisiert. Die Engine hat umfangreiche Alias-Tabellen für Varianten.</p>
      </>
    ),
  },
  {
    key: 'assignment.insufficientResources',
    label: 'Ressourcenmangel-Flag',
    type: 'boolean',
    tooltip: (
      <>
        <p><strong>Bedeutung:</strong> Aktiviert eine Ausnahmeregel für die Sortenreinheit (Queue Purity). Im Normalfall dürfen Cross-Connect-Worker keine Trouble Tickets erhalten und umgekehrt.</p>
        <p><strong>Aktiv:</strong> Wenn ein Cross-Connect-Worker aktive CC-Tickets mit einer Restlaufzeit von mehr als 24 Stunden hat, darf die Engine ihm zusätzlich Trouble Tickets zuweisen. Diese Ausnahme greift nur bei echtem Ressourcenmangel.</p>
        <p><strong>Inaktiv:</strong> Die strikte Sortenreinheit wird durchgesetzt. CC-Worker erhalten ausschließlich CC-Tickets.</p>
        <p><strong>⚠ Fachlicher Hinweis:</strong> Die genaue Definition von „Ressourcenmangel" ist derzeit nicht final spezifiziert. Das Flag wird manuell gesetzt und sollte vor der Aktivierung mit dem Teamlead abgestimmt werden.</p>
      </>
    ),
  },
];

export function AssignmentSettingsPanel() {
  const { settings, settingsSaving, updateSettings, fetchSettings } = useAssignmentStore();
  const [local, setLocal] = useState<Record<string, string>>({});

  const ticketTypeOptions = ['TroubleTicket', 'SmartHands', 'CrossConnect', 'Scheduled', 'Other'];

  const sliderConfig: Partial<Record<SettingDef['key'], { min: number; max: number; step: number }>> = {
    'assignment.crawlerMaxAgeMinutes': { min: 1, max: 30, step: 1 },
    'assignment.planningWindowHours': { min: 1, max: 168, step: 1 },
    'assignment.maxTicketsPerRun': { min: 25, max: 1000, step: 25 },
  };

  useEffect(() => {
    if (settings) {
      setLocal({ ...settings });
    }
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const getBooleanValue = (key: string) => (local[key] || 'false') === 'true';
  const getNumberValue = (key: string, fallback: number) => {
    const parsed = Number(local[key]);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const getTicketTypes = () => {
    return (local['assignment.supportedTicketTypes'] || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  };
  const updateTicketTypes = (ticketType: string, checked: boolean) => {
    const next = new Set(getTicketTypes());
    if (checked) next.add(ticketType);
    else next.delete(ticketType);
    handleChange('assignment.supportedTicketTypes', Array.from(next).join(','));
  };

  const handleSave = async () => {
    await updateSettings(local as Partial<AssignmentSettings>);
  };

  const renderNumberControl = (def: SettingDef) => {
    const config = sliderConfig[def.key];
    const value = getNumberValue(def.key, config?.min || 0);

    if (!config) {
      return (
        <Input
          type="number"
          value={local[def.key] || ''}
          onChange={(e) => handleChange(def.key, e.target.value)}
        />
      );
    }

    return (
      <div className="space-y-3 rounded-xl border border-border/40 bg-background/40 p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Wert</span>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">{value}</span>
        </div>
        <Slider
          value={[value]}
          min={config.min}
          max={config.max}
          step={config.step}
          onValueChange={(values) => handleChange(def.key, String(values[0] ?? config.min))}
        />
        <Input
          type="number"
          min={config.min}
          max={config.max}
          step={config.step}
          value={String(value)}
          onChange={(e) => handleChange(def.key, e.target.value)}
        />
      </div>
    );
  };

  const renderField = (def: SettingDef) => {
    if (def.key === 'assignment.mode') {
      return (
        <div className="grid w-full grid-cols-3 gap-2">
          {['shadow', 'dry-run', 'live'].map((option) => {
            const active = (local[def.key] || 'shadow') === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleChange(def.key, option)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 bg-background/50 text-foreground hover:border-primary/40'
                }`}
              >
                {option === 'dry-run' ? 'Dry-Run' : option === 'live' ? 'Live' : 'Shadow'}
              </button>
            );
          })}
        </div>
      );
    }

    if (def.key === 'assignment.fallbackTieBreaker') {
      return (
        <div className="grid w-full grid-cols-2 gap-2">
          {[
            { value: 'stable-id', label: 'Stable ID' },
            { value: 'random', label: 'Random' },
          ].map((option) => {
            const active = (local[def.key] || 'stable-id') === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleChange(def.key, option.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 bg-background/50 text-foreground hover:border-primary/40'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    }

    if (def.key === 'assignment.supportedTicketTypes') {
      const selected = new Set(getTicketTypes());
      return (
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-border/40 bg-background/40 p-3 sm:grid-cols-2">
          {ticketTypeOptions.map((ticketType) => (
            <label key={ticketType} className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2 text-sm">
              <Checkbox
                checked={selected.has(ticketType)}
                onCheckedChange={(checked) => updateTicketTypes(ticketType, checked === true)}
              />
              <span>{ticketType}</span>
            </label>
          ))}
        </div>
      );
    }

    if (def.type === 'boolean') {
      return (
        <div className="flex items-center justify-between rounded-xl border border-border/40 bg-background/40 px-3 py-2.5">
          <span className="text-sm text-foreground">{getBooleanValue(def.key) ? 'Aktiv' : 'Inaktiv'}</span>
          <Switch
            checked={getBooleanValue(def.key)}
            onCheckedChange={(checked) => handleChange(def.key, checked ? 'true' : 'false')}
          />
        </div>
      );
    }

    if (def.type === 'number') {
      return renderNumberControl(def);
    }

    if (def.type === 'select') {
      return (
        <div className="grid gap-2 rounded-xl border border-border/40 bg-background/40 p-3">
          {def.options?.map((option) => {
            const active = (local[def.key] || '') === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleChange(def.key, option)}
                className={`rounded-lg border px-3 py-2 text-sm text-left transition ${active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/40 bg-background/50 text-foreground hover:border-primary/40'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <Input
        type="text"
        value={local[def.key] || ''}
        onChange={(e) => handleChange(def.key, e.target.value)}
      />
    );
  };

  return (
    <div className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground">Einstellungen</h3>
        <div className="flex items-center gap-2">
          <InfoTooltip title="Neu laden" side="bottom">
            <p>Lädt die aktuell in der Datenbank gespeicherten Einstellungen neu. Lokale, noch nicht gespeicherte Änderungen gehen verloren.</p>
            <p><strong>Typische Nutzung:</strong> Verwenden, wenn ein anderer Benutzer parallel Einstellungen geändert hat oder wenn Sie Ihre lokalen Änderungen verwerfen möchten.</p>
          </InfoTooltip>
          <button
            onClick={() => fetchSettings()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border/40 bg-background/60 hover:bg-background/80 transition text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3 h-3" />
            Neu laden
          </button>
          <InfoTooltip title="Speichern" side="bottom">
            <p>Übernimmt die angezeigten Einstellungen dauerhaft in die Datenbank. Änderungen werden sofort wirksam und gelten für den nächsten Engine-Lauf.</p>
            <p><strong>Hinweis:</strong> Bereits laufende Zuweisungsprozesse werden durch das Speichern nicht beeinflusst. Die neuen Werte greifen erst beim nächsten Lauf.</p>
            <p><strong>Auswirkung:</strong> Die Änderung wird im Audit-Log protokolliert.</p>
          </InfoTooltip>
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
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {def.label}
              <InfoTooltip title={def.label} side="right" align="start">{def.tooltip}</InfoTooltip>
            </label>
            {renderField(def)}
          </div>
        ))}
      </div>
    </div>
  );
}
