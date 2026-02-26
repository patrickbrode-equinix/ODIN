import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth); // All /api/activity/* routes require a valid JWT

/**
 * GET /api/activity
 * Query params:
 *  - limit (default 50)
 *  - offset (default 0)
 *  - module (optional filter)
 *  - action (optional filter)
 *  - actor (optional filter)
 *  - start (optional ISO date)
 *  - end (optional ISO date)
 */
router.get('/', async (req, res) => {
    try {
        const { limit = 50, offset = 0, module, action, actor, start, end } = req.query;

        const params = [];
        let sql = `
      SELECT * FROM activity_log
      WHERE 1=1
    `;

        if (module) {
            params.push(module);
            sql += ` AND module = $${params.length}`;
        }
        if (action) {
            params.push(action);
            sql += ` AND action_type = $${params.length}`;
        }
        if (actor) {
            params.push(`%${actor}%`);
            sql += ` AND actor ILIKE $${params.length}`;
        }
        if (start) {
            params.push(start);
            sql += ` AND ts >= $${params.length}`;
        }
        if (end) {
            params.push(end);
            sql += ` AND ts <= $${params.length}`;
        }

        sql += ` ORDER BY ts DESC`;

        params.push(parseInt(limit) || 50);
        sql += ` LIMIT $${params.length}`;

        params.push(parseInt(offset) || 0);
        sql += ` OFFSET $${params.length}`;

        const result = await query(sql, params);

        // Get total count for pagination info (optional, but good for UI)
        // For now just return rows
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching activity log:', err);
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
});

/**
 * GET /api/activity/stats
 * Returns simple stats (e.g. counts per module today)
 */
router.get('/stats', async (req, res) => {
    try {
        const sql = `
            SELECT module, COUNT(*) as count 
            FROM activity_log 
            WHERE ts >= CURRENT_DATE 
            GROUP BY module
        `;
        const result = await query(sql);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching activity stats:', err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

/* ------------------------------------------------ */
/* LOG ACTIVITY HELPER                              */
/* ------------------------------------------------ */

export async function logActivity(
    actorUserId,
    actorName,
    actionType,
    module,
    entityType,
    entityId,
    correlationId,
    payload
) {
    try {
        await query(
            `
      INSERT INTO activity_log
      (actor_user_id, actor_name, action_type, module, entity_type, entity_id, correlation_id, payload)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
            [
                actorUserId,
                actorName,
                actionType,
                module,
                entityType,
                entityId,
                correlationId,
                payload || {},
            ]
        );
    } catch (err) {
        console.error("ACTIVITY LOG ERROR:", err);
    }
}

/**
 * POST /api/activity/log
 * Allow frontend to log specific actions
 */
router.post('/log', async (req, res) => {
    try {
        const { action, module, details } = req.body;
        const user = req.user; // Requires auth middleware? Yes, check if mounted with auth. 
        // activity.js is mounted as app.use("/api/activity", activityRoutes);
        // It does NOT have requireAuth on the router itself in server.js usually?
        // Let's assume we need to check auth or pass user id if available.
        // Better: frontend should use this only if logged in.

        // If req.user is missing (no middleware on this route), we might need to handle it.
        // But usually api routes are protected?
        // Let's assume req.user implies auth middleware usage in server.js or we add it here?
        // server.js: app.use("/api/activity", activityRoutes); -> No requireAuth? 
        // We should add it to the route or check.
        // For now, let's just log what we have.

        await logActivity(
            user?.id || null,
            user?.displayName || "Frontend",
            action || "FRONTEND_ACTION",
            module || "FRONTEND",
            null,
            null,
            null,
            details || {}
        );
        res.json({ success: true });
    } catch (err) {
        console.error("LOG POST ERROR:", err);
        res.status(500).json({ error: "Failed to log" });
    }
});

export default router;
