/* ================================================ */
/* ODIN-Logik — Main Page                           */
/* ================================================ */

import { useEffect, useState } from 'react';
import { useAssignmentStore } from '../../store/assignmentStore';
import { AssignmentStatusCards } from '../assignment/AssignmentStatusCards';
import { AssignmentSettingsPanel } from '../assignment/AssignmentSettingsPanel';
import { AssignmentRunTable } from '../assignment/AssignmentRunTable';
import { AssignmentDecisionTable } from '../assignment/AssignmentDecisionTable';
import { AssignmentDecisionDrawer } from '../assignment/AssignmentDecisionDrawer';
import { AssignmentFilters } from '../assignment/AssignmentFilters';
import { Play, RotateCcw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

type TabKey = 'runs' | 'decisions' | 'settings';

export default function OdinLogicPage() {
  const {
    health,
    runs,
    decisions,
    selectedRun,
    filters,
    loading,
    error,
    executing,
    fetchHealth,
    fetchSettings,
    fetchRuns,
    fetchDecisions,
    executeRun,
    clearError,
  } = useAssignmentStore();

  const [tab, setTab] = useState<TabKey>('runs');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Initial data load
  useEffect(() => {
    fetchHealth();
    fetchSettings();
    fetchRuns();
  }, []);

  // Reload runs when filters change
  useEffect(() => {
    fetchRuns();
  }, [filters.runMode, filters.runStatus]);

  // Load decisions when a run is selected or filter changes
  useEffect(() => {
    if (selectedRun) {
      fetchDecisions({ runId: selectedRun.id });
    }
  }, [selectedRun, filters.decisionResult]);

  const lastRun = runs.length > 0 ? runs[0] : null;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'runs', label: 'Runs & Logs' },
    { key: 'decisions', label: selectedRun ? `Entscheidungen (Run #${selectedRun.id})` : 'Entscheidungen' },
    { key: 'settings', label: 'Einstellungen' },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">ODIN-Logik</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assignment Engine — Phase 1 (Shadow Mode)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => executeRun('dry-run')}
            disabled={executing}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border/40 bg-background/60 hover:bg-background/80 transition text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Dry-Run
          </button>
          <button
            onClick={() => executeRun('shadow')}
            disabled={executing}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {executing ? 'Läuft...' : 'Shadow-Run starten'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={clearError} className="text-xs underline hover:text-red-300">Schließen</button>
        </div>
      )}

      {/* Status Cards */}
      <AssignmentStatusCards health={health} lastRun={lastRun} />

      {/* Collapsible Settings */}
      <div className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        <button
          onClick={() => setSettingsOpen(v => !v)}
          className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-accent/20 transition"
        >
          <span>Engine Einstellungen</span>
          {settingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {settingsOpen && <AssignmentSettingsPanel />}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/30 gap-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <AssignmentFilters />

      {/* Tab Content */}
      <div className="rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && tab === 'runs' && <AssignmentRunTable runs={runs} />}

        {!loading && tab === 'decisions' && <AssignmentDecisionTable decisions={decisions} />}

        {!loading && tab === 'settings' && <AssignmentSettingsPanel />}
      </div>

      {/* Decision Drawer */}
      <AssignmentDecisionDrawer />
    </div>
  );
}
