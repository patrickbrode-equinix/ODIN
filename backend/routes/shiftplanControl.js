/* ================================================ */
/* Shiftplan Control Center – API Routes            */
/* Draft generation, conflicts, Excel, activation   */
/* DETERMINISTIC, rule-based planning engine         */
/* ================================================ */

import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePageAccess } from '../middleware/requirePageAccess.js';
import pool from '../db.js';
import ExcelJS from 'exceljs';
import { recomputeConstraintsInternal } from './constraints.js';
import { syncEmployeeContacts } from './employeeContacts.js';
import { provisionUsersFromShiftplan } from '../services/shiftUserProvisioning.service.js';
import {
  formatShiftMonthLabel,
  monthLabelMatchesYear,
  parseDraftMonthId,
} from '../lib/shiftplanMonth.js';
import {
  buildDailyShiftSlots,
  buildShiftSlots,
  buildStaffingRulesByShiftType,
  getShiftDurationHours,
} from '../lib/shiftplanGeneration.js';

const router = express.Router();
router.use(requireAuth);

/* ------------------------------------------------ */
/* SHIFT CODES & HELPERS                            */
/* ------------------------------------------------ */

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function isWeekend(year, month, day) {
  const d = new Date(year, month - 1, day);
  return d.getDay() === 0 || d.getDay() === 6;
}

function dayOfWeek(year, month, day) {
  return new Date(year, month - 1, day).getDay(); // 0=Sun, 6=Sat
}

/**
 * Normalize employee name: trim, collapse whitespace.
 * Filters out entries that look like email addresses.
 */
function normalizeEmployeeName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Deduplicate employees by normalized name (case-insensitive).
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

async function loadEmployeesForPlanningYear(year) {
  let yearPlanEmployees = [];

  if (Number(year) === 2027) {
    try {
      const { rows: yearPlanRows } = await pool.query(
        `SELECT DISTINCT employee_name
         FROM year_plan_2027
         WHERE employee_name IS NOT NULL AND btrim(employee_name) <> ''`
      );
      yearPlanEmployees = yearPlanRows.map((row) => row.employee_name);
    } catch (error) {
      console.warn('[SHIFTPLAN CONTROL] year_plan_2027 could not be queried:', error.message);
    }
  }

  const { rows } = await pool.query(
    `SELECT DISTINCT month, employee_name
     FROM shifts
     WHERE employee_name IS NOT NULL AND btrim(employee_name) <> ''`
  );

  const yearScopedEmployees = deduplicateEmployees(
    [...yearPlanEmployees, ...rows
      .filter((row) => monthLabelMatchesYear(row.month, year))
      .map((row) => row.employee_name)]
  );

  if (yearScopedEmployees.length > 0) {
    return yearScopedEmployees;
  }

  return deduplicateEmployees([...yearPlanEmployees, ...rows.map((row) => row.employee_name)]);
}

const WELLBEING_HISTORY_COLUMNS = ['employee_name', 'night_count', 'weekend_count', 'early_count', 'late_count'];
const WELLBEING_REQUIRED_COLUMNS = new Set(['employee_name', 'night_count', 'weekend_count']);

async function loadWellbeingHistory(year, month) {
  const params = [String(year), Number(month)];

  try {
    const result = await pool.query(
      `SELECT employee_name, night_count, weekend_count, early_count, late_count
       FROM wellbeing_metrics
       WHERE year = $1 AND month = $2`,
      params
    );
    return result.rows;
  } catch (error) {
    if (error?.code !== '42703') throw error;

    const columnsRes = await pool.query(
      `SELECT DISTINCT column_name
       FROM information_schema.columns
       WHERE table_name = 'wellbeing_metrics'
         AND column_name = ANY($1::text[])`,
      [WELLBEING_HISTORY_COLUMNS]
    );
    const availableColumns = new Set(columnsRes.rows.map((row) => row.column_name));
    const selectList = WELLBEING_HISTORY_COLUMNS.map((column) => {
      if (availableColumns.has(column) || WELLBEING_REQUIRED_COLUMNS.has(column)) {
        return column;
      }
      return `0::integer AS ${column}`;
    }).join(', ');

    console.warn('[SHIFTPLAN CONTROL] wellbeing_metrics is missing optional legacy columns; using 0 defaults for absent counters');

    const fallbackResult = await pool.query(
      `SELECT ${selectList}
       FROM wellbeing_metrics
       WHERE year = $1 AND month = $2`,
      params
    );
    return fallbackResult.rows;
  }
}

/* ------------------------------------------------ */
/* DETERMINISTIC PLANNING ENGINE                    */
/* Fully rule-based, reproducible, no randomness    */
/* ------------------------------------------------ */

/**
 * Generate a complete shift plan for one month deterministically.
 * 
 * Algorithm:
 * 1. Load all config (shift definitions, rotation rules, fairness rules, planning config)
 * 2. Load all employee data (exclusions, absences, preferences, skills, wellbeing history)
 * 3. For each day in month:
 *    a. Determine available employees (not absent, not excluded)
 *    b. For each active shift definition (sorted by sort_order):
 *       - Build candidate list from available employees
 *       - Score each candidate based on:
 *         * Fairness: how many shifts they already have (lower = better)
 *         * Night balance: fewer previous nights = better for night shifts
 *         * Weekend balance: fewer previous weekends = better for weekend shifts
 *         * Rotation rules: check consecutive days, forbidden transitions
 *         * Employee preferences: preferred/unwanted shifts
 *         * Colleague preferences: preferred colleagues on same day
 *       - Sort candidates by score (deterministic tiebreak by name)
 *       - Assign top candidate
 *    c. Track all assignments and generate explanations
 * 4. Validate entire plan against all rules
 * 5. Generate conflict list and fairness metrics
 */
async function generateShiftPlan(year, mon, numDays, createdBy) {
  // 1. Load configuration
  const defRes = await pool.query('SELECT * FROM shift_definitions WHERE is_active=TRUE ORDER BY sort_order, code');
  const shiftDefs = defRes.rows.length > 0 ? defRes.rows : [
    { code: 'E1', name: 'Frühschicht 1', shift_type: 'early', min_staff: 1, max_staff: 5, color_hex: '#3b82f6', sort_order: 1 },
    { code: 'E2', name: 'Frühschicht 2', shift_type: 'early', min_staff: 1, max_staff: 5, color_hex: '#60a5fa', sort_order: 2 },
    { code: 'L1', name: 'Spätschicht 1', shift_type: 'late', min_staff: 1, max_staff: 5, color_hex: '#f59e0b', sort_order: 3 },
    { code: 'L2', name: 'Spätschicht 2', shift_type: 'late', min_staff: 1, max_staff: 5, color_hex: '#fbbf24', sort_order: 4 },
    { code: 'N', name: 'Nachtschicht', shift_type: 'night', min_staff: 1, max_staff: 3, color_hex: '#8b5cf6', sort_order: 5 },
  ];

  const rotRes = await pool.query('SELECT * FROM shift_rotation_rules WHERE id=1');
  const rotation = rotRes.rows[0] || {
    max_consecutive_same: 5, max_consecutive_workdays: 6, min_free_after_streak: 1,
    night_to_early_forbidden: true, late_to_early_forbidden: true,
    min_hours_between_shifts: 11, max_nights_per_month: 7, max_weekends_per_month: 2, weekend_rule: 'balanced',
    free_days_after_night: 2, free_days_after_weekend: 1,
  };

  const fairRes = await pool.query('SELECT * FROM shift_fairness_rules WHERE id=1');
  const fairnessRules = fairRes.rows[0] || {
    balance_nights: true, balance_weekends: true, balance_total_load: true,
    max_deviation_percent: 20, fairness_vs_preference: 'fairness',
  };

  const planRes = await pool.query('SELECT * FROM shift_planning_config WHERE id=1');
  const planConfig = planRes.rows[0] || {
    respect_employee_wishes: true, hard_rules_priority: 100, soft_wishes_priority: 50,
    fairness_priority: 80, admin_override_priority: 90, monthly_target_hours: 174,
  };

  const specialPoolRes = await pool.query(
    `SELECT shift_code, employee_name, monthly_max_assignments
     FROM shift_special_pools
     WHERE is_active = TRUE`
  );
  const specialPoolsByShift = new Map();
  for (const row of specialPoolRes.rows) {
    const shiftCode = String(row.shift_code || '').trim().toUpperCase();
    const employeeName = row.employee_name;
    if (!shiftCode || !employeeName) continue;
    if (!specialPoolsByShift.has(shiftCode)) specialPoolsByShift.set(shiftCode, new Map());
    specialPoolsByShift.get(shiftCode).set(employeeName, {
      monthlyMaxAssignments: Math.max(Number.parseInt(String(row.monthly_max_assignments ?? 0), 10) || 0, 0),
    });
  }

  const month = `${year}-${String(mon).padStart(2, '0')}`;

  // 2. Load employees
  let employees = await loadEmployeesForPlanningYear(year);
  if (employees.length === 0) {
    throw new Error('Keine Mitarbeiter im System gefunden');
  }

  // 3. Load absences
  const absRes = await pool.query(
    `SELECT employee_name, start_date, end_date, type FROM absences WHERE start_date <= $1 AND end_date >= $2`,
    [`${month}-${numDays}`, `${month}-01`]
  );
  const absenceMap = new Map();
  for (const a of absRes.rows) {
    if (!absenceMap.has(a.employee_name)) absenceMap.set(a.employee_name, []);
    absenceMap.get(a.employee_name).push(a);
  }

  // 4. Load shiftplan exclusions (dedicated table)
  const exclRes = await pool.query(
    `SELECT employee_name FROM shiftplan_exclusions WHERE is_active = TRUE`
  );
  const shiftExcludedSet = new Set(exclRes.rows.map(r => r.employee_name));

  // Also load assignment exclusions as fallback
  const assignExclRes = await pool.query(
    `SELECT employee_name FROM assignment_employee_exclusions WHERE is_active = TRUE AND (valid_from IS NULL OR valid_from <= $1) AND (valid_to IS NULL OR valid_to >= $2)`,
    [`${month}-${numDays}`, `${month}-01`]
  );
  for (const r of assignExclRes.rows) shiftExcludedSet.add(r.employee_name);

  // 5. Load employee skills
  const skillsRes = await pool.query('SELECT * FROM employee_skills');
  const skillsMap = new Map();
  for (const s of skillsRes.rows) skillsMap.set(s.employee_name, s);

  // 6. Load wellbeing metrics (previous month)
  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`;
  const prevMonthParts = prevMonth.split('-');
  const wellbeingRows = await loadWellbeingHistory(prevMonthParts[0], Number.parseInt(prevMonthParts[1], 10));
  const historyMap = new Map();
  for (const w of wellbeingRows) historyMap.set(w.employee_name, w);

  // 7. Load preferred colleagues
  const prefRes = await pool.query(
    `SELECT pc.user_id, u.first_name || ' ' || u.last_name as requester_name, pc.preferred_employee_name
     FROM preferred_colleagues pc JOIN users u ON u.id = pc.user_id`
  );
  const preferredMap = new Map();
  for (const p of prefRes.rows) {
    if (!preferredMap.has(p.requester_name)) preferredMap.set(p.requester_name, []);
    preferredMap.get(p.requester_name).push(p.preferred_employee_name);
  }

  // 8. Load employee preferences
  const empPrefRes = await pool.query(
    `SELECT ep.*, u.first_name || ' ' || u.last_name as employee_name FROM employee_preferences ep JOIN users u ON u.id = ep.user_id`
  );
  const empPrefsMap = new Map();
  for (const p of empPrefRes.rows) empPrefsMap.set(p.employee_name, p);

  // 9. Load staffing rules
  const staffRes = await pool.query('SELECT * FROM staffing_rules');
  const staffingRules = buildStaffingRulesByShiftType(staffRes.rows);

  // ================================================================
  // DETERMINISTIC SHIFT GENERATION
  // ================================================================

  const shifts = [];
  const explanations = {};
  const conflicts = [];
  const planReport = {
    totalEmployees: employees.length,
    excludedEmployees: shiftExcludedSet.size,
    activeEmployees: 0,
    totalShiftsPlanned: 0,
    conflictsCount: 0,
    wishesRespected: 0,
    wishesDenied: 0,
    rulesApplied: [],
  };

  // Per-employee tracking
  const empStats = {};
  const empDayAssignment = {}; // emp -> { day: shiftCode }
  const empConsecutiveWork = {}; // emp -> current consecutive work days
  const empLastShiftType = {}; // emp -> last assigned shift type
  const empRequiredFreeDays = {}; // emp -> remaining forced recovery days
  const empHours = {}; // emp -> actual planned hours
  const empRecoveryReason = {}; // emp -> reason for pending free days

  const activeEmployees = employees.filter(e => !shiftExcludedSet.has(e));
  planReport.activeEmployees = activeEmployees.length;
  const targetHours = Math.max(Number.parseFloat(String(planConfig.monthly_target_hours ?? 174)) || 174, 1);
  const baselineShiftSlots = buildShiftSlots(shiftDefs, staffingRules);

  for (const emp of activeEmployees) {
    empStats[emp] = { nights: 0, weekends: 0, earlyCount: 0, lateCount: 0, total: 0, actualHours: 0, targetHours, specialShiftCounts: {} };
    empDayAssignment[emp] = {};
    empConsecutiveWork[emp] = 0;
    empLastShiftType[emp] = null;
    empRequiredFreeDays[emp] = 0;
    empHours[emp] = 0;
    empRecoveryReason[emp] = null;
  }

  // Process each day
  for (let day = 1; day <= numDays; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const weekend = isWeekend(year, mon, day);
    const dow = dayOfWeek(year, mon, day);

    // Determine available employees for this day
    const availableForDay = activeEmployees.filter(emp => {
      // Check absence
      const absences = absenceMap.get(emp) || [];
      for (const ab of absences) {
        const abStart = new Date(ab.start_date);
        const abEnd = new Date(ab.end_date);
        const thisDate = new Date(dateStr);
        if (thisDate >= abStart && thisDate <= abEnd) return false;
      }
      if (empRequiredFreeDays[emp] > 0) return false;
      // Check max consecutive workdays
      if (empConsecutiveWork[emp] >= rotation.max_consecutive_workdays) return false;
      return true;
    });

    // Track who gets assigned today
    const assignedToday = new Set();
    const shiftSlots = buildDailyShiftSlots({
      shiftDefinitions: shiftDefs,
      staffingRules,
      activeEmployees,
      employeeHours: empHours,
      monthlyTargetHours: targetHours,
      day,
      numDays,
      dayOfWeek: dow,
    }).sort((left, right) => {
      const leftPriority = specialPoolsByShift.has(left.code) ? 0 : 1;
      const rightPriority = specialPoolsByShift.has(right.code) ? 0 : 1;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const leftSort = Number.parseInt(String(left.sort_order ?? 0), 10) || 0;
      const rightSort = Number.parseInt(String(right.sort_order ?? 0), 10) || 0;
      if (leftSort !== rightSort) return leftSort - rightSort;
      return String(left.code || '').localeCompare(String(right.code || ''), 'de');
    });

    // Process each shift definition
    for (const shiftDef of shiftSlots) {
      const neededStaff = shiftDef.planned_slots || shiftDef.min_staff || 1;

      for (let slot = 0; slot < neededStaff; slot++) {
        // Build candidate list (not yet assigned today)
        const candidates = availableForDay.filter(emp => !assignedToday.has(emp));

        if (candidates.length === 0) {
          conflicts.push({
            day, date: dateStr, shift: shiftDef.code, severity: 'critical',
            type: 'understaffed',
            message: `${shiftDef.name} (${shiftDef.code}) am ${dateStr}: Nicht genügend verfügbare Mitarbeiter (benötigt: ${neededStaff}, verfügbar: 0)`,
          });
          continue;
        }

        // Score each candidate (higher score = better candidate)
        const scored = candidates.map(emp => {
          let score = 1000; // base score
          const reasons = [];
          const stats = empStats[emp];
          const history = historyMap.get(emp);
          const prefs = empPrefsMap.get(emp);
          const specialPool = specialPoolsByShift.get(shiftDef.code);
          let hardBlocked = false;

          // === HARD RULES (violations = large penalty) ===

          // Rotation: forbidden transitions
          const lastType = empLastShiftType[emp];
          if (lastType === 'night' && shiftDef.shift_type === 'early' && rotation.night_to_early_forbidden) {
            hardBlocked = true;
            reasons.push('Regelverstoß: Nacht→Früh verboten');
          }
          if (lastType === 'late' && shiftDef.shift_type === 'early' && rotation.late_to_early_forbidden) {
            hardBlocked = true;
            reasons.push('Regelverstoß: Spät→Früh verboten');
          }

          // Max nights per month
          if (shiftDef.shift_type === 'night' && stats.nights >= rotation.max_nights_per_month) {
            hardBlocked = true;
            reasons.push(`Nachtlimit erreicht (${stats.nights}/${rotation.max_nights_per_month})`);
          }

          // Max weekends per month
          if (weekend && stats.weekends >= rotation.max_weekends_per_month) {
            hardBlocked = true;
            reasons.push(`Wochenendlimit erreicht (${stats.weekends}/${rotation.max_weekends_per_month})`);
          }

          // Max consecutive same shift type
          let consecutiveSame = 0;
          for (let d = day - 1; d >= 1; d--) {
            const prevCode = empDayAssignment[emp][d];
            if (!prevCode) break;
            const prevDef = shiftDefs.find(sd => sd.code === prevCode);
            if (prevDef && prevDef.shift_type === shiftDef.shift_type) consecutiveSame++;
            else break;
          }
          if (consecutiveSame >= rotation.max_consecutive_same) {
            hardBlocked = true;
            reasons.push(`Max. gleiche Schichtart in Folge erreicht (${consecutiveSame})`);
          }

          if (specialPool) {
            const poolEntry = specialPool.get(emp);
            if (!poolEntry) {
              hardBlocked = true;
              reasons.push(`Nicht im festen Pool für ${shiftDef.code}`);
            } else {
              const assignedCount = Number(stats.specialShiftCounts?.[shiftDef.code] || 0);
              if (assignedCount >= poolEntry.monthlyMaxAssignments) {
                hardBlocked = true;
                reasons.push(`${shiftDef.code}-Limit erreicht (${assignedCount}/${poolEntry.monthlyMaxAssignments})`);
              } else {
                score += 120;
                score -= assignedCount * 90;
                reasons.push(`Fester ${shiftDef.code}-Pool (${assignedCount}/${poolEntry.monthlyMaxAssignments})`);
              }
            }
          }

          if (hardBlocked) {
            return { emp, score: Number.NEGATIVE_INFINITY, reasons, hardBlocked: true };
          }

          // === FAIRNESS (soft scoring) ===

          // Total shift balance: prefer employees with fewer total shifts
          if (fairnessRules.balance_total_load) {
            const avgHours = activeEmployees.reduce((sum, e) => sum + empHours[e], 0) / activeEmployees.length || 0;
            const diffHours = empHours[emp] - avgHours;
            score -= diffHours * 8;
            if (diffHours < -8) reasons.push('Fairness: Weniger Stunden als Durchschnitt');
            if (diffHours > 8) reasons.push('Fairness: Mehr Stunden als Durchschnitt');
          }

          const remainingToTarget = targetHours - empHours[emp];
          score += remainingToTarget * 12;
          if (remainingToTarget > 16) reasons.push(`Sollzeit offen: ${remainingToTarget.toFixed(1)}h`);
          if (remainingToTarget < -8) reasons.push(`Bereits über Sollzeit: ${Math.abs(remainingToTarget).toFixed(1)}h`);

          if (shiftDef.shift_type === 'night' && rotation.free_days_after_night > 0) {
            score -= rotation.free_days_after_night * 25;
          }
          if (weekend && rotation.free_days_after_weekend > 0) {
            score -= rotation.free_days_after_weekend * 15;
          }

          // Night balance
          if (shiftDef.shift_type === 'night' && fairnessRules.balance_nights) {
            const avgNights = activeEmployees.reduce((sum, e) => sum + empStats[e].nights, 0) / activeEmployees.length || 0;
            score -= (stats.nights - avgNights) * 80;
            // Also consider previous month
            if (history && history.night_count > 3) {
              score -= 100;
              reasons.push('Fairnessausgleich: Hohe Nachtlast im Vormonat');
            }
          }

          // Weekend balance
          if (weekend && fairnessRules.balance_weekends) {
            const avgWe = activeEmployees.reduce((sum, e) => sum + empStats[e].weekends, 0) / activeEmployees.length || 0;
            score -= (stats.weekends - avgWe) * 80;
          }

          // === EMPLOYEE PREFERENCES ===
          if (planConfig.respect_employee_wishes && prefs) {
            const preferredShifts = prefs.preferred_shifts || [];
            const unwantedShifts = prefs.unwanted_shifts || [];
            const blockedDays = prefs.blocked_days || [];
            const preferredDays = prefs.preferred_days || [];
            const maxNights = prefs.max_nights_per_month;

            if (unwantedShifts.includes(shiftDef.code)) {
              score -= planConfig.soft_wishes_priority * 10;
              reasons.push(`Mitarbeiterwunsch: ${shiftDef.code} unerwünscht`);
            }
            if (preferredShifts.includes(shiftDef.code)) {
              score += planConfig.soft_wishes_priority * 5;
              reasons.push(`Mitarbeiterwunsch: ${shiftDef.code} bevorzugt`);
            }
            if (blockedDays.includes(dow)) {
              score -= planConfig.soft_wishes_priority * 15;
              reasons.push(`Mitarbeiterwunsch: Tag ${dow} gesperrt`);
            }
            if (preferredDays.includes(dow)) {
              score += planConfig.soft_wishes_priority * 3;
              reasons.push(`Mitarbeiterwunsch: Tag ${dow} bevorzugt`);
            }
            if (maxNights !== null && maxNights !== undefined && shiftDef.shift_type === 'night' && stats.nights >= maxNights) {
              score -= 1500;
              reasons.push(`Individuelles Nachtlimit erreicht (${stats.nights}/${maxNights})`);
            }

            // Avoid colleagues
            const avoidList = prefs.avoid_colleagues || [];
            if (avoidList.length > 0) {
              const dayShifts = shifts.filter(s => s.day === day);
              for (const avoid of avoidList) {
                if (dayShifts.some(s => s.employee_name === avoid)) {
                  score -= 200;
                  reasons.push(`Mitarbeiterwunsch: Vermeidet Kollege ${avoid}`);
                }
              }
            }
          }

          // === COLLEAGUE PREFERENCES ===
          const preferred = preferredMap.get(emp);
          if (preferred) {
            const dayShifts = shifts.filter(s => s.day === day);
            for (const pref of preferred) {
              if (dayShifts.some(s => s.employee_name === pref)) {
                score += 30;
                reasons.push(`Wunschkollege ${pref} ebenfalls eingeteilt`);
              }
            }
          }

          // Deterministic tiebreaker: alphabetical by name
          return { emp, score, reasons, hardBlocked: false };
        });

        const eligibleScored = scored.filter((entry) => Number.isFinite(entry.score));

        if (eligibleScored.length === 0) {
          const blockedPreview = scored
            .filter((entry) => entry.hardBlocked && entry.reasons.length > 0)
            .slice(0, 3)
            .map((entry) => `${entry.emp}: ${entry.reasons.join(', ')}`);
          conflicts.push({
            day, date: dateStr, shift: shiftDef.code, severity: 'critical',
            type: 'no_eligible_candidate',
            message: `${shiftDef.name} (${shiftDef.code}) am ${dateStr}: Keine zulässigen Kandidaten${blockedPreview.length > 0 ? ` (${blockedPreview.join(' | ')})` : ''}`,
          });
          continue;
        }

        // Sort by score descending, then name ascending for determinism
        eligibleScored.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.emp.localeCompare(b.emp, 'de');
        });

        const winner = eligibleScored[0];
        if (!winner) continue;

        const emp = winner.emp;
        shifts.push({ employee_name: emp, day, shift_code: shiftDef.code });
        assignedToday.add(emp);
        empDayAssignment[emp][day] = shiftDef.code;
        empLastShiftType[emp] = shiftDef.shift_type;
        empConsecutiveWork[emp]++;
        if (rotation.min_free_after_streak > 0 && empConsecutiveWork[emp] >= rotation.max_consecutive_workdays) {
          empRequiredFreeDays[emp] = Math.max(empRequiredFreeDays[emp], rotation.min_free_after_streak);
          empRecoveryReason[emp] = 'Arbeitsserie';
        }
        if (shiftDef.shift_type === 'night' && rotation.free_days_after_night > 0) {
          empRequiredFreeDays[emp] = Math.max(empRequiredFreeDays[emp], rotation.free_days_after_night);
          empRecoveryReason[emp] = 'Nachtschicht';
        }
        if (weekend && rotation.free_days_after_weekend > 0) {
          empRequiredFreeDays[emp] = Math.max(empRequiredFreeDays[emp], rotation.free_days_after_weekend);
          empRecoveryReason[emp] = 'Wochenendarbeit';
        }

        // Update stats
        const shiftHours = getShiftDurationHours(shiftDef);
        if (shiftDef.shift_type === 'night') empStats[emp].nights++;
        if (weekend) empStats[emp].weekends++;
        if (shiftDef.shift_type === 'early') empStats[emp].earlyCount++;
        if (shiftDef.shift_type === 'late') empStats[emp].lateCount++;
        empStats[emp].total++;
        empStats[emp].specialShiftCounts[shiftDef.code] = Number(empStats[emp].specialShiftCounts[shiftDef.code] || 0) + 1;
        empHours[emp] += shiftHours;
        empStats[emp].actualHours = Number(empHours[emp].toFixed(2));
        planReport.totalShiftsPlanned++;

        // Build explanation
        const expKey = `${emp}_${day}`;
        const allReasons = [
          'Verfügbar (kein Urlaub/Abwesenheit, nicht ausgeschlossen)',
          `Schicht: ${shiftDef.name} (${shiftDef.code})`,
          ...winner.reasons,
          `Planungsbewertung: ${winner.score} Punkte (Rang 1 von ${eligibleScored.length} zulässigen Kandidaten)`,
        ];
        explanations[expKey] = { employee: emp, day, code: shiftDef.code, reasons: allReasons, score: winner.score };

        // Track wishes
        const prefs = empPrefsMap.get(emp);
        if (prefs) {
          if ((prefs.preferred_shifts || []).includes(shiftDef.code)) planReport.wishesRespected++;
          if ((prefs.unwanted_shifts || []).includes(shiftDef.code)) planReport.wishesDenied++;
        }
      }
    }

    // Reset consecutive work for unassigned employees
    for (const emp of activeEmployees) {
      if (!assignedToday.has(emp)) {
        const recoveryDaysBefore = empRequiredFreeDays[emp];
        const recoveryReasonBefore = empRecoveryReason[emp];
        empConsecutiveWork[emp] = 0;
        empLastShiftType[emp] = null;
        if (empRequiredFreeDays[emp] > 0) {
          empRequiredFreeDays[emp] = Math.max(empRequiredFreeDays[emp] - 1, 0);
          if (empRequiredFreeDays[emp] === 0) empRecoveryReason[emp] = null;
        }
        // Explanation for non-assignment
        const expKey = `${emp}_${day}`;
        if (!explanations[expKey]) {
          const absences = absenceMap.get(emp) || [];
          const isAbsent = absences.some(ab => {
            const abStart = new Date(ab.start_date);
            const abEnd = new Date(ab.end_date);
            const thisDate = new Date(dateStr);
            return thisDate >= abStart && thisDate <= abEnd;
          });
          explanations[expKey] = {
            employee: emp, day, code: null,
            reasons: isAbsent ? ['Nicht eingeteilt: Abwesend (Urlaub/Krankheit)']
              : recoveryDaysBefore > 0 ? [`Nicht eingeteilt: Erholungstag nach ${recoveryReasonBefore || 'Belastung'} erforderlich (${recoveryDaysBefore} verbleibend)`]
              : ['Nicht eingeteilt: Genügend andere Mitarbeiter für alle Schichten verfügbar'],
          };
        }
      }
    }

    // Explanations for excluded employees
    for (const emp of employees) {
      if (shiftExcludedSet.has(emp)) {
        const expKey = `${emp}_${day}`;
        explanations[expKey] = {
          employee: emp, day, code: null,
          reasons: ['Von der Schichtplanung ausgeschlossen (Admin-Einstellung)'],
        };
      }
    }
  }

  // Build fairness data
  const fairness = {};
  for (const emp of activeEmployees) {
    fairness[emp] = {
      nights: empStats[emp].nights,
      weekends: empStats[emp].weekends,
      earlyCount: empStats[emp].earlyCount,
      lateCount: empStats[emp].lateCount,
      total: empStats[emp].total,
      actualHours: Number(empHours[emp].toFixed(2)),
      targetHours,
      deltaHours: Number((empHours[emp] - targetHours).toFixed(2)),
    };
  }

  planReport.conflictsCount = conflicts.length;
  planReport.rulesApplied = [
    `Rotationsregeln: Max ${rotation.max_consecutive_workdays} Arbeitstage, ${rotation.max_nights_per_month} Nächte/Monat`,
    `Freitage nach Nacht: ${rotation.free_days_after_night || 0}, nach Wochenendarbeit: ${rotation.free_days_after_weekend || 0}`,
    `Monatliche Sollzeit: ${targetHours} Stunden`,
    `Fairnessregeln: Nächte=${fairnessRules.balance_nights ? 'Ja' : 'Nein'}, Wochenenden=${fairnessRules.balance_weekends ? 'Ja' : 'Nein'}`,
    `Wünsche berücksichtigt: ${planConfig.respect_employee_wishes ? 'Ja' : 'Nein'} (Gewichtung ${planConfig.soft_wishes_priority}%)`,
    `Harte Regeln Priorität: ${planConfig.hard_rules_priority}%`,
    `Fairness Priorität: ${planConfig.fairness_priority}%`,
  ];

  return {
    month,
    shifts,
    explanations,
    conflicts,
    fairness,
    planReport,
    configSnapshot: {
      employees: employees.length,
      activeEmployees: activeEmployees.length,
      excluded: shiftExcludedSet.size,
      daysInMonth: numDays,
      shiftDefinitions: shiftDefs.map(d => ({ code: d.code, name: d.name, type: d.shift_type, minStaff: d.min_staff, maxStaff: d.max_staff, durationHours: getShiftDurationHours(d) })),
      rotationRules: rotation,
      fairnessRules,
      planningConfig: planConfig,
      staffingRules,
      specialPools: Object.fromEntries(
        [...specialPoolsByShift.entries()].map(([shiftCode, entries]) => [
          shiftCode,
          [...entries.entries()].map(([employeeName, value]) => ({ employeeName, monthlyMaxAssignments: value.monthlyMaxAssignments })),
        ])
      ),
      effectiveShiftSlots: baselineShiftSlots.map(d => ({ code: d.code, type: d.shift_type, plannedSlots: d.planned_slots, durationHours: getShiftDurationHours(d) })),
      generatedAt: new Date().toISOString(),
    },
  };
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

/* ------------------------------------------------ */
/* GENERATE DRAFT (deterministic engine)            */
/* ------------------------------------------------ */

router.post('/drafts/generate', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { month, note } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ ok: false, error: 'Gültiges Monatsformat erforderlich (YYYY-MM)' });
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr);
    const mon = parseInt(monthStr);
    const numDays = daysInMonth(year, mon);
    const createdBy = req.user?.email || req.user?.username || 'system';

    const result = await generateShiftPlan(year, mon, numDays, createdBy);

    // Compute next version number
    const verRes = await pool.query(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM shiftplan_drafts WHERE month = $1',
      [month]
    );
    const nextVersion = verRes.rows[0].next_version;

    // Persist draft
    const { rows } = await pool.query(
      `INSERT INTO shiftplan_drafts (month, version, status, shifts_json, explanations, conflicts, fairness, config_snapshot, note, created_by)
       VALUES ($1, $2, 'draft', $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9) RETURNING *`,
      [
        month, nextVersion,
        JSON.stringify(result.shifts),
        JSON.stringify(result.explanations),
        JSON.stringify(result.conflicts),
        JSON.stringify(result.fairness),
        JSON.stringify({ ...result.configSnapshot, planReport: result.planReport }),
        note || null,
        createdBy,
      ]
    );

    res.json({ ok: true, draft: rows[0], planReport: result.planReport });
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
    const parsedDraftMonth = parseDraftMonthId(draftMonth);

    if (!parsedDraftMonth) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Ungültiges Draft-Monatsformat' });
    }

    // Build month label matching existing schema (e.g. "2026-04" or "April 2026")
    const liveMonthLabel = formatShiftMonthLabel(parsedDraftMonth.year, parsedDraftMonth.month);

    if (!liveMonthLabel) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'Monatslabel konnte nicht erzeugt werden' });
    }

    // Delete existing shifts for this month. Also clean up legacy rows written with the raw YYYY-MM key.
    await client.query('DELETE FROM shifts WHERE month = $1 OR month = $2', [liveMonthLabel, draftMonth]);

    // Insert draft shifts
    for (const s of shifts) {
      await client.query(
        'INSERT INTO shifts (month, employee_name, day, shift_code) VALUES ($1, $2, $3, $4) ON CONFLICT (month, employee_name, day) DO UPDATE SET shift_code = $4',
        [liveMonthLabel, s.employee_name, s.day, s.shift_code]
      );
    }

    // Update draft status
    await client.query(
      `UPDATE shiftplan_drafts SET status = 'activated', activated_by = $2, activated_at = NOW() WHERE id = $1`,
      [draftId, actor]
    );

    await client.query('COMMIT');

    let contactSync = null;
    let userProvisioning = null;
    try {
      contactSync = await syncEmployeeContacts();
    } catch (contactErr) {
      console.warn('[SHIFTPLAN CONTROL] Employee contacts sync failed:', contactErr.message);
      contactSync = { error: contactErr.message };
    }

    try {
      userProvisioning = await provisionUsersFromShiftplan();
    } catch (provisionErr) {
      console.warn('[SHIFTPLAN CONTROL] User provisioning failed:', provisionErr.message);
      userProvisioning = { error: provisionErr.message };
    }

    recomputeConstraintsInternal(liveMonthLabel).catch((constraintErr) => {
      console.warn('[SHIFTPLAN CONTROL] Constraint recompute failed:', constraintErr.message);
    });

    res.json({ ok: true, message: `Draft für ${liveMonthLabel} wurde als aktiver Schichtplan übernommen`, activatedBy: actor, liveMonthLabel, contactSync, userProvisioning });
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
/* EXCEL EXPORT – Professional .xlsx with exceljs   */
/* ------------------------------------------------ */

const MONTH_NAMES_DE = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const DAY_NAMES_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const SHIFT_COLORS = {
  E1: { fill: 'DBEAFE', font: '1E40AF' },
  E2: { fill: 'BFDBFE', font: '1E40AF' },
  L1: { fill: 'FEF3C7', font: '92400E' },
  L2: { fill: 'FDE68A', font: '92400E' },
  N:  { fill: 'EDE9FE', font: '5B21B6' },
  FS: { fill: 'D1FAE5', font: '065F46' },
  ABW:{ fill: 'FEE2E2', font: '991B1B' },
  DBS:{ fill: 'E0E7FF', font: '3730A3' },
  S:  { fill: 'F3F4F6', font: '374151' },
};

async function buildExcelWorkbook(drafts) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ODIN Shiftplan';
  workbook.created = new Date();

  for (const draft of drafts) {
    const shifts = draft.shifts_json;
    const [year, mon] = draft.month.split('-').map(Number);
    const numDays = daysInMonth(year, mon);
    const sheetName = `${MONTH_NAMES_DE[mon]} ${year}`;

    const ws = workbook.addWorksheet(sheetName);

    // Group shifts by employee
    const byEmployee = {};
    for (const s of shifts) {
      if (!byEmployee[s.employee_name]) byEmployee[s.employee_name] = {};
      byEmployee[s.employee_name][s.day] = s.shift_code;
    }
    const empNames = Object.keys(byEmployee).sort((a, b) => a.localeCompare(b, 'de'));

    // Title row
    ws.mergeCells(1, 1, 1, numDays + 2);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = `ODIN Schichtplan – ${sheetName}`;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: '1E3A5F' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(1).height = 28;

    // Subtitle row
    ws.mergeCells(2, 1, 2, numDays + 2);
    const subCell = ws.getCell(2, 1);
    subCell.value = `Version ${draft.version} | Status: ${draft.status} | Erstellt: ${new Date(draft.created_at).toLocaleDateString('de-DE')} von ${draft.created_by}`;
    subCell.font = { name: 'Calibri', size: 9, color: { argb: '6B7280' } };
    ws.getRow(2).height = 18;

    // Day-of-week row (row 3)
    ws.getCell(3, 1).value = '';
    ws.getCell(3, 1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    ws.getCell(3, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A5F' } };
    for (let d = 1; d <= numDays; d++) {
      const dow = new Date(year, mon - 1, d).getDay();
      const cell = ws.getCell(3, d + 1);
      cell.value = DAY_NAMES_DE[dow];
      cell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dow === 0 || dow === 6 ? '4B5563' : '1E3A5F' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = { top: { style: 'thin', color: { argb: '374151' } }, bottom: { style: 'thin', color: { argb: '374151' } }, left: { style: 'thin', color: { argb: '374151' } }, right: { style: 'thin', color: { argb: '374151' } } };
    }
    // Stats header
    const statsCol = numDays + 2;
    ws.getCell(3, statsCol).value = 'Σ';
    ws.getCell(3, statsCol).font = { name: 'Calibri', size: 8, bold: true, color: { argb: 'FFFFFF' } };
    ws.getCell(3, statsCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A5F' } };
    ws.getCell(3, statsCol).alignment = { horizontal: 'center' };

    // Header row (row 4) – day numbers
    ws.getCell(4, 1).value = 'Mitarbeiter';
    ws.getCell(4, 1).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    ws.getCell(4, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A5F' } };
    ws.getCell(4, 1).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
    for (let d = 1; d <= numDays; d++) {
      const dow = new Date(year, mon - 1, d).getDay();
      const cell = ws.getCell(4, d + 1);
      cell.value = d;
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dow === 0 || dow === 6 ? '4B5563' : '1E3A5F' } };
      cell.alignment = { horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
    }
    ws.getCell(4, statsCol).value = 'Gesamt';
    ws.getCell(4, statsCol).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    ws.getCell(4, statsCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A5F' } };
    ws.getCell(4, statsCol).alignment = { horizontal: 'center' };
    ws.getRow(4).height = 22;

    // Data rows
    empNames.forEach((emp, idx) => {
      const row = idx + 5;
      const nameCell = ws.getCell(row, 1);
      nameCell.value = emp;
      nameCell.font = { name: 'Calibri', size: 9, bold: true };
      nameCell.border = { top: { style: 'thin', color: { argb: 'D1D5DB' } }, bottom: { style: 'thin', color: { argb: 'D1D5DB' } }, left: { style: 'thin', color: { argb: 'D1D5DB' } }, right: { style: 'thin', color: { argb: 'D1D5DB' } } };
      if (idx % 2 === 1) nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };

      let total = 0;
      for (let d = 1; d <= numDays; d++) {
        const code = byEmployee[emp][d] || '';
        const cell = ws.getCell(row, d + 1);
        cell.value = code;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 9 };
        cell.border = { top: { style: 'thin', color: { argb: 'D1D5DB' } }, bottom: { style: 'thin', color: { argb: 'D1D5DB' } }, left: { style: 'thin', color: { argb: 'D1D5DB' } }, right: { style: 'thin', color: { argb: 'D1D5DB' } } };

        const colors = SHIFT_COLORS[code];
        if (colors) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } };
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: colors.font } };
          total++;
        } else {
          const dow = new Date(year, mon - 1, d).getDay();
          if (dow === 0 || dow === 6) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } };
          } else if (idx % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };
          }
        }
      }

      // Total shifts column
      const totalCell = ws.getCell(row, statsCol);
      totalCell.value = total;
      totalCell.alignment = { horizontal: 'center' };
      totalCell.font = { name: 'Calibri', size: 9, bold: true };
      totalCell.border = { top: { style: 'thin', color: { argb: 'D1D5DB' } }, bottom: { style: 'thin', color: { argb: 'D1D5DB' } }, left: { style: 'thin', color: { argb: 'D1D5DB' } }, right: { style: 'thin', color: { argb: 'D1D5DB' } } };
    });

    // Column widths
    ws.getColumn(1).width = 22;
    for (let d = 1; d <= numDays; d++) ws.getColumn(d + 1).width = 4.5;
    ws.getColumn(statsCol).width = 7;

    // Legend row
    const legendRow = empNames.length + 6;
    ws.getCell(legendRow, 1).value = 'Legende:';
    ws.getCell(legendRow, 1).font = { name: 'Calibri', size: 9, bold: true };
    let col = 2;
    for (const [code, colors] of Object.entries(SHIFT_COLORS)) {
      const cell = ws.getCell(legendRow, col);
      cell.value = code;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } };
      cell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: colors.font } };
      cell.alignment = { horizontal: 'center' };
      col++;
    }

    // Footer
    const footerRow = empNames.length + 8;
    ws.getCell(footerRow, 1).value = `Exportiert am ${new Date().toLocaleString('de-DE')} — ODIN Schichtplan v${draft.version}`;
    ws.getCell(footerRow, 1).font = { name: 'Calibri', size: 8, color: { argb: '9CA3AF' } };

    // Print setup
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    ws.headerFooter = { oddFooter: `&L ODIN Schichtplan &C ${sheetName} &R Seite &P von &N` };
  }

  // If multiple months, add summary sheet
  if (drafts.length > 1) {
    const summaryWs = workbook.addWorksheet('Jahresübersicht');
    summaryWs.getCell(1, 1).value = 'ODIN Schichtplan – Jahresübersicht';
    summaryWs.getCell(1, 1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: '1E3A5F' } };
    summaryWs.mergeCells(1, 1, 1, 6);

    const headers = ['Monat', 'Version', 'Status', 'Schichten', 'Mitarbeiter', 'Konflikte'];
    headers.forEach((h, i) => {
      const cell = summaryWs.getCell(3, i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A5F' } };
      cell.alignment = { horizontal: 'center' };
    });

    drafts.forEach((d, idx) => {
      const row = idx + 4;
      const [y, m] = d.month.split('-').map(Number);
      summaryWs.getCell(row, 1).value = `${MONTH_NAMES_DE[m]} ${y}`;
      summaryWs.getCell(row, 2).value = d.version;
      summaryWs.getCell(row, 3).value = d.status;
      summaryWs.getCell(row, 4).value = d.shifts_json?.length || 0;
      summaryWs.getCell(row, 5).value = new Set((d.shifts_json || []).map(s => s.employee_name)).size;
      summaryWs.getCell(row, 6).value = d.conflicts?.length || 0;
      for (let c = 1; c <= 6; c++) {
        summaryWs.getCell(row, c).font = { name: 'Calibri', size: 9 };
        summaryWs.getCell(row, c).alignment = { horizontal: 'center' };
        summaryWs.getCell(row, c).border = { bottom: { style: 'thin', color: { argb: 'D1D5DB' } } };
      }
      summaryWs.getCell(row, 1).alignment = { horizontal: 'left' };
    });

    summaryWs.getColumn(1).width = 20;
    for (let c = 2; c <= 6; c++) summaryWs.getColumn(c).width = 14;
  }

  return workbook;
}

router.get('/drafts/:id/excel', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shiftplan_drafts WHERE id = $1', [parseInt(req.params.id)]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Draft nicht gefunden' });
    const draft = rows[0];

    const workbook = await buildExcelWorkbook([draft]);
    const filename = `ODIN_Schichtplan_${draft.month}_v${draft.version}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* Year Excel Export – all 12 months in one workbook */
router.get('/drafts/year-excel/:year', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    if (!year) return res.status(400).json({ ok: false, error: 'Jahr erforderlich' });

    // Get latest draft for each month of the year
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (month) * FROM shiftplan_drafts WHERE month LIKE $1 ORDER BY month, version DESC`,
      [`${year}-%`]
    );

    if (!rows.length) return res.status(404).json({ ok: false, error: `Keine Drafts für ${year} gefunden` });

    const workbook = await buildExcelWorkbook(rows);
    const filename = `ODIN_Jahresschichtplan_${year}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Year Excel export error:', err);
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
    const employees = await loadEmployeesForPlanningYear(year);

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

/* ------------------------------------------------ */
/* GENERATE DRAFTS FOR FULL YEAR                    */
/* ------------------------------------------------ */

/* ------------------------------------------------ */
/* GENERATE DRAFTS FOR FULL YEAR                    */
/* ------------------------------------------------ */

router.post('/drafts/generate-year', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const { year, note } = req.body;
    const yearNum = parseInt(year);
    if (!yearNum || yearNum < 2020 || yearNum > 2040) {
      return res.status(400).json({ ok: false, error: 'Gültiges Jahr erforderlich (2020–2040)' });
    }

    console.log(`[SHIFTPLAN] Generating drafts for full year ${yearNum}`);
    const createdBy = req.user?.email || req.user?.username || 'system';
    const results = [];
    const errors = [];

    for (let mon = 1; mon <= 12; mon++) {
      const month = `${yearNum}-${String(mon).padStart(2, '0')}`;
      try {
        const numDays = daysInMonth(yearNum, mon);
        const result = await generateShiftPlan(yearNum, mon, numDays, createdBy);

        const verRes = await pool.query(
          'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM shiftplan_drafts WHERE month = $1',
          [month]
        );
        const nextVersion = verRes.rows[0].next_version;

        const { rows } = await pool.query(
          `INSERT INTO shiftplan_drafts (month, version, status, shifts_json, explanations, conflicts, fairness, config_snapshot, note, created_by)
           VALUES ($1, $2, 'draft', $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9) RETURNING id, month, version, status, created_at`,
          [
            month, nextVersion,
            JSON.stringify(result.shifts),
            JSON.stringify(result.explanations),
            JSON.stringify(result.conflicts),
            JSON.stringify(result.fairness),
            JSON.stringify({ ...result.configSnapshot, planReport: result.planReport }),
            note || `Jahresplanung ${yearNum}`,
            createdBy,
          ]
        );

        results.push({
          month,
          draftId: rows[0].id,
          version: nextVersion,
          shifts: result.shifts.length,
          conflicts: result.conflicts.length,
          employees: result.planReport.activeEmployees,
          wishesRespected: result.planReport.wishesRespected,
          wishesDenied: result.planReport.wishesDenied,
        });
        console.log(`[SHIFTPLAN] ${month}: Draft v${nextVersion} created (${result.shifts.length} shifts, ${result.conflicts.length} conflicts)`);
      } catch (monthErr) {
        console.error(`[SHIFTPLAN] ${month}: Error:`, monthErr.message);
        errors.push({ month, error: monthErr.message });
      }
    }

    console.log(`[SHIFTPLAN] Year ${yearNum}: ${results.length}/12 months generated, ${errors.length} errors`);
    res.json({ ok: true, year: yearNum, generated: results, errors, total: results.length });
  } catch (err) {
    console.error('Year generation error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
