/* ================================================ */
/* Assignment Engine — Services                     */
/* ================================================ */

import { assignmentSettingsRepository, assignmentDecisionRepository } from '../repositories/index.js';
import { buildTicketExplanation } from '../logging/decisionLog.js';
import { SETTINGS_KEYS } from '../constants.js';

/* ---- Settings Service ---- */

export const assignmentSettingsService = {
  /**
   * Get all settings as a flat map.
   */
  async getAll() {
    const { map, rows } = await assignmentSettingsRepository.getAll();
    return { settings: map, raw: rows };
  },

  /**
   * Get a single setting value.
   */
  async get(key) {
    const row = await assignmentSettingsRepository.get(key);
    return row ? row.value : null;
  },

  /**
   * Update settings. Only known keys allowed.
   */
  async update(updates, updatedBy) {
    const allowedKeys = Object.values(SETTINGS_KEYS);
    const filtered = {};
    const rejected = [];
    for (const [key, value] of Object.entries(updates)) {
      if (allowedKeys.includes(key)) {
        filtered[key] = value;
      } else {
        rejected.push(key);
      }
    }

    // Special protection: changing mode to 'live' is not allowed in Phase 1
    if (filtered[SETTINGS_KEYS.MODE] === 'live') {
      throw new Error('Live mode is not available in Phase 1. Only shadow and dry-run modes are supported.');
    }

    const results = await assignmentSettingsRepository.setMany(filtered, updatedBy);
    return { updated: results, rejected };
  },

  /**
   * Get settings as a config object for the engine.
   */
  async getEngineConfig() {
    const { map } = await assignmentSettingsRepository.getAll();
    return {
      mode: map[SETTINGS_KEYS.MODE] || 'shadow',
      siteStrictness: map[SETTINGS_KEYS.SITE_STRICTNESS] || 'true',
      responsibilityStrictness: map[SETTINGS_KEYS.RESPONSIBILITY_STRICTNESS] || 'false',
      enableRotationTieBreaker: map[SETTINGS_KEYS.ENABLE_ROTATION] || 'true',
      fallbackTieBreaker: map[SETTINGS_KEYS.FALLBACK_TIE] || 'stable-id',
      planningWindowHours: map[SETTINGS_KEYS.PLANNING_WINDOW] || '72',
      maxTicketsPerRun: map[SETTINGS_KEYS.MAX_TICKETS] || '500',
      stopOnCriticalError: map[SETTINGS_KEYS.STOP_ON_ERROR] || 'false',
      supportedTicketTypes: map[SETTINGS_KEYS.SUPPORTED_TYPES] || 'TroubleTicket,SmartHands,CrossConnect,Other',
    };
  },
};

/* ---- Explanation Service ---- */

export const assignmentExplanationService = {
  /**
   * Get a full explanation for a ticket, optionally scoped to a run.
   */
  async getTicketExplanation(ticketId, runId = null) {
    let decisions;
    if (runId) {
      const decision = await assignmentDecisionRepository.findByRunId(runId);
      decisions = decision.filter(d => d.ticket_id === ticketId);
    } else {
      decisions = await assignmentDecisionRepository.findByTicketId(ticketId);
    }

    if (decisions.length === 0) {
      return { found: false, explanation: null, message: `No decision found for ticket ${ticketId}` };
    }

    // Return the most recent decision
    const latest = decisions[0];
    const explanation = buildTicketExplanation(latest);

    return {
      found: true,
      decision: latest,
      explanation,
    };
  },

  /**
   * Build a human-readable summary from a decision row.
   */
  buildHumanReadableSummary(decision) {
    return buildTicketExplanation(decision);
  },
};

/* ---- Execution Service ---- */

export { runAssignmentCycle } from '../engine/runAssignmentCycle.js';
