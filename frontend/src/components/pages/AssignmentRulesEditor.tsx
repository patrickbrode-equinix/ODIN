/* ------------------------------------------------ */
/* ASSIGNMENT RULES EDITOR                          */
/* Configurable ODIN logic tree / decision rules    */
/* ------------------------------------------------ */

import { useCallback, useEffect, useState, type ElementType } from "react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";
import {
  fetchAssignmentRules, fetchAssignmentRule, updateAssignmentRule, toggleAssignmentRule, rollbackAssignmentRule,
  type AssignmentRule, type AssignmentRuleHistory
} from "../../api/assignmentRules";
import {
  Brain, ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
  Save, Loader2, History, RotateCcw, Shield, Zap, BarChart3, AlertTriangle,
  ArrowUp, ArrowDown, SlidersHorizontal, Wrench
} from "lucide-react";
import { Switch } from "../ui/switch";
import { Slider } from "../ui/slider";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

const CATEGORY_META: Record<string, { label: string; icon: ElementType; color: string }> = {
  priority: { label: "Prioritäten", icon: Zap, color: "text-orange-600" },
  role: { label: "Rollenregeln", icon: Shield, color: "text-blue-600" },
  load: { label: "Lastverteilung", icon: BarChart3, color: "text-green-600" },
  exception: { label: "Ausnahmen", icon: AlertTriangle, color: "text-red-600" },
};

const ROLE_OPTIONS = [
  { value: "large_order", label: "Large Order" },
  { value: "project", label: "Project" },
  { value: "leads", label: "Leads" },
  { value: "dispatcher", label: "Dispatcher" },
  { value: "deutsche_boerse", label: "Deutsche Börse" },
  { value: "cross_connect", label: "Cross Connect" },
  { value: "support", label: "Support" },
];

const TICKET_TYPE_OPTIONS = ["TroubleTicket", "SmartHands", "CrossConnect", "Scheduled", "Other"];

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export default function AssignmentRulesEditor({ embedded = false }: { embedded?: boolean }) {
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<AssignmentRuleHistory[]>([]);
  const [editingConfig, setEditingConfig] = useState<Record<string, unknown>>({});
  const [editingJson, setEditingJson] = useState<string>("");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvancedByRule, setShowAdvancedByRule] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await fetchAssignmentRules());
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyConfigUpdate = useCallback((updater: (current: Record<string, unknown>) => Record<string, unknown>) => {
    const next = updater(editingConfig);
    setEditingConfig(next);
    setEditingJson(JSON.stringify(next, null, 2));
  }, [editingConfig]);

  const expandRule = async (ruleKey: string) => {
    if (expanded === ruleKey) {
      setExpanded(null);
      return;
    }

    setExpanded(ruleKey);
    try {
      const data = await fetchAssignmentRule(ruleKey);
      const config = asObject(data.rule.config_json);
      setHistory(data.history);
      setEditingConfig(config);
      setEditingJson(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(error);
    }

    setChangeNote("");
    setShowHistory(false);
  };

  const toggle = async (ruleKey: string) => {
    try {
      const updated = await toggleAssignmentRule(ruleKey);
      setRules((prev) => prev.map((rule) => rule.rule_key === ruleKey ? updated : rule));
    } catch (error) {
      console.error(error);
    }
  };

  const saveRule = async (ruleKey: string) => {
    setSaving(true);
    try {
      let config: Record<string, unknown>;
      try {
        config = asObject(JSON.parse(editingJson));
      } catch {
        alert("Ungültiges JSON in der erweiterten Konfiguration.");
        setSaving(false);
        return;
      }

      const updated = await updateAssignmentRule(ruleKey, { config_json: config, change_note: changeNote || undefined });
      setRules((prev) => prev.map((rule) => rule.rule_key === ruleKey ? updated : rule));

      const data = await fetchAssignmentRule(ruleKey);
      const refreshedConfig = asObject(data.rule.config_json);
      setHistory(data.history);
      setEditingConfig(refreshedConfig);
      setEditingJson(JSON.stringify(refreshedConfig, null, 2));
      setChangeNote("");
    } catch (error) {
      console.error(error);
    }
    setSaving(false);
  };

  const rollback = async (ruleKey: string, version: number) => {
    if (!confirm(`Rollback auf Version ${version}?`)) return;
    try {
      const updated = await rollbackAssignmentRule(ruleKey, version);
      setRules((prev) => prev.map((rule) => rule.rule_key === ruleKey ? updated : rule));
      const config = asObject(updated.config_json);
      setEditingConfig(config);
      setEditingJson(JSON.stringify(config, null, 2));
      const data = await fetchAssignmentRule(ruleKey);
      setHistory(data.history);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleArrayValue = (key: string, value: string, checked: boolean) => {
    applyConfigUpdate((current) => {
      const nextValues = new Set(asArray(current[key]));
      if (checked) nextValues.add(value);
      else nextValues.delete(value);
      return { ...current, [key]: Array.from(nextValues) };
    });
  };

  const renderPriorityEditor = () => {
    const tiers = Array.isArray(editingConfig.tiers) ? [...editingConfig.tiers] : [];

    if (tiers.length === 0) {
      return <div className="text-sm text-gray-500">Keine Prioritätsstufen definiert.</div>;
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <SlidersHorizontal className="h-4 w-4" />
          Reihenfolge per Buttons anpassen
        </div>
        {tiers.map((tier, index) => {
          const tierConfig = asObject(tier);
          const types = asArray(tierConfig.types);
          const priorities = asArray(tierConfig.priorities);
          return (
            <div key={`${tierConfig.label || tierConfig.tier || index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{String(tierConfig.label || `Tier ${index + 1}`)}</div>
                  <div className="mt-1 text-xs text-gray-500">Typen: {types.join(", ") || "—"}</div>
                  <div className="text-xs text-gray-500">Prioritäten: {priorities.join(", ") || "alle"}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => applyConfigUpdate((current) => {
                      const nextTiers = moveItem(Array.isArray(current.tiers) ? current.tiers : [], index, index - 1)
                        .map((entry, nextIndex) => ({ ...asObject(entry), tier: nextIndex + 1 }));
                      return { ...current, tiers: nextTiers };
                    })}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-white disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === tiers.length - 1}
                    onClick={() => applyConfigUpdate((current) => {
                      const nextTiers = moveItem(Array.isArray(current.tiers) ? current.tiers : [], index, index + 1)
                        .map((entry, nextIndex) => ({ ...asObject(entry), tier: nextIndex + 1 }));
                      return { ...current, tiers: nextTiers };
                    })}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-white disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderConfigEditor = (rule: AssignmentRule) => {
    const config = editingConfig;

    switch (rule.rule_key) {
      case "priority_tiers":
        return renderPriorityEditor();

      case "excluded_roles":
        return (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {ROLE_OPTIONS.map((role) => (
              <label key={role.value} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800/40">
                <Checkbox
                  checked={asArray(config.roles).includes(role.value)}
                  onCheckedChange={(checked) => toggleArrayValue("roles", role.value, checked === true)}
                />
                <span>{role.label}</span>
              </label>
            ))}
          </div>
        );

      case "dispatcher_rule":
        return (
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
            <div>
              <div className="text-sm font-medium">Nur OtherTeams-Handovers</div>
              <div className="text-xs text-gray-500">Dispatcher bleibt exklusiv für Eskalationen und Fremdteam-Übergaben reserviert.</div>
            </div>
            <Switch
              checked={asBoolean(config.only_other_teams_handovers, true)}
              onCheckedChange={(checked) => applyConfigUpdate((current) => ({ ...current, only_other_teams_handovers: checked }))}
            />
          </div>
        );

      case "deutsche_boerse":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
              <div>
                <div className="text-sm font-medium">Trouble Tickets erlauben</div>
                <div className="text-xs text-gray-500">DB-Mitarbeiter dürfen Trouble Tickets übernehmen.</div>
              </div>
              <Switch
                checked={asBoolean(config.allow_tt, true)}
                onCheckedChange={(checked) => applyConfigUpdate((current) => ({ ...current, allow_tt: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
              <div>
                <div className="text-sm font-medium">Cross Connect nur bei mehr als 24h Restzeit</div>
                <div className="text-xs text-gray-500">Schützt zeitkritische CC-Aufträge vor DB-Zuweisungen mit kurzer Restlaufzeit.</div>
              </div>
              <Switch
                checked={asBoolean(config.allow_cc_if_remaining_gt_24h, true)}
                onCheckedChange={(checked) => applyConfigUpdate((current) => ({ ...current, allow_cc_if_remaining_gt_24h: checked }))}
              />
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
              <div className="mb-2 text-sm font-medium">Explizit blockierte Tickettypen</div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {TICKET_TYPE_OPTIONS.map((ticketType) => (
                  <label key={ticketType} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={asArray(config.deny).includes(ticketType)}
                      onCheckedChange={(checked) => toggleArrayValue("deny", ticketType, checked === true)}
                    />
                    <span>{ticketType}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case "cross_connect_only":
        return (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
            <div className="mb-2 text-sm font-medium">Erlaubte Tickettypen für die CC-Rolle</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {TICKET_TYPE_OPTIONS.map((ticketType) => (
                <label key={ticketType} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={asArray(config.allow).includes(ticketType)}
                    onCheckedChange={(checked) => toggleArrayValue("allow", ticketType, checked === true)}
                  />
                  <span>{ticketType}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case "max_sh_per_system": {
        const value = asNumber(config.max, 3);
        return (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
            <div className="mb-3 flex items-center justify-between text-sm font-medium">
              <span>Maximale SH-Tickets pro Worker und System</span>
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-300">{value}</span>
            </div>
            <Slider value={[value]} min={1} max={10} step={1} onValueChange={(values) => applyConfigUpdate((current) => ({ ...current, max: values[0] ?? 3 }))} />
          </div>
        );
      }

      case "similar_time_threshold": {
        const value = asNumber(config.threshold_hours, 6);
        return (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
            <div className="mb-3 flex items-center justify-between text-sm font-medium">
              <span>Maximale Restzeit-Differenz für CC-Systemgruppierung</span>
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-300">{value}h</span>
            </div>
            <Slider value={[value]} min={1} max={24} step={1} onValueChange={(values) => applyConfigUpdate((current) => ({ ...current, threshold_hours: values[0] ?? 6 }))} />
          </div>
        );
      }

      case "load_balancing": {
        const value = String(config.mode || "least_workload");
        return (
          <div className="grid gap-2">
            {[
              { value: "least_workload", label: "Wenigste Tickets zuerst", description: "Bevorzugt Mitarbeiter mit der geringsten aktiven Last." },
              { value: "stable_order", label: "Stabile Reihenfolge", description: "Belässt die Lastverteilung konstant und priorisiert deterministische Auswahl." },
            ].map((option) => {
              const active = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => applyConfigUpdate((current) => ({ ...current, mode: option.value }))}
                  className={`rounded-xl border px-4 py-3 text-left transition ${active
                    ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "border-gray-200 bg-gray-50 hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800/40"
                  }`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </button>
              );
            })}
          </div>
        );
      }

      case "max_tickets_per_worker": {
        const value = asNumber(config.max, 0);
        return (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
            <div className="mb-3 flex items-center justify-between text-sm font-medium">
              <span>Gesamtlimit aktiver Tickets pro Worker</span>
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-300">{value === 0 ? "Kein Limit" : value}</span>
            </div>
            <Slider value={[value]} min={0} max={20} step={1} onValueChange={(values) => applyConfigUpdate((current) => ({ ...current, max: values[0] ?? 0 }))} />
          </div>
        );
      }

      case "expedite_priority":
        return (
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
            <div>
              <div className="text-sm font-medium">Expedite bevorzugen</div>
              <div className="text-xs text-gray-500">Expedite-Tickets werden innerhalb gleicher Priorität vorgezogen.</div>
            </div>
            <Switch
              checked={asBoolean(config.enabled, false)}
              onCheckedChange={(checked) => applyConfigUpdate((current) => ({ ...current, enabled: checked }))}
            />
          </div>
        );

      default:
        return (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-300">
            Für diese Regel ist noch kein visueller Editor hinterlegt. Nutze bei Bedarf den erweiterten JSON-Modus unten.
          </div>
        );
    }
  };

  if (loading) {
    const loadingContent = (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );

    if (embedded) return loadingContent;

    return (
      <EnterprisePageShell>
        <EnterpriseHeader title="ODIN-Logik Konfiguration" subtitle="Assignment Rules & Prioritäten" />
        {loadingContent}
      </EnterprisePageShell>
    );
  }

  const grouped = rules.reduce<Record<string, AssignmentRule[]>>((acc, rule) => {
    (acc[rule.category] ||= []).push(rule);
    return acc;
  }, {});

  const content = (
    <>
      {Object.entries(grouped).map(([category, categoryRules]) => {
        const meta = CATEGORY_META[category] || { label: category, icon: Brain, color: "text-gray-600" };
        return (
          <div key={category} className="mb-6">
            <h2 className={`mb-3 flex items-center gap-2 text-lg font-semibold ${meta.color}`}>
              <meta.icon className="h-5 w-5" />
              {meta.label}
            </h2>

            <div className="space-y-2">
              {categoryRules.sort((left, right) => left.sort_order - right.sort_order).map((rule) => {
                const showAdvanced = !!showAdvancedByRule[rule.rule_key];
                return (
                  <EnterpriseCard key={rule.rule_key}>
                    <div className="flex items-center justify-between gap-4">
                      <button onClick={() => expandRule(rule.rule_key)} className="flex flex-1 items-center gap-2 text-left">
                        {expanded === rule.rule_key
                          ? <ChevronDown className="h-4 w-4 text-gray-400" />
                          : <ChevronRight className="h-4 w-4 text-gray-400" />}
                        <div>
                          <div className="text-sm font-medium">{rule.label}</div>
                          <div className="text-xs text-gray-400">{rule.description}</div>
                        </div>
                      </button>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">v{rule.version}</span>
                        <button onClick={() => toggle(rule.rule_key)} className="focus:outline-none">
                          {rule.enabled
                            ? <ToggleRight className="h-6 w-6 text-green-500" />
                            : <ToggleLeft className="h-6 w-6 text-gray-400" />}
                        </button>
                      </div>
                    </div>

                    {expanded === rule.rule_key && (
                      <div className="mt-4 space-y-4 border-t pt-4 dark:border-gray-700">
                        {renderConfigEditor(rule)}

                        <div>
                          <label className="mb-1 block text-xs text-gray-500">Änderungsnotiz (optional)</label>
                          <Input
                            value={changeNote}
                            onChange={(event) => setChangeNote(event.target.value)}
                            placeholder="Was wurde geändert und warum?"
                          />
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/30">
                          <button
                            type="button"
                            onClick={() => setShowAdvancedByRule((prev) => ({ ...prev, [rule.rule_key]: !prev[rule.rule_key] }))}
                            className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200"
                          >
                            <Wrench className="h-4 w-4" />
                            {showAdvanced ? "Erweiterten JSON-Modus ausblenden" : "Erweiterten JSON-Modus anzeigen"}
                          </button>
                          {showAdvanced && (
                            <div className="mt-3 space-y-2">
                              <div className="text-xs text-gray-500">Nur für Sonderfälle oder neue Regelstrukturen. Änderungen hier überschreiben die visuellen Controls.</div>
                              <Textarea value={editingJson} onChange={(event) => setEditingJson(event.target.value)} className="min-h-45 font-mono text-xs" />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => saveRule(rule.rule_key)} disabled={saving} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Speichern
                          </button>
                          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 rounded bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600">
                            <History className="h-4 w-4" />
                            Verlauf ({history.length})
                          </button>
                        </div>

                        <div className="text-xs text-gray-400">
                          Version {rule.version} · Zuletzt geändert von {rule.updated_by || "System"} am {new Date(rule.updated_at).toLocaleString("de-DE")}
                        </div>

                        {showHistory && history.length > 0 && (
                          <div className="mt-3 space-y-2 border-t pt-3 dark:border-gray-700">
                            <h4 className="text-xs font-semibold text-gray-500">Änderungshistorie</h4>
                            {history.map((entry) => (
                              <div key={entry.id} className="flex items-start justify-between rounded bg-gray-50 p-2 text-xs dark:bg-gray-800/50">
                                <div className="space-y-1">
                                  <div className="font-medium">v{entry.version} – {entry.changed_by || "System"}</div>
                                  <div className="text-gray-400">{new Date(entry.created_at).toLocaleString("de-DE")}</div>
                                  {entry.change_note && <div className="italic text-gray-500">{entry.change_note}</div>}
                                </div>
                                <button
                                  onClick={() => rollback(rule.rule_key, entry.version)}
                                  className="flex items-center gap-1 rounded px-2 py-1 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/20"
                                >
                                  <RotateCcw className="h-3 w-3" /> Rollback
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </EnterpriseCard>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );

  if (embedded) return content;

  return (
    <EnterprisePageShell>
      <EnterpriseHeader title="ODIN-Logik Konfiguration" subtitle="Assignment Rules, Prioritäten & Hierarchien" />
      {content}
    </EnterprisePageShell>
  );
}