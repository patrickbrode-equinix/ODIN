/* ================================================ */
/* ODIN-Logik — Main Page                           */
/* ================================================ */

import { useEffect, useState, lazy, Suspense } from 'react';
import { useAssignmentStore } from '../../store/assignmentStore';
import { AssignmentStatusCards } from '../assignment/AssignmentStatusCards';
import { AssignmentSettingsPanel } from '../assignment/AssignmentSettingsPanel';
import { AssignmentRunTable } from '../assignment/AssignmentRunTable';
import { AssignmentDecisionTable } from '../assignment/AssignmentDecisionTable';
import { AssignmentDecisionDrawer } from '../assignment/AssignmentDecisionDrawer';
import { AssignmentFilters } from '../assignment/AssignmentFilters';
import { InfoTooltip } from '../ui/InfoTooltip';
import { Play, RotateCcw, ChevronDown, ChevronUp, AlertCircle, Power, PowerOff, Shield, StopCircle, Zap, Clock, Brain } from 'lucide-react';
import { EnterprisePageShell, EnterpriseHeader, EnterpriseCard } from '../layout/EnterpriseLayout';

const OdinExclusions = lazy(() => import('../odinlogic/OdinExclusions'));
const OdinLogicTree = lazy(() => import('../odinlogic/OdinLogicTree'));
const AssignmentVisualizer = lazy(() => import('../odinlogic/AssignmentVisualizer'));
const EmployeeExclusions = lazy(() => import('../odinlogic/EmployeeExclusions'));

type TabKey = 'runs' | 'decisions' | 'settings' | 'exclusions' | 'employeeExclusions' | 'logicTree' | 'visualizer';

/* ---- Safety Confirmation Dialog ---- */
function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  const variantColors = {
    danger: { bg: 'bg-red-500/10 border-red-500/30', btn: 'bg-red-600 hover:bg-red-500', icon: 'text-red-400' },
    warning: { bg: 'bg-amber-500/10 border-amber-500/30', btn: 'bg-amber-600 hover:bg-amber-500', icon: 'text-amber-400' },
    info: { bg: 'bg-blue-500/10 border-blue-500/30', btn: 'bg-blue-600 hover:bg-blue-500', icon: 'text-blue-400' },
  };
  const v = variantColors[variant];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`max-w-md w-full mx-4 rounded-xl border ${v.bg} p-6 shadow-2xl`}>
        <div className="flex items-start gap-3 mb-4">
          <Shield className={`w-6 h-6 ${v.icon} shrink-0 mt-0.5`} />
          <div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border border-border/40 bg-background/60 hover:bg-background/80 text-muted-foreground hover:text-foreground transition">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm rounded-md text-white transition ${v.btn}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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
    startEngine,
    stopEngine,
    clearError,
  } = useAssignmentStore();

  const [tab, setTab] = useState<TabKey>('runs');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'info';
    action: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: '', variant: 'info', action: () => {} });

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
  const engineEnabled = health?.enabled === true;
  const engineMode = health?.mode || 'shadow';

  /* ---- Engine Control Handlers ---- */
  const handleStartEngine = (mode: 'shadow' | 'live') => {
    if (mode === 'live') {
      setConfirmDialog({
        open: true,
        title: 'Produktive automatische Zuweisung aktivieren',
        message: 'Du bist dabei, die produktive automatische Zuweisung zu aktivieren. Tickets werden gemäß der aktuellen Konfiguration tatsächlich Mitarbeitern zugewiesen. Bitte bestätige, dass dies beabsichtigt ist.',
        confirmLabel: 'Ja, Live-Automatik aktivieren',
        variant: 'danger',
        action: () => { startEngine('live'); setConfirmDialog(d => ({ ...d, open: false })); },
      });
    } else {
      setConfirmDialog({
        open: true,
        title: 'Automatische Zuweisung starten (Shadow)',
        message: 'Möchtest du die automatische Zuweisungslogik im Shadow-Modus starten? Die Engine wird aktiviert und Zuweisungen simuliert, aber keine echten Ticketzuweisungen vorgenommen.',
        confirmLabel: 'Ja, Shadow-Automatik starten',
        variant: 'warning',
        action: () => { startEngine('shadow'); setConfirmDialog(d => ({ ...d, open: false })); },
      });
    }
  };

  const handleStopEngine = () => {
    setConfirmDialog({
      open: true,
      title: 'Automatische Zuweisung stoppen',
      message: 'Möchtest du die automatische Zuweisungslogik stoppen? Keine weiteren automatischen Zuweisungen werden ausgeführt, bis die Logik erneut gestartet wird.',
      confirmLabel: 'Ja, Automatik stoppen',
      variant: 'info',
      action: () => { stopEngine(); setConfirmDialog(d => ({ ...d, open: false })); },
    });
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'runs', label: 'Runs & Logs' },
    { key: 'decisions', label: selectedRun ? `Entscheidungen (Run #${selectedRun.id})` : 'Entscheidungen' },
    { key: 'logicTree', label: 'Logikbaum' },
    { key: 'visualizer', label: 'Zuweisungsfluss' },
    { key: 'exclusions', label: 'Manuelle Zuweisung' },
    { key: 'employeeExclusions', label: 'Dauerhafte Ausschlüsse' },
    { key: 'settings', label: 'Einstellungen' },
  ];

  return (
    <EnterprisePageShell style={{ maxWidth: 'none' }}>
      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel="Abbrechen"
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />

      {/* Page Header */}
      <EnterpriseHeader
        icon={<Brain className="w-6 h-6 text-blue-400" />}
        title="ODIN-Logik"
        subtitle="Assignment Engine – Automatische Ticketzuweisung"
        rightContent={
          <div className="flex items-center gap-2">
            <InfoTooltip title="Dry-Run" side="bottom">
              <p><strong>Einmaliger Testlauf</strong> — die Engine verarbeitet alle aktuellen Tickets und protokolliert Entscheidungen, aber nimmt <em>keine</em> Änderungen vor.</p>
              <p>Ideal zum Testen nach Regeländerungen.</p>
            </InfoTooltip>
            <button
              onClick={() => executeRun('dry-run')}
              disabled={executing}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border/40 bg-background/60 hover:bg-background/80 transition text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Dry-Run
            </button>
            <InfoTooltip title="Shadow-Run" side="bottom">
              <p><strong>Einmaliger Simulationslauf</strong> — die Engine führt den kompletten Zuweisungsprozess durch, speichert alle Entscheidungen, aber ändert <em>keine</em> Ticketzuweisungen.</p>
            </InfoTooltip>
            <button
              onClick={() => executeRun('shadow')}
              disabled={executing}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {executing ? 'Läuft...' : 'Shadow-Run starten'}
            </button>
          </div>
        }
      />

      {/* ============================================================= */}
      {/* ENGINE CONTROL PANEL — Start/Stop + Status                     */}
      {/* ============================================================= */}
      <div className={`rounded-xl border p-4 backdrop-blur-sm ${
        engineEnabled
          ? engineMode === 'live'
            ? 'border-green-500/40 bg-green-500/5'
            : 'border-amber-500/40 bg-amber-500/5'
          : 'border-border/40 bg-card/60'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left: Status */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${
              engineEnabled
                ? engineMode === 'live'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-amber-500/20 text-amber-400'
                : 'bg-zinc-500/20 text-zinc-400'
            }`}>
              {engineEnabled ? <Zap className="w-6 h-6" /> : <PowerOff className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  Automatische Zuweisung
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  !engineEnabled ? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' :
                  engineMode === 'live' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  engineMode === 'shadow' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  {!engineEnabled ? 'Deaktiviert' : engineMode === 'live' ? 'Live aktiv' : engineMode === 'shadow' ? 'Shadow aktiv' : 'Dry-Run'}
                </span>
                <InfoTooltip title="Automatische Zuweisung" side="right" width="w-96">
                  <p><strong>Bedeutung:</strong> Steuert, ob die ODIN-Engine automatisch und dauerhaft Tickets zuweist.</p>
                  <p><strong>Deaktiviert:</strong> Keine automatischen Zuweisungen. Manuelle Dry-Runs und Shadow-Runs sind weiterhin möglich.</p>
                  <p><strong>Shadow aktiv:</strong> Die Engine läuft automatisch, simuliert Zuweisungen und protokolliert alle Entscheidungen — aber ändert keine echten Tickets.</p>
                  <p><strong>Live aktiv:</strong> Die Engine weist Tickets produktiv zu. Änderungen wirken sich direkt auf die Mitarbeiter-Zuweisungen aus.</p>
                  <p><strong>Unterschied zu Testläufen:</strong> Die Buttons „Dry-Run" und „Shadow-Run starten" oben rechts führen jeweils einen <em>einzelnen manuellen</em> Lauf aus. Die Steuerung hier aktiviert die <em>dauerhafte automatische</em> Logik.</p>
                </InfoTooltip>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {health?.lastStartedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Zuletzt gestartet: {new Date(health.lastStartedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {health.lastStartedBy && <span> von {health.lastStartedBy}</span>}
                  </span>
                )}
                {!engineEnabled && health?.lastStoppedAt && (
                  <span className="flex items-center gap-1">
                    Gestoppt: {new Date(health.lastStoppedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {health.lastStoppedBy && <span> von {health.lastStoppedBy}</span>}
                  </span>
                )}
                <span>Modus: <strong>{engineMode}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {!engineEnabled ? (
              <>
                <InfoTooltip title="Shadow-Automatik" side="bottom">
                  <p>Startet die automatische Engine im <strong>Shadow-Modus</strong>. Zuweisungen werden simuliert und protokolliert, aber nicht produktiv umgesetzt.</p>
                  <p><strong>Empfehlung:</strong> Diesen Modus verwenden, um die Logik über einen längeren Zeitraum zu validieren, bevor Live geschaltet wird.</p>
                </InfoTooltip>
                <button
                  onClick={() => handleStartEngine('shadow')}
                  disabled={executing}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50"
                >
                  <Power className="w-3.5 h-3.5" />
                  Shadow-Automatik starten
                </button>
                <InfoTooltip title="Live-Automatik" side="bottom">
                  <p>Startet die produktive automatische Zuweisung. <strong>Tickets werden tatsächlich zugewiesen.</strong></p>
                  <p><strong>Voraussetzung:</strong> Die Einstellung „enableLiveMode" muss in den Engine-Einstellungen aktiviert sein.</p>
                  <p><strong>⚠ Warnung:</strong> Nur verwenden, wenn die Logik im Shadow-Modus ausreichend validiert wurde.</p>
                </InfoTooltip>
                <button
                  onClick={() => handleStartEngine('live')}
                  disabled={executing}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 text-white transition disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Live-Automatik starten
                </button>
              </>
            ) : (
              <>
                <InfoTooltip title="Automatik stoppen" side="bottom">
                  <p>Stoppt die automatische Zuweisungslogik. Keine weiteren automatischen Runs werden ausgeführt.</p>
                  <p>Manuelle Dry-Runs und Shadow-Runs sind weiterhin jederzeit möglich.</p>
                  <p><strong>Auswirkung:</strong> Bereits laufende Zuweisungsprozesse werden zu Ende geführt. Neue Läufe werden nicht mehr gestartet.</p>
                </InfoTooltip>
                <button
                  onClick={handleStopEngine}
                  disabled={executing}
                  className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-50"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  Automatik stoppen
                </button>
              </>
            )}
          </div>
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
      <div className="flex border-b border-blue-500/20 gap-0 px-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-blue-500/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <AssignmentFilters />

      {/* Tab Content */}
      <EnterpriseCard noPadding>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && tab === 'runs' && <AssignmentRunTable runs={runs} />}

        {!loading && tab === 'decisions' && <AssignmentDecisionTable decisions={decisions} />}

        {!loading && tab === 'exclusions' && (
          <div className="p-4">
            <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>}>
              <OdinExclusions />
            </Suspense>
          </div>
        )}

        {!loading && tab === 'employeeExclusions' && (
          <div className="p-4">
            <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>}>
              <EmployeeExclusions />
            </Suspense>
          </div>
        )}

        {!loading && tab === 'logicTree' && (
          <div className="p-4">
            <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>}>
              <OdinLogicTree />
            </Suspense>
          </div>
        )}

        {!loading && tab === 'visualizer' && (
          <div className="p-4">
            <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" /></div>}>
              <AssignmentVisualizer runs={runs} />
            </Suspense>
          </div>
        )}

        {!loading && tab === 'settings' && <AssignmentSettingsPanel />}
      </EnterpriseCard>

      {/* Decision Drawer */}
      <AssignmentDecisionDrawer />
    </EnterprisePageShell>
  );
}
