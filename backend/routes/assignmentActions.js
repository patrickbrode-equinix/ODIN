/* ================================================ */
/* Assignment Writeback — API Routes                */
/* /api/assignment-actions                          */
/* ================================================ */

import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePageAccess } from '../middleware/requirePageAccess.js';
import { assignmentActionRepository } from '../assignment/writeback/assignmentActionRepository.js';
import { assignmentAuditRepository } from '../assignment/writeback/assignmentAuditRepository.js';
import {
  validateAssignmentAction,
  approveAssignmentAction,
  executeAssignmentAction,
  cancelAssignmentAction,
  reconcileAssignmentState,
} from '../assignment/writeback/AssignmentExecutionService.js';
import { MockJarvisUiAdapter } from '../assignment/writeback/JarvisUiAdapter.js';
import { loadWritebackSettings } from '../assignment/writeback/writebackSettings.js';

const router = express.Router();

router.use(requireAuth);
router.use(requirePageAccess('odin_logic', 'view'));

/* ─────────────────────────────────────── */
/* GET /api/assignment-actions             */
/* List all actions with optional filters  */
/* ─────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { executionStatus, actionType, executionMode, limit = '100', offset = '0' } = req.query;
    const actions = await assignmentActionRepository.findAll({
      executionStatus: executionStatus || undefined,
      actionType: actionType || undefined,
      executionMode: executionMode || undefined,
      limit: Math.min(parseInt(limit, 10) || 100, 500),
      offset: parseInt(offset, 10) || 0,
    });
    const settings = await loadWritebackSettings();
    res.json({
      actions,
      settings: {
        mode: settings.mode,
        enabled: settings.enabled,
        killSwitch: settings.killSwitch,
      },
    });
  } catch (err) {
    console.error('[assignment-actions] GET / error:', err.message);
    res.status(500).json({ error: 'Failed to load assignment actions' });
  }
});

/* ─────────────────────────────────────── */
/* GET /api/assignment-actions/audit       */
/* Global audit log                        */
/* ─────────────────────────────────────── */
router.get('/audit', async (req, res) => {
  try {
    const { activityNumber, limit = '200', offset = '0' } = req.query;
    const logs = await assignmentAuditRepository.findRecent({
      activityNumber: activityNumber || undefined,
      limit: Math.min(parseInt(limit, 10) || 200, 1000),
      offset: parseInt(offset, 10) || 0,
    });
    res.json({ logs });
  } catch (err) {
    console.error('[assignment-actions] GET /audit error:', err.message);
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
});

/* ─────────────────────────────────────── */
/* POST /api/assignment-actions/reconcile  */
/* Compare snapshot state with ODIN state  */
/* ─────────────────────────────────────── */
router.post('/reconcile', requirePageAccess('odin_logic', 'write'), async (req, res) => {
  try {
    const result = await reconcileAssignmentState();
    res.json(result);
  } catch (err) {
    console.error('[assignment-actions] POST /reconcile error:', err.message);
    res.status(500).json({ error: 'Reconcile failed', detail: err.message });
  }
});

/* ─────────────────────────────────────── */
/* GET /api/assignment-actions/:id         */
/* Get a single action with its audit log  */
/* ─────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const action = await assignmentActionRepository.findById(id);
    if (!action) return res.status(404).json({ error: 'Assignment action not found' });

    const auditLogs = await assignmentAuditRepository.findByActionId(id);
    res.json({ action, auditLogs });
  } catch (err) {
    console.error('[assignment-actions] GET /:id error:', err.message);
    res.status(500).json({ error: 'Failed to load assignment action' });
  }
});

/* ─────────────────────────────────────── */
/* POST /api/assignment-actions/:id/validate */
/* ─────────────────────────────────────── */
router.post('/:id/validate', requirePageAccess('odin_logic', 'write'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const result = await validateAssignmentAction(id);
    res.json(result);
  } catch (err) {
    console.error('[assignment-actions] POST /:id/validate error:', err.message);
    res.status(500).json({ error: 'Validation failed', detail: err.message });
  }
});

/* ─────────────────────────────────────── */
/* POST /api/assignment-actions/:id/approve */
/* ─────────────────────────────────────── */
router.post('/:id/approve', requirePageAccess('odin_logic', 'write'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const approvedBy = req.user?.name || req.user?.email || 'unknown';
    const result = await approveAssignmentAction(id, approvedBy);
    res.json(result);
  } catch (err) {
    console.error('[assignment-actions] POST /:id/approve error:', err.message);
    if (err.message.includes('Cannot approve')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Approval failed', detail: err.message });
  }
});

/* ─────────────────────────────────────── */
/* POST /api/assignment-actions/:id/execute */
/* ─────────────────────────────────────── */
router.post('/:id/execute', requirePageAccess('odin_logic', 'write'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    // Settings check
    const settings = await loadWritebackSettings();
    if (!settings.enabled) {
      return res.status(403).json({ error: 'Assignment writeback is disabled (writeback.enabled=false)' });
    }
    if (settings.killSwitch) {
      return res.status(403).json({ error: 'Assignment writeback kill switch is active' });
    }
    if (settings.mode === 'shadow_only') {
      return res.status(403).json({
        error: 'Shadow mode active: ODIN would apply this assignment, but Jarvis will not be changed',
        mode: 'shadow_only',
      });
    }

    // Use MockJarvisUiAdapter in absence of a real Playwright-based adapter.
    // Replace MockJarvisUiAdapter with the real PlaywrightJarvisUiAdapter when available.
    const adapter = new MockJarvisUiAdapter();
    const result = await executeAssignmentAction(id, adapter);
    res.json(result);
  } catch (err) {
    console.error('[assignment-actions] POST /:id/execute error:', err.message);
    if (err.message.includes('not in an executable status')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Execution failed', detail: err.message });
  }
});

/* ─────────────────────────────────────── */
/* POST /api/assignment-actions/:id/cancel  */
/* ─────────────────────────────────────── */
router.post('/:id/cancel', requirePageAccess('odin_logic', 'write'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const cancelledBy = req.user?.name || req.user?.email || 'unknown';
    const result = await cancelAssignmentAction(id, cancelledBy);
    res.json(result);
  } catch (err) {
    console.error('[assignment-actions] POST /:id/cancel error:', err.message);
    if (err.message.includes('Cannot cancel')) return res.status(409).json({ error: err.message });
    res.status(500).json({ error: 'Cancel failed', detail: err.message });
  }
});

/* ─────────────────────────────────────── */
/* GET /api/assignment-actions/:id/audit   */
/* Audit log for a specific action         */
/* ─────────────────────────────────────── */
router.get('/:id/audit', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const action = await assignmentActionRepository.findById(id);
    if (!action) return res.status(404).json({ error: 'Assignment action not found' });

    const logs = await assignmentAuditRepository.findByActionId(id);
    res.json({ action, logs });
  } catch (err) {
    console.error('[assignment-actions] GET /:id/audit error:', err.message);
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

export default router;
