/* ------------------------------------------------ */
/* ASSIGNMENT RULES EDITOR                          */
/* Configurable ODIN logic tree / decision rules    */
/* ------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader } from "../layout/EnterpriseLayout";
import {
  fetchAssignmentRules, fetchAssignmentRule, updateAssignmentRule, toggleAssignmentRule, rollbackAssignmentRule,
  type AssignmentRule, type AssignmentRuleHistory
} from "../../api/assignmentRules";
import {
  Brain, ChevronDown, ChevronRight, ToggleLeft, ToggleRight,
  Save, Loader2, History, RotateCcw, Shield, Zap, BarChart3, AlertTriangle
} from "lucide-react";

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  priority:  { label: "Prioritäten",  icon: Zap,              color: "text-orange-600" },
  role:      { label: "Rollenregeln", icon: Shield,           color: "text-blue-600" },
  load:      { label: "Lastverteilung", icon: BarChart3,      color: "text-green-600" },
  exception: { label: "Ausnahmen",    icon: AlertTriangle,    color: "text-red-600" },
};

export default function AssignmentRulesEditor({ embedded = false }: { embedded?: boolean }) {
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<AssignmentRuleHistory[]>([]);
  const [editingConfig, setEditingConfig] = useState<string>("");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRules(await fetchAssignmentRules()); } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const expandRule = async (ruleKey: string) => {
    if (expanded === ruleKey) {
      setExpanded(null);
      return;
    }
    setExpanded(ruleKey);
    try {
      const data = await fetchAssignmentRule(ruleKey);
      setHistory(data.history);
      setEditingConfig(JSON.stringify(data.rule.config_json, null, 2));
    } catch (err) { console.error(err); }
    setChangeNote("");
    setShowHistory(false);
  };

  const toggle = async (ruleKey: string) => {
    try {
      const updated = await toggleAssignmentRule(ruleKey);
      setRules(prev => prev.map(r => r.rule_key === ruleKey ? updated : r));
    } catch (err) { console.error(err); }
  };

  const saveRule = async (ruleKey: string) => {
    setSaving(true);
    try {
      let config: Record<string, unknown>;
      try {
        config = JSON.parse(editingConfig);
      } catch {
        alert("Ungültiges JSON in der Konfiguration.");
        setSaving(false);
        return;
      }
      const updated = await updateAssignmentRule(ruleKey, { config_json: config, change_note: changeNote || undefined });
      setRules(prev => prev.map(r => r.rule_key === ruleKey ? updated : r));
      // Refresh history
      const data = await fetchAssignmentRule(ruleKey);
      setHistory(data.history);
      setChangeNote("");
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const rollback = async (ruleKey: string, version: number) => {
    if (!confirm(`Rollback auf Version ${version}?`)) return;
    try {
      const updated = await rollbackAssignmentRule(ruleKey, version);
      setRules(prev => prev.map(r => r.rule_key === ruleKey ? updated : r));
      setEditingConfig(JSON.stringify(updated.config_json, null, 2));
      const data = await fetchAssignmentRule(ruleKey);
      setHistory(data.history);
    } catch (err) { console.error(err); }
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

  // Group by category
  const grouped = rules.reduce<Record<string, AssignmentRule[]>>((acc, r) => {
    (acc[r.category] ||= []).push(r);
    return acc;
  }, {});

  const content = (
    <>
      {Object.entries(grouped).map(([cat, catRules]) => {
        const meta = CATEGORY_META[cat] || { label: cat, icon: Brain, color: "text-gray-600" };
        return (
          <div key={cat} className="mb-6">
            <h2 className={`flex items-center gap-2 text-lg font-semibold mb-3 ${meta.color}`}>
              <meta.icon className="w-5 h-5" />
              {meta.label}
            </h2>

            <div className="space-y-2">
              {catRules.sort((a, b) => a.sort_order - b.sort_order).map(rule => (
                <EnterpriseCard key={rule.rule_key}>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <button onClick={() => expandRule(rule.rule_key)} className="flex items-center gap-2 text-left flex-1">
                      {expanded === rule.rule_key
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      <div>
                        <div className="text-sm font-medium">{rule.label}</div>
                        <div className="text-xs text-gray-400">{rule.description}</div>
                      </div>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">v{rule.version}</span>
                      <button onClick={() => toggle(rule.rule_key)} className="focus:outline-none">
                        {rule.enabled
                          ? <ToggleRight className="w-6 h-6 text-green-500" />
                          : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expanded === rule.rule_key && (
                    <div className="mt-4 space-y-3 border-t pt-4 dark:border-gray-700">
                      {/* Config Editor */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Konfiguration (JSON)</label>
                        <textarea
                          value={editingConfig}
                          onChange={e => setEditingConfig(e.target.value)}
                          className="w-full border dark:border-gray-600 rounded p-3 text-xs font-mono bg-gray-50 dark:bg-gray-800"
                          style={{ minHeight: 120 }}
                          rows={8}
                        />
                      </div>

                      {/* Change Note */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Änderungsnotiz (optional)</label>
                        <input
                          value={changeNote}
                          onChange={e => setChangeNote(e.target.value)}
                          placeholder="Was wurde geändert und warum?"
                          className="w-full border dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-800"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button onClick={() => saveRule(rule.rule_key)} disabled={saving} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Speichern
                        </button>
                        <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                          <History className="w-4 h-4" />
                          Verlauf ({history.length})
                        </button>
                      </div>

                      {/* Version info */}
                      <div className="text-xs text-gray-400">
                        Version {rule.version} · Zuletzt geändert von {rule.updated_by || "System"} am {new Date(rule.updated_at).toLocaleString("de-DE")}
                      </div>

                      {/* History */}
                      {showHistory && history.length > 0 && (
                        <div className="space-y-2 mt-3 border-t pt-3 dark:border-gray-700">
                          <h4 className="text-xs font-semibold text-gray-500">Änderungshistorie</h4>
                          {history.map(h => (
                            <div key={h.id} className="flex items-start justify-between p-2 rounded bg-gray-50 dark:bg-gray-800/50 text-xs">
                              <div className="space-y-1">
                                <div className="font-medium">v{h.version} – {h.changed_by || "System"}</div>
                                <div className="text-gray-400">{new Date(h.created_at).toLocaleString("de-DE")}</div>
                                {h.change_note && <div className="text-gray-500 italic">{h.change_note}</div>}
                              </div>
                              <button
                                onClick={() => rollback(rule.rule_key, h.version)}
                                className="flex items-center gap-1 px-2 py-1 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded"
                              >
                                <RotateCcw className="w-3 h-3" /> Rollback
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </EnterpriseCard>
              ))}
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
