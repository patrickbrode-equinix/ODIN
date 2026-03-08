/* ================================================ */
/* Assignment Engine — API Routes                   */
/* ================================================ */

import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePageAccess } from '../middleware/requirePageAccess.js';
import {
  assignmentSettingsService,
  assignmentExplanationService,
  assignmentExclusionService,
  runAssignmentCycle,
  assignmentRunRepository,
  assignmentDecisionRepository,
  assignmentOverrideRepository,
  analyticsTracker,
  checkCrawlerFreshness,
  loadLastCrawlerTimestamp,
} from '../assignment/index.js';

const router = express.Router();

/* All assignment routes require auth */
router.use(requireAuth);

/* ------------------------------------------------ */
/* HEALTH                                           */
/* ------------------------------------------------ */

router.get('/health', async (req, res) => {
  try {
    const settings = await assignmentSettingsService.getAll();
    res.json({
      ok: true,
      module: 'assignment-engine',
      phase: 1,
      mode: settings.settings['assignment.mode'] || 'shadow',
      settingsCount: settings.raw.length,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* SETTINGS                                         */
/* ------------------------------------------------ */

router.get('/settings', async (req, res) => {
  try {
    const { settings, raw } = await assignmentSettingsService.getAll();
    res.json({ ok: true, settings, raw });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/settings', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const { updated, rejected } = await assignmentSettingsService.update(
      req.body,
      req.user?.email || 'unknown'
    );
    res.json({ ok: true, updated, rejected });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* RUNS                                             */
/* ------------------------------------------------ */

router.post('/runs/execute', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const result = await runAssignmentCycle({
      triggeredBy: req.user?.email || 'manual',
      modeOverride: req.body?.mode,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/runs', async (req, res) => {
  try {
    const { limit = 50, offset = 0, mode, status } = req.query;
    const runs = await assignmentRunRepository.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      mode: mode || undefined,
      status: status || undefined,
    });
    const total = await assignmentRunRepository.count({
      mode: mode || undefined,
      status: status || undefined,
    });
    res.json({ ok: true, runs, total });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/runs/:runId', async (req, res) => {
  try {
    const run = await assignmentRunRepository.findById(parseInt(req.params.runId));
    if (!run) return res.status(404).json({ ok: false, error: 'Run not found' });
    res.json({ ok: true, run });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* DECISIONS                                        */
/* ------------------------------------------------ */

router.get('/decisions', async (req, res) => {
  try {
    const { limit = 100, offset = 0, result, runId } = req.query;
    const decisions = await assignmentDecisionRepository.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      result: result || undefined,
      runId: runId ? parseInt(runId) : undefined,
    });
    res.json({ ok: true, decisions });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/decisions/:decisionId', async (req, res) => {
  try {
    const decision = await assignmentDecisionRepository.findById(parseInt(req.params.decisionId));
    if (!decision) return res.status(404).json({ ok: false, error: 'Decision not found' });
    res.json({ ok: true, decision });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* TICKET EXPLANATION                               */
/* ------------------------------------------------ */

router.get('/tickets/:ticketId/explanation', async (req, res) => {
  try {
    const result = await assignmentExplanationService.getTicketExplanation(
      req.params.ticketId,
      req.query.runId ? parseInt(req.query.runId) : null
    );
    if (!result.found) {
      return res.status(404).json({ ok: false, error: result.message });
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* OVERRIDES                                        */
/* ------------------------------------------------ */

router.get('/overrides', async (req, res) => {
  try {
    const { limit = 100, offset = 0, active } = req.query;
    const overrides = await assignmentOverrideRepository.findAll({
      limit: parseInt(limit),
      offset: parseInt(offset),
      active: active !== undefined ? active === 'true' : undefined,
    });
    res.json({ ok: true, overrides });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/overrides', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const { ticketId, overrideType, targetWorkerId, reason } = req.body;
    if (!ticketId || !overrideType) {
      return res.status(400).json({ ok: false, error: 'ticketId and overrideType are required' });
    }
    const override = await assignmentOverrideRepository.create({
      ticketId,
      overrideType,
      targetWorkerId: targetWorkerId || null,
      reason: reason || null,
      createdBy: req.user?.email || 'unknown',
    });
    res.json({ ok: true, override });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.patch('/overrides/:id/deactivate', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const result = await assignmentOverrideRepository.deactivate(
      parseInt(req.params.id),
      req.user?.email || 'unknown'
    );
    if (!result) return res.status(404).json({ ok: false, error: 'Override not found' });
    res.json({ ok: true, override: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* EXCLUSION LIST (system names)                    */
/* ------------------------------------------------ */

router.get('/exclusions', async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const exclusions = await assignmentExclusionService.getAll(activeOnly);
    res.json({ ok: true, exclusions });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/exclusions', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const { systemName, reason } = req.body;
    if (!systemName) {
      return res.status(400).json({ ok: false, error: 'systemName is required' });
    }
    const entry = await assignmentExclusionService.add({
      systemName,
      reason: reason || null,
      createdBy: req.user?.email || 'unknown',
    });
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.patch('/exclusions/:id/deactivate', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const result = await assignmentExclusionService.deactivate(parseInt(req.params.id));
    if (!result) return res.status(404).json({ ok: false, error: 'Entry not found' });
    res.json({ ok: true, entry: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/exclusions/:id', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const result = await assignmentExclusionService.remove(parseInt(req.params.id));
    if (!result) return res.status(404).json({ ok: false, error: 'Entry not found' });
    res.json({ ok: true, entry: result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* CRAWLER STATUS                                   */
/* ------------------------------------------------ */

router.get('/crawler-status', async (req, res) => {
  try {
    const lastTimestamp = await loadLastCrawlerTimestamp();
    const freshness = checkCrawlerFreshness(lastTimestamp);
    res.json({
      ok: true,
      fresh: freshness.fresh,
      lastCrawlerTimestamp: lastTimestamp,
      reason: freshness.reason,
      staleDurationMs: freshness.staleDurationMs,
      // TV mode safety message
      tvMessage: freshness.fresh ? null : 'No current crawler data',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* ANALYTICS (restricted admin only)                */
/* ------------------------------------------------ */

router.get('/analytics/manual-pickups', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    if (!from || !to) return res.status(400).json({ ok: false, error: 'from and to query params required' });
    const results = await analyticsTracker.getManualPickups({ from, to, limit: parseInt(limit) || 200 });
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/analytics/single-ticket-workers', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ ok: false, error: 'from and to query params required' });
    const results = await analyticsTracker.getSingleTicketWorkers({ from, to });
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/analytics/owner-ranking', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const { from, to, limit } = req.query;
    if (!from || !to) return res.status(400).json({ ok: false, error: 'from and to query params required' });
    const results = await analyticsTracker.getOwnerRanking({ from, to, limit: parseInt(limit) || 50 });
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/analytics/expired-vs-active', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const results = await analyticsTracker.getExpiredVsActive();
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/analytics/manual-pickup', requirePageAccess('settings', 'write'), async (req, res) => {
  try {
    const { ticketId, workerId, workerName } = req.body;
    if (!ticketId || !workerId) return res.status(400).json({ ok: false, error: 'ticketId and workerId required' });
    await analyticsTracker.trackManualPickup({ ticketId, workerId, workerName });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
