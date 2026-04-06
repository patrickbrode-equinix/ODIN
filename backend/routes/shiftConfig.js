/* ================================================ */
/* Shift Configuration API Routes                   */
/* CRUD for shift definitions, rotation rules,      */
/* fairness rules, planning config, exclusions      */
/* ================================================ */

import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePageAccess } from '../middleware/requirePageAccess.js';
import pool from '../db.js';

const router = express.Router();
router.use(requireAuth);

/* ------------------------------------------------ */
/* SHIFT DEFINITIONS                                */
/* ------------------------------------------------ */

router.get('/definitions', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shift_definitions ORDER BY sort_order, code');
    res.json({ ok: true, definitions: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/definitions/:id', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { name, short_name, shift_type, start_time, end_time, duration_hours, min_staff, max_staff, color_hex, is_active, sort_order } = req.body;
    const id = parseInt(req.params.id);
    const { rows } = await pool.query(
      `UPDATE shift_definitions SET name=$2, short_name=$3, shift_type=$4, start_time=$5, end_time=$6, duration_hours=$7, min_staff=$8, max_staff=$9, color_hex=$10, is_active=$11, sort_order=$12, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [id, name, short_name, shift_type, start_time, end_time, duration_hours, min_staff, max_staff, color_hex, is_active, sort_order]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Definition nicht gefunden' });
    res.json({ ok: true, definition: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/definitions', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { code, name, short_name, shift_type, start_time, end_time, duration_hours, min_staff, max_staff, color_hex, sort_order } = req.body;
    if (!code || !name) return res.status(400).json({ ok: false, error: 'Code und Name erforderlich' });
    const { rows } = await pool.query(
      `INSERT INTO shift_definitions (code, name, short_name, shift_type, start_time, end_time, duration_hours, min_staff, max_staff, color_hex, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [code, name, short_name || code, shift_type || 'early', start_time, end_time, duration_hours || 8, min_staff || 1, max_staff || 5, color_hex || '#3b82f6', sort_order || 0]
    );
    res.json({ ok: true, definition: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ ok: false, error: 'Schichtcode existiert bereits' });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/definitions/:id', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM shift_definitions WHERE id=$1 RETURNING *', [parseInt(req.params.id)]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Definition nicht gefunden' });
    res.json({ ok: true, deleted: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* ROTATION RULES                                   */
/* ------------------------------------------------ */

router.get('/rotation-rules', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shift_rotation_rules WHERE id=1');
    res.json({ ok: true, rules: rows[0] || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/rotation-rules', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { max_consecutive_same, max_consecutive_workdays, min_free_after_streak, night_to_early_forbidden, late_to_early_forbidden, min_hours_between_shifts, max_nights_per_month, max_weekends_per_month, weekend_rule } = req.body;
    const { rows } = await pool.query(
      `UPDATE shift_rotation_rules SET max_consecutive_same=$1, max_consecutive_workdays=$2, min_free_after_streak=$3, night_to_early_forbidden=$4, late_to_early_forbidden=$5, min_hours_between_shifts=$6, max_nights_per_month=$7, max_weekends_per_month=$8, weekend_rule=$9, updated_at=NOW() WHERE id=1 RETURNING *`,
      [max_consecutive_same, max_consecutive_workdays, min_free_after_streak, night_to_early_forbidden, late_to_early_forbidden, min_hours_between_shifts, max_nights_per_month, max_weekends_per_month, weekend_rule]
    );
    res.json({ ok: true, rules: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* FAIRNESS RULES                                   */
/* ------------------------------------------------ */

router.get('/fairness-rules', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shift_fairness_rules WHERE id=1');
    res.json({ ok: true, rules: rows[0] || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/fairness-rules', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { balance_nights, balance_weekends, balance_total_load, max_deviation_percent, fairness_vs_preference } = req.body;
    const { rows } = await pool.query(
      `UPDATE shift_fairness_rules SET balance_nights=$1, balance_weekends=$2, balance_total_load=$3, max_deviation_percent=$4, fairness_vs_preference=$5, updated_at=NOW() WHERE id=1 RETURNING *`,
      [balance_nights, balance_weekends, balance_total_load, max_deviation_percent, fairness_vs_preference]
    );
    res.json({ ok: true, rules: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* PLANNING CONFIG                                  */
/* ------------------------------------------------ */

router.get('/planning-config', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shift_planning_config WHERE id=1');
    res.json({ ok: true, config: rows[0] || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/planning-config', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { respect_employee_wishes, hard_rules_priority, soft_wishes_priority, fairness_priority, admin_override_priority } = req.body;
    const { rows } = await pool.query(
      `UPDATE shift_planning_config SET respect_employee_wishes=$1, hard_rules_priority=$2, soft_wishes_priority=$3, fairness_priority=$4, admin_override_priority=$5, updated_at=NOW() WHERE id=1 RETURNING *`,
      [respect_employee_wishes, hard_rules_priority, soft_wishes_priority, fairness_priority, admin_override_priority]
    );
    res.json({ ok: true, config: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* SHIFTPLAN EXCLUSIONS (separate from tickets)     */
/* ------------------------------------------------ */

router.get('/exclusions', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shiftplan_exclusions ORDER BY created_at DESC');
    res.json({ ok: true, exclusions: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/exclusions', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { employee_name, reason, reason_text } = req.body;
    if (!employee_name) return res.status(400).json({ ok: false, error: 'Mitarbeitername erforderlich' });
    const actor = req.user?.email || req.user?.username || 'system';
    const { rows } = await pool.query(
      `INSERT INTO shiftplan_exclusions (employee_name, reason, reason_text, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
      [employee_name.trim(), reason || 'admin_override', reason_text || null, actor]
    );
    res.json({ ok: true, exclusion: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/exclusions/:id', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const actor = req.user?.email || req.user?.username || 'system';
    const { rows } = await pool.query(
      `UPDATE shiftplan_exclusions SET is_active=FALSE, deactivated_by=$2, deactivated_at=NOW() WHERE id=$1 AND is_active=TRUE RETURNING *`,
      [parseInt(req.params.id), actor]
    );
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Ausschluss nicht gefunden oder bereits deaktiviert' });
    res.json({ ok: true, exclusion: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* EMPLOYEE PREFERENCES                             */
/* ------------------------------------------------ */

router.get('/employee-preferences', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: 'Nicht autorisiert' });
    const { rows } = await pool.query('SELECT * FROM employee_preferences WHERE user_id=$1', [userId]);
    res.json({ ok: true, preferences: rows[0] || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/employee-preferences/all', requirePageAccess('shiftplan_control', 'write'), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ep.*, u.first_name, u.last_name, u.email FROM employee_preferences ep JOIN users u ON u.id = ep.user_id ORDER BY u.last_name, u.first_name`
    );
    res.json({ ok: true, preferences: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/employee-preferences', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: 'Nicht autorisiert' });
    const { preferred_shifts, unwanted_shifts, max_nights_per_month, preferred_days, blocked_days, avoid_colleagues, workload_preference, notes } = req.body;

    // Validate arrays
    const validateArray = (v) => Array.isArray(v) ? v : [];

    const { rows } = await pool.query(
      `INSERT INTO employee_preferences (user_id, preferred_shifts, unwanted_shifts, max_nights_per_month, preferred_days, blocked_days, avoid_colleagues, workload_preference, notes, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         preferred_shifts = $2::jsonb,
         unwanted_shifts = $3::jsonb,
         max_nights_per_month = $4,
         preferred_days = $5::jsonb,
         blocked_days = $6::jsonb,
         avoid_colleagues = $7::jsonb,
         workload_preference = $8,
         notes = $9,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        JSON.stringify(validateArray(preferred_shifts)),
        JSON.stringify(validateArray(unwanted_shifts)),
        max_nights_per_month || null,
        JSON.stringify(validateArray(preferred_days)),
        JSON.stringify(validateArray(blocked_days)),
        JSON.stringify(validateArray(avoid_colleagues)),
        workload_preference || 'normal',
        notes || null,
      ]
    );
    res.json({ ok: true, preferences: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
