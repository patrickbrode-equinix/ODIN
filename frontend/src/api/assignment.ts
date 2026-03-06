/* ================================================ */
/* Assignment Engine — Frontend API Service         */
/* ================================================ */

import { api, asArray, asObject } from './api';
import type {
  AssignmentSettings,
  AssignmentSettingRow,
  AssignmentRun,
  AssignmentDecision,
  TicketExplanation,
  AssignmentOverride,
  AssignmentHealth,
  AssignmentMode,
} from '../types/assignment';

export const AssignmentApi = {
  /* ---- Health ---- */
  async getHealth(): Promise<AssignmentHealth> {
    const res = await api.get('/assignment/health');
    return asObject(res.data, 'AssignmentApi.getHealth') as AssignmentHealth;
  },

  /* ---- Settings ---- */
  async getSettings(): Promise<{ settings: AssignmentSettings; raw: AssignmentSettingRow[] }> {
    const res = await api.get('/assignment/settings');
    const data = asObject(res.data, 'AssignmentApi.getSettings');
    return { settings: data.settings, raw: data.raw };
  },

  async updateSettings(updates: Partial<AssignmentSettings>): Promise<{ updated: AssignmentSettingRow[]; rejected: string[] }> {
    const res = await api.put('/assignment/settings', updates);
    return asObject(res.data, 'AssignmentApi.updateSettings') as { updated: AssignmentSettingRow[]; rejected: string[] };
  },

  /* ---- Runs ---- */
  async executeRun(mode?: AssignmentMode): Promise<{ runId: number; summary: Record<string, unknown> }> {
    const res = await api.post('/assignment/runs/execute', mode ? { mode } : {});
    return asObject(res.data, 'AssignmentApi.executeRun') as { runId: number; summary: Record<string, unknown> };
  },

  async getRuns(params?: { limit?: number; offset?: number; mode?: string; status?: string }): Promise<{ runs: AssignmentRun[]; total: number }> {
    const res = await api.get('/assignment/runs', { params });
    const data = asObject(res.data, 'AssignmentApi.getRuns');
    return { runs: asArray(data.runs, 'AssignmentApi.getRuns.runs'), total: data.total ?? 0 };
  },

  async getRun(runId: number): Promise<AssignmentRun> {
    const res = await api.get(`/assignment/runs/${runId}`);
    const data = asObject(res.data, 'AssignmentApi.getRun');
    return data.run;
  },

  /* ---- Decisions ---- */
  async getDecisions(params?: { limit?: number; offset?: number; result?: string; runId?: number }): Promise<AssignmentDecision[]> {
    const res = await api.get('/assignment/decisions', { params });
    const data = asObject(res.data, 'AssignmentApi.getDecisions');
    return asArray(data.decisions, 'AssignmentApi.getDecisions.decisions');
  },

  async getDecision(decisionId: number): Promise<AssignmentDecision> {
    const res = await api.get(`/assignment/decisions/${decisionId}`);
    const data = asObject(res.data, 'AssignmentApi.getDecision');
    return data.decision;
  },

  /* ---- Ticket Explanation ---- */
  async getTicketExplanation(ticketId: string, runId?: number): Promise<TicketExplanation> {
    const params = runId ? { runId } : {};
    const res = await api.get(`/assignment/tickets/${ticketId}/explanation`, { params });
    return asObject(res.data, 'AssignmentApi.getTicketExplanation') as TicketExplanation;
  },

  /* ---- Overrides ---- */
  async getOverrides(params?: { limit?: number; offset?: number; active?: boolean }): Promise<AssignmentOverride[]> {
    const res = await api.get('/assignment/overrides', { params });
    const data = asObject(res.data, 'AssignmentApi.getOverrides');
    return asArray(data.overrides, 'AssignmentApi.getOverrides.overrides');
  },

  async createOverride(data: {
    ticketId: string;
    overrideType: string;
    targetWorkerId?: number;
    reason?: string;
  }): Promise<AssignmentOverride> {
    const res = await api.post('/assignment/overrides', data);
    return asObject(res.data, 'AssignmentApi.createOverride').override;
  },

  async deactivateOverride(id: number): Promise<AssignmentOverride> {
    const res = await api.patch(`/assignment/overrides/${id}/deactivate`);
    return asObject(res.data, 'AssignmentApi.deactivateOverride').override;
  },
};
