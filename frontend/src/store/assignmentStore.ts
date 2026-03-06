/* ================================================ */
/* Assignment Engine — Zustand Store                */
/* ================================================ */

import { create } from 'zustand';
import { AssignmentApi } from '../api/assignment';
import type {
  AssignmentSettings,
  AssignmentSettingRow,
  AssignmentRun,
  AssignmentDecision,
  TicketExplanation,
  AssignmentOverride,
  AssignmentHealth,
  AssignmentFilters,
  AssignmentMode,
} from '../types/assignment';

interface AssignmentState {
  /* ---- Data ---- */
  health: AssignmentHealth | null;
  settings: AssignmentSettings | null;
  settingsRaw: AssignmentSettingRow[];
  runs: AssignmentRun[];
  runsTotal: number;
  selectedRun: AssignmentRun | null;
  decisions: AssignmentDecision[];
  selectedDecision: AssignmentDecision | null;
  selectedTicketExplanation: TicketExplanation | null;
  overrides: AssignmentOverride[];
  filters: AssignmentFilters;

  /* ---- UI State ---- */
  loading: boolean;
  error: string | null;
  drawerOpen: boolean;
  executing: boolean;
  settingsSaving: boolean;

  /* ---- Actions ---- */
  fetchHealth: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<AssignmentSettings>) => Promise<void>;
  fetchRuns: (params?: { limit?: number; offset?: number }) => Promise<void>;
  selectRun: (runId: number) => Promise<void>;
  executeRun: (mode?: AssignmentMode) => Promise<void>;
  fetchDecisions: (params?: { limit?: number; offset?: number; result?: string; runId?: number }) => Promise<void>;
  selectDecision: (decisionId: number) => Promise<void>;
  fetchTicketExplanation: (ticketId: string, runId?: number) => Promise<void>;
  fetchOverrides: () => Promise<void>;
  setFilters: (filters: Partial<AssignmentFilters>) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  clearError: () => void;
}

export const useAssignmentStore = create<AssignmentState>()((set, get) => ({
  /* ---- Initial Data ---- */
  health: null,
  settings: null,
  settingsRaw: [],
  runs: [],
  runsTotal: 0,
  selectedRun: null,
  decisions: [],
  selectedDecision: null,
  selectedTicketExplanation: null,
  overrides: [],
  filters: {},

  /* ---- Initial UI State ---- */
  loading: false,
  error: null,
  drawerOpen: false,
  executing: false,
  settingsSaving: false,

  /* ---- Actions ---- */

  fetchHealth: async () => {
    try {
      const health = await AssignmentApi.getHealth();
      set({ health });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch health' });
    }
  },

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const { settings, raw } = await AssignmentApi.getSettings();
      set({ settings, settingsRaw: raw, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch settings', loading: false });
    }
  },

  updateSettings: async (updates) => {
    set({ settingsSaving: true, error: null });
    try {
      await AssignmentApi.updateSettings(updates);
      // Reload settings
      const { settings, raw } = await AssignmentApi.getSettings();
      set({ settings, settingsRaw: raw, settingsSaving: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to update settings', settingsSaving: false });
    }
  },

  fetchRuns: async (params) => {
    set({ loading: true, error: null });
    try {
      const filters = get().filters;
      const { runs, total } = await AssignmentApi.getRuns({
        ...params,
        mode: filters.runMode,
        status: filters.runStatus,
      });
      set({ runs, runsTotal: total, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch runs', loading: false });
    }
  },

  selectRun: async (runId) => {
    set({ loading: true, error: null });
    try {
      const run = await AssignmentApi.getRun(runId);
      const decisions = await AssignmentApi.getDecisions({ runId });
      set({ selectedRun: run, decisions, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch run', loading: false });
    }
  },

  executeRun: async (mode) => {
    set({ executing: true, error: null });
    try {
      await AssignmentApi.executeRun(mode);
      // Reload runs
      const filters = get().filters;
      const { runs, total } = await AssignmentApi.getRuns({ mode: filters.runMode, status: filters.runStatus });
      set({ runs, runsTotal: total, executing: false });
      // Reload health
      try { const health = await AssignmentApi.getHealth(); set({ health }); } catch (_) {}
    } catch (err: any) {
      set({ error: err.message || 'Failed to execute run', executing: false });
    }
  },

  fetchDecisions: async (params) => {
    set({ loading: true, error: null });
    try {
      const filters = get().filters;
      const decisions = await AssignmentApi.getDecisions({
        ...params,
        result: filters.decisionResult,
        runId: filters.selectedRunId,
      });
      set({ decisions, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch decisions', loading: false });
    }
  },

  selectDecision: async (decisionId) => {
    set({ loading: true, error: null, drawerOpen: true });
    try {
      const decision = await AssignmentApi.getDecision(decisionId);
      set({ selectedDecision: decision, loading: false });
      // Also fetch explanation
      if (decision.ticket_id) {
        try {
          const explanation = await AssignmentApi.getTicketExplanation(
            decision.ticket_id,
            decision.run_id
          );
          set({ selectedTicketExplanation: explanation });
        } catch (_) {}
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch decision', loading: false });
    }
  },

  fetchTicketExplanation: async (ticketId, runId) => {
    set({ loading: true, error: null });
    try {
      const explanation = await AssignmentApi.getTicketExplanation(ticketId, runId);
      set({ selectedTicketExplanation: explanation, loading: false, drawerOpen: true });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch explanation', loading: false });
    }
  },

  fetchOverrides: async () => {
    set({ loading: true, error: null });
    try {
      const overrides = await AssignmentApi.getOverrides();
      set({ overrides, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch overrides', loading: false });
    }
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false, selectedDecision: null, selectedTicketExplanation: null }),
  clearError: () => set({ error: null }),
}));
