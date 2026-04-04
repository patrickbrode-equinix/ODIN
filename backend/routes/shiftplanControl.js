/* ================================================ */
/* Shiftplan Control Center – API Routes            */
/* Draft generation, conflicts, Excel, activation   */
/* ================================================ */

import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePageAccess } from '../middleware/requirePageAccess.js';
import pool from '../db.js';

const router = express.Router();
router.use(requireAuth);

/* ------------------------------------------------ */
/* SHIFT CODES & HELPERS                            */
/* ------------------------------------------------ */

const SHIFT_CODES = ['E1', 'E2', 'L1', 'L2', 'N'];
const SHIFT_TYPES = { E1: 'early', E2: 'early', L1: 'late', L2: 'late', N: 'night' };

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function isWeekend(year, month, day) {
  const d = new Date(year, month - 1, day);
  return d.getDay() === 0 || d.getDay() === 6;
}

/**
 * Normalize employee name: trim, collapse whitespace, title case.
 * Filters out entries that look like email addresses.
 */
function normalizeEmployeeName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  // Reject entries that look like email addresses
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Deduplicate employees by normalized name (case-insensitive).
 * Keeps the first occurrence's casing.
 */
function deduplicateEmployees(names) {
  const seen = new Map();
  for (const name of names) {
    const norm = normalizeEmployeeName(name);
    if (!norm) continue;
    const key = norm.toLowerCase();
    if (!seen.has(key)) seen.set(key, norm);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'de'));
}

/* ------------------------------------------------ */
/* LIST DRAFTS                                      */
/* ------------------------------------------------ */

router.get('/drafts', async (req, res) => {
  try {
    const { month } = req.query;
    let sql = 'SELECT id, month, version, status, note, created_by, created_at, approved_by, approved_at, activated_by, activated_at FROM shiftplan_drafts';
    const params = [];
    if (month) { sql += ' WHERE month = $1'; params.push(month); }
    sql += ' ORDER BY created_at DESC LIMIT 50';
    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, drafts: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* GET SINGLE DRAFT (with full data)                */
/* ------------------------------------------------ */

router.get('/drafts/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shiftplan_drafts WHERE id = $1', [parseInt(req.params.id)]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Draft nicht gefunden' });
    res.json({ ok: true, draft: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* GENERATE DRAFT                                   */
/* ------------------------------------------------ */

router.post('/drafts/generate', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { month, note } = req.body; // month = 'YYYY-MM'
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ ok: false, error: 'Gültiges Monatsformat erforderlich (YYYY-MM)' });
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr);
    const mon = parseInt(monthStr);
    const numDays = daysInMonth(year, mon);
    const createdBy = req.user?.email || req.user?.username || 'system';

    // 1. Load employees from shifts (distinct names from any recent month)
    const empRes = await pool.query(
      `SELECT DISTINCT employee_name FROM shifts WHERE month LIKE $1 ORDER BY employee_name`,
      [`${year}-%`]
    );
    let employees = deduplicateEmployees(empRes.rows.map(r => r.employee_name));

    // Fallback: if no employees found for this year, try previous month
    if (employees.length === 0) {
      const fallback = await pool.query(
        `SELECT DISTINCT employee_name FROM shifts ORDER BY employee_name LIMIT 100`
      );
      employees = deduplicateEmployees(fallback.rows.map(r => r.employee_name));
    }

    if (employees.length === 0) {
      return res.status(400).json({ ok: false, error: 'Keine Mitarbeiter im System gefunden' });
    }

    // 2. Load absences
    const absRes = await pool.query(
      `SELECT employee_name, start_date, end_date, type FROM absences WHERE start_date <= $1 AND end_date >= $2`,
      [`${month}-${numDays}`, `${month}-01`]
    );
    const absenceMap = new Map();
    for (const a of absRes.rows) {
      if (!absenceMap.has(a.employee_name)) absenceMap.set(a.employee_name, []);
      absenceMap.get(a.employee_name).push(a);
    }

    // 3. Load employee exclusions
    const exclRes = await pool.query(
      `SELECT employee_name FROM assignment_employee_exclusions WHERE is_active = TRUE AND (valid_from IS NULL OR valid_from <= $1) AND (valid_to IS NULL OR valid_to >= $2)`,
      [`${month}-${numDays}`, `${month}-01`]
    );
    const excludedSet = new Set(exclRes.rows.map(r => r.employee_name));

    // 4. Load employee skills
    const skillsRes = await pool.query('SELECT * FROM employee_skills');
    const skillsMap = new Map();
    for (const s of skillsRes.rows) {
      skillsMap.set(s.employee_name, s);
    }

    // 5. Load wellbeing metrics (previous month for fairness)
    const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`;
    const wbRes = await pool.query(
      `SELECT employee_name, night_count, weekend_count FROM wellbeing_metrics WHERE year = $1 AND month = $2`,
      [prevMonth.split('-')[0], parseInt(prevMonth.split('-')[1])]
    );
    const fairnessMap = new Map();
    for (const w of wbRes.rows) {
      fairnessMap.set(w.employee_name, w);
    }

    // 6. Load preferred colleagues
    const prefRes = await pool.query(
      `SELECT pc.user_id, u.first_name || ' ' || u.last_name as requester_name, pc.preferred_employee_name
       FROM preferred_colleagues pc JOIN users u ON u.id = pc.user_id`
    );
    const preferredMap = new Map();
    for (const p of prefRes.rows) {
      if (!preferredMap.has(p.requester_name)) preferredMap.set(p.requester_name, []);
      preferredMap.get(p.requester_name).push(p.preferred_employee_name);
    }

    // 7. Load staffing rules
    const staffRes = await pool.query('SELECT * FROM staffing_rules');
    const staffingRules = {};
    for (const r of staffRes.rows) {
      staffingRules[r.shift_type] = r.min_count || 2;
    }

    // 8. Generate draft shifts
    const shifts = [];
    const explanations = {};
    const conflicts = [];
    const fairness = {};

    // Track assignments per employee
    const empNights = {};
    const empWeekends = {};
    const empShifts = {};

    for (const emp of employees) {
      empNights[emp] = 0;
      empWeekends[emp] = 0;
      empShifts[emp] = {};
      fairness[emp] = { nights: 0, weekends: 0, holidays: 0, earlyCount: 0, lateCount: 0, total: 0 };
    }

    // Available employees per day (excluding absences and exclusions)
    for (let day = 1; day <= numDays; day++) {
      const dateStr = `${month}-${String(day).padStart(2, '0')}`;
      const weekend = isWeekend(year, mon, day);

      // Determine available employees for this day
      const availableEmps = employees.filter(emp => {
        if (excludedSet.has(emp)) return false;
        const absences = absenceMap.get(emp) || [];
        for (const ab of absences) {
          const abStart = new Date(ab.start_date);
          const abEnd = new Date(ab.end_date);
          const thisDate = new Date(dateStr);
          if (thisDate >= abStart && thisDate <= abEnd) return false;
        }
        return true;
      });

      // Simple rule-based assignment: distribute shifts fairly
      // Sort by least assigned shifts, then by fairness
      const sorted = [...availableEmps].sort((a, b) => {
        const aTotal = Object.keys(empShifts[a] || {}).length;
        const bTotal = Object.keys(empShifts[b] || {}).length;
        if (aTotal !== bTotal) return aTotal - bTotal;
        // Secondary: less nights first for night shifts
        return (empNights[a] || 0) - (empNights[b] || 0);
      });

      // Assign shifts: E1, E2 early, L1, L2 late, N night
      let idx = 0;
      for (const code of SHIFT_CODES) {
        if (idx >= sorted.length) {
          conflicts.push({
            day,
            date: dateStr,
            shift: code,
            severity: 'critical',
            type: 'understaffed',
            message: `Schicht ${code} am ${dateStr}: Nicht genügend verfügbare Mitarbeiter`,
          });
          break;
        }

        const emp = sorted[idx];
        shifts.push({ employee_name: emp, day, shift_code: code });
        empShifts[emp][day] = code;
        idx++;

        // Track fairness
        if (code === 'N') {
          empNights[emp] = (empNights[emp] || 0) + 1;
          fairness[emp].nights++;
        }
        if (weekend) {
          empWeekends[emp] = (empWeekends[emp] || 0) + 1;
          fairness[emp].weekends++;
        }
        if (code.startsWith('E')) fairness[emp].earlyCount++;
        if (code.startsWith('L')) fairness[emp].lateCount++;
        fairness[emp].total++;

        // Build explanation
        const expKey = `${emp}_${day}`;
        const reasons = [];
        reasons.push('Verfügbar (kein Urlaub/Abwesenheit)');
        reasons.push(`Mitarbeiter im Schichtplan geführt`);
        if (code === 'N' && empNights[emp] <= 4) reasons.push('Nachtlimit nicht überschritten');
        const prevFairness = fairnessMap.get(emp);
        if (prevFairness && prevFairness.night_count > 3) {
          reasons.push('Fairnessausgleich: Vormonat hohe Nachtlast');
        }
        const preferred = preferredMap.get(emp);
        if (preferred) {
          const sameShiftColleagues = shifts.filter(s => s.day === day && preferred.includes(s.employee_name));
          if (sameShiftColleagues.length > 0) {
            reasons.push(`Wunschkollege ${sameShiftColleagues[0].employee_name} ebenfalls eingeteilt`);
          }
        }
        reasons.push(`Höchste Planungsbewertung unter verfügbaren Mitarbeitern`);
        explanations[expKey] = { employee: emp, day, code, reasons };
      }

      // Check remaining employees – those not assigned get 'frei' (no record needed, absence of shift = free)
      for (let i = idx; i < sorted.length; i++) {
        const emp = sorted[i];
        // Store explanation for non-assignment
        const expKey = `${emp}_${day}`;
        if (!explanations[expKey]) {
          explanations[expKey] = {
            employee: emp, day, code: null,
            reasons: ['Nicht eingeteilt: Genügend andere Mitarbeiter verfügbar']
          };
        }
      }

      // Explanations for excluded employees
      for (const emp of employees) {
        if (excludedSet.has(emp)) {
          const expKey = `${emp}_${day}`;
          explanations[expKey] = {
            employee: emp, day, code: null,
            reasons: ['Dauerhaft von Ticketzuweisung ausgeschlossen']
          };
        }
      }
    }

    // 9. Compute next version number
    const verRes = await pool.query(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM shiftplan_drafts WHERE month = $1',
      [month]
    );
    const nextVersion = verRes.rows[0].next_version;

    // 10. Persist draft
    const { rows } = await pool.query(
      `INSERT INTO shiftplan_drafts (month, version, status, shifts_json, explanations, conflicts, fairness, config_snapshot, note, created_by)
       VALUES ($1, $2, 'draft', $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9) RETURNING *`,
      [
        month,
        nextVersion,
        JSON.stringify(shifts),
        JSON.stringify(explanations),
        JSON.stringify(conflicts),
        JSON.stringify(fairness),
        JSON.stringify({
          employees: employees.length,
          excluded: excludedSet.size,
          daysInMonth: numDays,
          staffingRules,
          generatedAt: new Date().toISOString(),
        }),
        note || null,
        createdBy,
      ]
    );

    res.json({ ok: true, draft: rows[0] });
  } catch (err) {
    console.error('Draft generation error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* UPDATE DRAFT STATUS                              */
/* ------------------------------------------------ */

router.patch('/drafts/:id/status', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['draft', 'in_review', 'approved', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: `Gültiger Status: ${validStatuses.join(', ')}` });
    }
    const actor = req.user?.email || req.user?.username || 'unknown';
    let sql, params;
    if (status === 'approved') {
      sql = `UPDATE shiftplan_drafts SET status = $2, approved_by = $3, approved_at = NOW(), note = COALESCE($4, note) WHERE id = $1 RETURNING *`;
      params = [parseInt(req.params.id), status, actor, note];
    } else {
      sql = `UPDATE shiftplan_drafts SET status = $2, note = COALESCE($3, note) WHERE id = $1 RETURNING *`;
      params = [parseInt(req.params.id), status, note];
    }
    const { rows } = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Draft nicht gefunden' });
    res.json({ ok: true, draft: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* ACTIVATE DRAFT → Overwrite live shiftplan        */
/* ------------------------------------------------ */

router.post('/drafts/:id/activate', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const draftId = parseInt(req.params.id);
    const actor = req.user?.email || req.user?.username || 'unknown';

    // Load draft
    const { rows: draftRows } = await client.query('SELECT * FROM shiftplan_drafts WHERE id = $1', [draftId]);
    if (!draftRows.length) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, error: 'Draft nicht gefunden' }); }
    const draft = draftRows[0];

    if (draft.status === 'activated') {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Dieser Draft wurde bereits aktiviert' });
    }

    const shifts = draft.shifts_json; // JSONB array
    const draftMonth = draft.month;

    // Build month label matching existing schema (e.g. "2026-04" or "April 2026")
    const monthKey = draftMonth; // Use raw YYYY-MM format

    // Delete existing shifts for this month
    await client.query('DELETE FROM shifts WHERE month = $1', [monthKey]);

    // Insert draft shifts
    for (const s of shifts) {
      await client.query(
        'INSERT INTO shifts (month, employee_name, day, shift_code) VALUES ($1, $2, $3, $4) ON CONFLICT (month, employee_name, day) DO UPDATE SET shift_code = $4',
        [monthKey, s.employee_name, s.day, s.shift_code]
      );
    }

    // Update draft status
    await client.query(
      `UPDATE shiftplan_drafts SET status = 'activated', activated_by = $2, activated_at = NOW() WHERE id = $1`,
      [draftId, actor]
    );

    await client.query('COMMIT');
    res.json({ ok: true, message: `Draft für ${draftMonth} wurde als aktiver Schichtplan übernommen`, activatedBy: actor });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Activation error:', err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

/* ------------------------------------------------ */
/* DELETE DRAFT                                     */
/* ------------------------------------------------ */

router.delete('/drafts/:id', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM shiftplan_drafts WHERE id = $1 AND status != 'activated' RETURNING *`,
      [parseInt(req.params.id)]
    );
    if (!rows.length) return res.status(400).json({ ok: false, error: 'Draft nicht gefunden oder bereits aktiviert' });
    res.json({ ok: true, deleted: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* EXCEL EXPORT                                     */
/* ------------------------------------------------ */

router.get('/drafts/:id/excel', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shiftplan_drafts WHERE id = $1', [parseInt(req.params.id)]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Draft nicht gefunden' });
    const draft = rows[0];
    const shifts = draft.shifts_json;
    const [year, mon] = draft.month.split('-').map(Number);
    const numDays = daysInMonth(year, mon);
    const monthNames = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const sheetName = `${monthNames[mon]} ${year}`;

    // Group by employee
    const byEmployee = {};
    for (const s of shifts) {
      if (!byEmployee[s.employee_name]) byEmployee[s.employee_name] = {};
      byEmployee[s.employee_name][s.day] = s.shift_code;
    }
    const empNames = Object.keys(byEmployee).sort();

    // Build CSV-like structure (will be served as downloadable file)
    // For real XLSX, we'd use exceljs, but let's build a clean HTML table export
    const headerRow = ['Mitarbeiter', ...Array.from({length: numDays}, (_, i) => String(i + 1))];

    let html = `<html><head><meta charset="utf-8"><style>
      body { font-family: Calibri, Arial, sans-serif; }
      h1 { color: #1e3a5f; font-size: 18px; margin-bottom: 4px; }
      h2 { color: #6b7280; font-size: 12px; font-weight: normal; margin-top: 0; }
      table { border-collapse: collapse; width: 100%; margin-top: 16px; }
      th { background-color: #1e3a5f; color: white; font-size: 11px; padding: 6px 4px; border: 1px solid #374151; text-align: center; }
      th:first-child { text-align: left; min-width: 140px; }
      td { font-size: 11px; padding: 5px 4px; border: 1px solid #d1d5db; text-align: center; }
      td:first-child { text-align: left; font-weight: bold; }
      .E1, .E2 { background-color: #dbeafe; color: #1e40af; }
      .L1, .L2 { background-color: #fef3c7; color: #92400e; }
      .N { background-color: #ede9fe; color: #5b21b6; }
      .weekend { background-color: #f3f4f6; }
      .footer { font-size: 10px; color: #9ca3af; margin-top: 12px; }
    </style></head><body>`;
    html += `<h1>ODIN Shiftplan Draft</h1>`;
    html += `<h2>${sheetName} — Version ${draft.version} — Status: ${draft.status} — Erstellt: ${new Date(draft.created_at).toLocaleDateString('de-DE')} von ${draft.created_by}</h2>`;
    html += `<table><thead><tr>`;
    for (const h of headerRow) html += `<th>${h}</th>`;
    html += `</tr></thead><tbody>`;

    for (const emp of empNames) {
      html += `<tr><td>${emp}</td>`;
      for (let d = 1; d <= numDays; d++) {
        const code = byEmployee[emp][d] || '';
        const we = isWeekend(year, mon, d);
        const cls = code ? code.replace(/\d/, '') + (code.match(/\d/) ? code.match(/\d/)[0] : '') : '';
        html += `<td class="${code} ${we ? 'weekend' : ''}">${code}</td>`;
      }
      html += `</tr>`;
    }

    html += `</tbody></table>`;
    html += `<div class="footer">Exportiert am ${new Date().toLocaleString('de-DE')} — ODIN Shiftplan Draft v${draft.version}</div>`;
    html += `</body></html>`;

    // Set headers for download as .xls (Excel accepts HTML tables)
    const filename = `ODIN_Shiftplan_Draft_${draft.month}_v${draft.version}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ------------------------------------------------ */
/* PLANNING BASIS (data used for generation)        */
/* ------------------------------------------------ */

router.get('/planning-basis', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ ok: false, error: 'month parameter required' });

    const [year, mon] = month.split('-').map(Number);
    const numDays = daysInMonth(year, mon);

    // Employees
    const empRes = await pool.query(`SELECT DISTINCT employee_name FROM shifts ORDER BY employee_name LIMIT 100`);
    const employees = deduplicateEmployees(empRes.rows.map(r => r.employee_name));

    // Absences
    const absRes = await pool.query(
      `SELECT employee_name, start_date, end_date, type FROM absences WHERE start_date <= $1 AND end_date >= $2`,
      [`${month}-${numDays}`, `${month}-01`]
    );

    // Exclusions
    const exclRes = await pool.query(
      `SELECT employee_name, reason, reason_text, valid_from, valid_to FROM assignment_employee_exclusions WHERE is_active = TRUE`
    );

    // Skills
    const skillsRes = await pool.query('SELECT * FROM employee_skills');

    // Staffing rules
    const staffRes = await pool.query('SELECT * FROM staffing_rules');

    // Wellbeing (previous month)
    const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`;
    const wbRes = await pool.query(
      `SELECT * FROM wellbeing_metrics WHERE year = $1 AND month = $2`,
      [prevMonth.split('-')[0], parseInt(prevMonth.split('-')[1])]
    );

    // Preferred colleagues
    const prefRes = await pool.query(
      `SELECT pc.*, u.first_name || ' ' || u.last_name as requester_name FROM preferred_colleagues pc JOIN users u ON u.id = pc.user_id`
    );

    res.json({
      ok: true,
      basis: {
        employees,
        absences: absRes.rows,
        exclusions: exclRes.rows,
        skills: skillsRes.rows,
        staffingRules: staffRes.rows,
        wellbeing: wbRes.rows,
        preferredColleagues: prefRes.rows,
        month,
        daysInMonth: numDays,
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
