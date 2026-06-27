/* ================================================ */
/* Assignment Writeback — API Routes                */
/* /api/assignment-actions                          */
/* ================================================ */

import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePageAccess } from '../middleware/requirePageAccess.js';
import { assignmentActionRepository, ACTION_TYPES } from '../assignment/writeback/assignmentActionRepository.js';
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
import { loadEmployeeWithJarvisFields } from '../assignment/writeback/employeeMapper.js';

const router = express.Router();

router.use(requireAuth);
router.use(requirePageAccess('odin_logic', 'view'));

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return null;
}

function employeeDisplayName(employee) {
  return firstText(
    employee?.name,
    [employee?.first_name, employee?.last_name].filter(Boolean).join(' '),
    employee?.email
  );
}

function ticketActivityNumber(ticket) {
  return firstText(ticket.external_id, ticket.activity, ticket.activity_no, ticket.id);
}

function buildTicketActionFields({ ticket, employee, actionType, settings, requestedBy, currentOwnerCode = null, reason = null }) {
  return {
    ticketId: String(ticket.id),
    activityNumber: ticketActivityNumber(ticket),
    salesOrderNumber: firstText(ticket.sales_order, ticket.salesorder, ticket.salesOrder, ticket.so_number),
    queueType: firstText(ticket.queue_type),
    subType: firstText(ticket.customer_trouble_type, ticket.subtype),
    systemName: firstText(ticket.system_name),
    currentJarvisOwnerCode: currentOwnerCode,
    expectedPreviousOwnerCode: currentOwnerCode,
    selectedEmployeeId: actionType === ACTION_TYPES.UNASSIGN ? null : employee?.id,
    selectedEmployeeName: actionType === ACTION_TYPES.UNASSIGN ? null : employeeDisplayName(employee),
    selectedEmployeeEmail: actionType === ACTION_TYPES.UNASSIGN ? null : firstText(employee?.email),
    selectedEmployeeJarvisDisplayName: actionType === ACTION_TYPES.UNASSIGN ? null : firstText(employee?.jarvis_display_name),
    selectedEmployeeJarvisOwnerCode: actionType === ACTION_TYPES.UNASSIGN ? null : firstText(employee?.jarvis_owner_code),
    selectedEmployeeJarvisInitials: actionType === ACTION_TYPES.UNASSIGN ? null : firstText(employee?.jarvis_initials),
    actionType,
    executionMode: settings.mode,
    decisionSource: actionType === ACTION_TYPES.UNASSIGN ? 'tickets_tab_reset' : 'tickets_tab_writeback',
    decisionTraceJson: {
      queueItemId: ticket.id,
      requestedBy,
      source: 'tickets_tab',
      reason,
      odinOwner: ticket.owner || null,
      assignedWorkerId: ticket.assigned_worker_id || null,
    },
    hardReassignReason: reason,
  };
}

async function loadQueueItem(queueItemId) {
  const { rows } = await pool.query(
    `SELECT * FROM queue_items WHERE id = $1 AND active = TRUE`,
    [queueItemId]
  );
  return rows[0] || null;
}

async function loadAssignedEmployee(ticket) {
  if (ticket.assigned_worker_id) {
    return loadEmployeeWithJarvisFields(ticket.assigned_worker_id);
  }

  const activityNumber = ticketActivityNumber(ticket);
  const { rows } = await pool.query(
    `SELECT assigned_worker_id
       FROM assignment_ticket_decisions
      WHERE result = 'assigned'
        AND assigned_worker_id IS NOT NULL
        AND (ticket_id = $1 OR ticket_id = $2)
      ORDER BY decided_at DESC
      LIMIT 1`,
    [String(ticket.id), activityNumber]
  );

  return rows[0]?.assigned_worker_id
    ? loadEmployeeWithJarvisFields(rows[0].assigned_worker_id)
    : null;
}

async function validateCreatedAction(action) {
  try {
    return await validateAssignmentAction(action.id);
  } catch (err) {
    return { valid: false, errors: [err.message] };
  }
}

async function loadOdinAssignedTickets() {
  const { rows } = await pool.query(
    `SELECT qi.*,
            u.name AS employee_name,
            u.email AS employee_email,
            u.first_name AS employee_first_name,
            u.last_name AS employee_last_name,
            u.jarvis_display_name AS employee_jarvis_display_name,
            u.jarvis_owner_code AS employee_jarvis_owner_code,
            u.jarvis_initials AS employee_jarvis_initials
       FROM queue_items qi
       LEFT JOIN users u ON u.id = qi.assigned_worker_id
      WHERE qi.active = TRUE
        AND qi.assigned_worker_id IS NOT NULL
      ORDER BY qi.id ASC`
  );
  return rows;
}

function employeeFromAssignedTicket(row) {
  return {
    id: row.assigned_worker_id,
    name: row.employee_name,
    email: row.employee_email,
    first_name: row.employee_first_name,
    last_name: row.employee_last_name,
    jarvis_display_name: row.employee_jarvis_display_name,
    jarvis_owner_code: row.employee_jarvis_owner_code,
    jarvis_initials: row.employee_jarvis_initials,
  };
}

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

/* --------------------------------------- */
/* POST /api/assignment-actions/tickets/:queueItemId/writeback */
/* Create and validate a writeback action from the Tickets tab. */
/* --------------------------------------- */
router.post('/tickets/:queueItemId/writeback', requirePageAccess('odin_logic', 'write'), async (req, res) => {
  try {
    const queueItemId = parseInt(req.params.queueItemId, 10);
    if (!Number.isInteger(queueItemId)) return res.status(400).json({ error: 'Invalid queue item id' });

    const ticket = await loadQueueItem(queueItemId);
    if (!ticket) return res.status(404).json({ error: 'Queue ticket not found' });

    const employee = await loadAssignedEmployee(ticket);
    if (!employee) {
      return res.status(409).json({
        error: 'Ticket has no ODIN-assigned employee to write back',
        code: 'NO_ODIN_ASSIGNEE',
      });
    }

    const settings = await loadWritebackSettings();
    const requestedBy = req.user?.name || req.user?.email || 'unknown';
    const action = await assignmentActionRepository.create(buildTicketActionFields({
      ticket,
      employee,
      actionType: ACTION_TYPES.ASSIGN,
      settings,
      requestedBy,
      reason: 'manual_ticket_writeback',
    }));
    const validation = await validateCreatedAction(action);

    res.status(201).json({
      ok: true,
      action: await assignmentActionRepository.findById(action.id),
      validation,
      execution: {
        attempted: false,
        reason: 'Writeback action created and validated. The Jarvis crawler will pick it up and execute it from the active Jarvis tab.',
      },
    });
  } catch (err) {
    console.error('[assignment-actions] POST /tickets/:queueItemId/writeback error:', err.message);
    res.status(500).json({ error: 'Ticket writeback failed', detail: err.message });
  }
});

/* --------------------------------------- */
/* POST /api/assignment-actions/tickets/reset-all */
/* Reset all active ODIN ticket assignments and prepare Jarvis unassign actions. */
/* --------------------------------------- */
router.post('/tickets/reset-all', requirePageAccess('odin_logic', 'write'), async (req, res) => {
  try {
    const tickets = await loadOdinAssignedTickets();
    if (tickets.length === 0) {
      return res.json({
        ok: true,
        resetCount: 0,
        actionCount: 0,
        validationFailedCount: 0,
        actions: [],
        message: 'No active ODIN ticket assignments found.',
      });
    }

    const settings = await loadWritebackSettings();
    const requestedBy = req.user?.name || req.user?.email || 'unknown';
    const actions = [];
    const validations = [];

    for (const ticket of tickets) {
      const employee = employeeFromAssignedTicket(ticket);
      const jarvisOwnerCode = firstText(employee.jarvis_owner_code);
      if (!jarvisOwnerCode) continue;

      const action = await assignmentActionRepository.create(buildTicketActionFields({
        ticket,
        employee,
        actionType: ACTION_TYPES.UNASSIGN,
        settings,
        requestedBy,
        currentOwnerCode: jarvisOwnerCode,
        reason: 'odin_bulk_reset_requested',
      }));
      const validation = await validateCreatedAction(action);
      validations.push(validation);
      actions.push(await assignmentActionRepository.findById(action.id));
    }

    const { rows } = await pool.query(
      `UPDATE queue_items
          SET assigned_worker_id = NULL,
              assigned_at = NULL,
              owner = NULL,
              updated_at = NOW()
        WHERE active = TRUE
          AND assigned_worker_id IS NOT NULL
        RETURNING id`
    );

    const validationFailedCount = validations.filter((validation) => validation && !validation.valid).length;

    res.json({
      ok: true,
      resetCount: rows.length,
      actionCount: actions.length,
      validationFailedCount,
      actions: actions.slice(0, 20),
      message: actions.length > 0
        ? 'ODIN assignments reset and Jarvis unassign actions prepared.'
        : 'ODIN assignments reset. No Jarvis owner codes were available for unassign actions.',
    });
  } catch (err) {
    console.error('[assignment-actions] POST /tickets/reset-all error:', err.message);
    res.status(500).json({ error: 'Bulk ticket assignment reset failed', detail: err.message });
  }
});

/* --------------------------------------- */
/* POST /api/assignment-actions/tickets/:queueItemId/reset */
/* Reset ODIN's local assignment and prepare an optional Jarvis unassign action. */
/* --------------------------------------- */
router.post('/tickets/:queueItemId/reset', requirePageAccess('odin_logic', 'write'), async (req, res) => {
  try {
    const queueItemId = parseInt(req.params.queueItemId, 10);
    if (!Number.isInteger(queueItemId)) return res.status(400).json({ error: 'Invalid queue item id' });

    const ticket = await loadQueueItem(queueItemId);
    if (!ticket) return res.status(404).json({ error: 'Queue ticket not found' });
    if (!ticket.assigned_worker_id) {
      return res.status(409).json({ error: 'Ticket has no ODIN assignment to reset', code: 'NO_ODIN_ASSIGNMENT' });
    }

    const employee = await loadEmployeeWithJarvisFields(ticket.assigned_worker_id);
    const employeeName = employeeDisplayName(employee);
    const jarvisDisplayName = firstText(employee?.jarvis_display_name);
    const jarvisOwnerCode = firstText(employee?.jarvis_owner_code);
    const settings = await loadWritebackSettings();
    const requestedBy = req.user?.name || req.user?.email || 'unknown';

    const { rows } = await pool.query(
      `UPDATE queue_items
          SET assigned_worker_id = NULL,
              assigned_at = NULL,
              owner = CASE
                WHEN LOWER(COALESCE(owner, '')) IN (LOWER(COALESCE($2, '')), LOWER(COALESCE($3, '')), LOWER(COALESCE($4, '')))
                  THEN NULL
                ELSE owner
              END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [queueItemId, employeeName, jarvisDisplayName, jarvisOwnerCode]
    );

    let action = null;
    let validation = null;
    if (jarvisOwnerCode) {
      action = await assignmentActionRepository.create(buildTicketActionFields({
        ticket,
        employee,
        actionType: ACTION_TYPES.UNASSIGN,
        settings,
        requestedBy,
        currentOwnerCode: jarvisOwnerCode,
        reason: 'odin_reset_requested',
      }));
      validation = await validateCreatedAction(action);
      action = await assignmentActionRepository.findById(action.id);
    }

    res.json({
      ok: true,
      ticket: rows[0],
      action,
      validation,
      message: action
        ? 'ODIN assignment reset and Jarvis unassign action prepared.'
        : 'ODIN assignment reset. No Jarvis owner code was available for an unassign action.',
    });
  } catch (err) {
    console.error('[assignment-actions] POST /tickets/:queueItemId/reset error:', err.message);
    res.status(500).json({ error: 'Ticket assignment reset failed', detail: err.message });
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

    const allowMockAdapter = process.env.WRITEBACK_USE_MOCK_ADAPTER === 'true' || process.env.NODE_ENV === 'test';
    if (!allowMockAdapter) {
      return res.status(501).json({
        error: 'Direct backend writeback execution is disabled',
        code: 'WRITEBACK_EXECUTION_OWNED_BY_CRAWLER',
        detail: 'Jarvis writeback is executed by the Chrome crawler because only the crawler runs inside the Jarvis browser tab.',
      });
    }

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
