/* ================================================ */
/* Shiftplan Control Center – API Routes            */
/* Draft generation, conflicts, Excel, activation   */
/* DETERMINISTIC, rule-based planning engine         */
/* ================================================ */

import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requirePageAccess } from '../middleware/requirePageAccess.js';
import pool from '../db.js';
import { config } from '../config/index.js';
import ExcelJS from 'exceljs';
import { recomputeConstraintsInternal } from './constraints.js';
import { syncEmployeeContacts } from './employeeContacts.js';
import { provisionUsersFromShiftplan } from '../services/shiftUserProvisioning.service.js';
import { ensureShiftplanSchema } from '../lib/ensureShiftplanSchema.js';
import {
  formatShiftMonthLabel,
  monthLabelMatchesYear,
  parseDraftMonthId,
} from '../lib/shiftplanMonth.js';
import { parseMonthLabel } from '../lib/monthParser.js';
import {
  buildDailyShiftSlots,
  buildShiftSlots,
  buildStaffingRulesByShiftType,
  applyFixedShiftSeriesPattern,
  canStartShiftSeries,
  getShiftContinuityAdjustment,
  getPreferenceShiftCode,
  getTargetHoursScore,
  getShiftSeriesDays,
  getShiftDurationHours,
  isShiftDefinitionDraftPlannable,
  normalizePlanningShiftTypeKey,
} from '../lib/shiftplanGeneration.js';
import {
  applyHolidayWorkPreferenceScore,
  getHolidayShiftStaffingLimit,
  normalizeHolidayStaffingConfig,
} from '../lib/holidayPreferences.js';

const router = express.Router();
router.use(requireAuth);
router.use(async (_req, _res, next) => {
  try {
    await ensureShiftplanSchema();
    next();
  } catch (error) {
    next(error);
  }
});

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

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildHessenHolidayMap(year) {
  const easter = easterSunday(year);
  const map = {
    [toIsoDate(new Date(year, 0, 1))]: 'Neujahr',
    [toIsoDate(addDays(easter, -2))]: 'Karfreitag',
    [toIsoDate(addDays(easter, 1))]: 'Ostermontag',
    [toIsoDate(new Date(year, 4, 1))]: 'Tag der Arbeit',
    [toIsoDate(addDays(easter, 39))]: 'Christi Himmelfahrt',
    [toIsoDate(addDays(easter, 50))]: 'Pfingstmontag',
    [toIsoDate(addDays(easter, 60))]: 'Fronleichnam',
    [toIsoDate(new Date(year, 9, 3))]: 'Tag der Deutschen Einheit',
    [toIsoDate(new Date(year, 11, 25))]: '1. Weihnachtstag',
    [toIsoDate(new Date(year, 11, 26))]: '2. Weihnachtstag',
  };

  return map;
}

function parseBooleanAppSetting(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return fallback;
}

function parseNumberAppSetting(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWeekdaySetting(value, fallback = [1, 2, 3, 4, 5]) {
  if (Array.isArray(value)) {
    return [...new Set(value
      .map((entry) => Number.parseInt(String(entry), 10))
      .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6))];
  }

  if (typeof value === 'string') {
    try {
      return normalizeWeekdaySetting(JSON.parse(value), fallback);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function parseTargetHoursValue(value, fallback = 174) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : fallback;
}

function getAnchoredSeriesDays(shiftDef, dayOfWeekIndex) {
  const configuredSeriesDays = getShiftSeriesDays(shiftDef);
  const typeKey = normalizePlanningShiftTypeKey(shiftDef?.shift_type);

  if (configuredSeriesDays <= 1) return configuredSeriesDays;
  if (!['early', 'late', 'night'].includes(typeKey || '')) return configuredSeriesDays;
  if (dayOfWeekIndex === 1) return configuredSeriesDays;

  const applicableDays = new Set(normalizeWeekdaySetting(shiftDef?.applicable_days, [0, 1, 2, 3, 4, 5, 6]));
  let partialSeriesDays = 0;
  for (let offset = 0; offset < configuredSeriesDays; offset++) {
    const currentDayOfWeek = (dayOfWeekIndex + offset) % 7;
    if (offset > 0 && currentDayOfWeek === 1) break;
    if (!applicableDays.has(currentDayOfWeek)) break;
    partialSeriesDays += 1;
  }
  return Math.max(partialSeriesDays, 1);
}

function getWeekendBlockKey(year, month, day) {
  const date = new Date(year, month - 1, day);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return toIsoDate(monday);
}

function countWeekendBlocks(year, month, numDays) {
  const keys = new Set();
  for (let day = 1; day <= numDays; day++) {
    if (isWeekend(year, month, day)) keys.add(getWeekendBlockKey(year, month, day));
  }
  return keys.size;
}

function getPlannedWeekendBlockKey(year, month, day, definition, numDays) {
  const applicableDays = new Set(normalizeWeekdaySetting(definition?.applicable_days, []));
  if (!applicableDays.has(6) && !applicableDays.has(0)) return null;

  const seriesDays = Math.min(getShiftSeriesDays(definition), Math.max(numDays - day + 1, 0));
  for (let offset = 0; offset < seriesDays; offset++) {
    const plannedDay = day + offset;
    const plannedDate = new Date(year, month - 1, plannedDay);
    if (applicableDays.has(plannedDate.getDay()) && (plannedDate.getDay() === 6 || plannedDate.getDay() === 0)) {
      return getWeekendBlockKey(year, month, plannedDay);
    }
  }
  return null;
}

const CREDITED_ABSENCE_TYPES = new Set(['VACATION', 'SICK', 'TRAINING']);
const CREDITED_ABSENCE_HOURS = 8;

function normalizeSkillText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SKILL_MATCH_ALIASES = {
  'Cross Connect': ['cross connect', 'crossconnect', ' cc '],
  'Metro Connect': ['metro connect', 'metroconnect', ' mc '],
  'Panel Installation': ['panel installation', 'panel'],
  'Deinstalls': ['deinstall', 'deinstalls', 'de install'],
  Power: ['power'],
  Migration: ['migration'],
  'Provide Access': ['provide access', 'access'],
  LOS: [' los '],
  'Colo Planung': ['colo planung', 'colo plan'],
  'Colo Ausfuhrung': ['colo ausfuhrung', 'colo ausfuhrung', 'colo ausf'],
  Antenne: ['antenne'],
  Begleitung: ['begleitung'],
};

function getShiftSkillSignals(shiftDef) {
  const label = ` ${normalizeSkillText(`${shiftDef.code || ''} ${shiftDef.name || ''} ${shiftDef.short_name || ''}`)} `;
  const ratedSkills = Object.entries(SKILL_MATCH_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => label.includes(` ${normalizeSkillText(alias)} `)))
    .map(([skill]) => skill);

  const legacySkills = [];
  if (label.includes(' cc ') || label.includes(' cross connect ')) legacySkills.push('can_cc');
  if (label.includes(' tt ') || label.includes(' trouble ticket ') || label.includes(' troubleticket ')) legacySkills.push('can_tt');
  if (label.includes(' sh ') || label.includes(' smart hand ') || label.includes(' smarthand ')) legacySkills.push('can_sh');

  return {
    ratedSkills,
    legacySkills,
  };
}

function getBestRatedSkillMatch(skillProfile, shiftSkillSignals) {
  if (!skillProfile || !skillProfile.rated_skills || typeof skillProfile.rated_skills !== 'object') return null;

  let bestMatch = null;
  for (const skillName of shiftSkillSignals.ratedSkills) {
    const rating = Number.parseInt(String(skillProfile.rated_skills?.[skillName] ?? ''), 10);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;

    if (!bestMatch || rating > bestMatch.rating) {
      bestMatch = { skill: skillName, rating };
    }
  }

  return bestMatch;
}

function hasLegacySkillMatch(skillProfile, shiftSkillSignals) {
  if (!skillProfile) return false;
  return shiftSkillSignals.legacySkills.some((skillKey) => skillProfile[skillKey] === true);
}

async function getRamadanRangeForYear(year) {
  const { rows } = await pool.query(
    `SELECT
        to_char(ramadan_start, 'YYYY-MM-DD') AS ramadan_start,
        to_char(ramadan_end, 'YYYY-MM-DD') AS ramadan_end
     FROM islamic_calendar_cache
     WHERE year = $1
       AND ramadan_start IS NOT NULL
       AND ramadan_end IS NOT NULL
     ORDER BY id DESC
     LIMIT 1`,
    [year]
  );

  if (!rows.length) return null;

  return {
    start: rows[0].ramadan_start,
    end: rows[0].ramadan_end,
  };
}

async function loadShiftplanFeatureFlags() {
  const { rows } = await pool.query(
    `SELECT key, value
     FROM app_settings
     WHERE key = ANY($1::text[])`,
    [['shiftplan.skills_enabled']]
  );

  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    skillsEnabled: parseBooleanAppSetting(settings['shiftplan.skills_enabled'], false),
  };
}

async function loadDbsPlanningConfig() {
  const { rows } = await pool.query(
    `SELECT key, value
     FROM app_settings
     WHERE key = ANY($1::text[])`,
    [[
      'shiftplan.dbs_enabled',
      'shiftplan.dbs_weekdays',
      'shiftplan.dbs_shift_code',
      'shiftplan.dbs_required_staff',
      'shiftplan.dbs_free_days_after_block',
    ]]
  );

  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    enabled: parseBooleanAppSetting(settings['shiftplan.dbs_enabled'], true),
    shiftCode: String(settings['shiftplan.dbs_shift_code'] || 'DBS').trim().toUpperCase() || 'DBS',
    weekdays: [1, 2, 3, 4, 5, 6, 0],
    requiredStaff: Math.max(Number.parseInt(String(parseNumberAppSetting(settings['shiftplan.dbs_required_staff'], 1)), 10) || 0, 0),
    freeDaysAfterBlock: Math.max(Number.parseInt(String(parseNumberAppSetting(settings['shiftplan.dbs_free_days_after_block'], 2)), 10) || 0, 0),
  };
}

async function loadHolidayStaffingConfig() {
  const { rows } = await pool.query(
    `SELECT value
     FROM app_settings
     WHERE key = $1
     LIMIT 1`,
    ['shiftplan.holiday_staffing_limits']
  );

  if (!rows.length || !rows[0]?.value) return {};

  try {
    return normalizeHolidayStaffingConfig(JSON.parse(rows[0].value));
  } catch {
    return {};
  }
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

function resolveLiveMonthLabelFromDraftMonth(monthId) {
  const parsedMonth = parseDraftMonthId(monthId);
  if (!parsedMonth) return null;
  return formatShiftMonthLabel(parsedMonth.year, parsedMonth.month);
}

async function loadManualEmployeesForDraftMonth(monthId, client = pool) {
  const liveMonthLabel = resolveLiveMonthLabelFromDraftMonth(monthId);
  if (!liveMonthLabel) return [];

  const { rows } = await client.query(
    `SELECT employee_name, created_at, created_by
       FROM manual_shiftplan_employees
      WHERE month = $1
      ORDER BY LOWER(employee_name) ASC, employee_name ASC`,
    [liveMonthLabel]
  );

  return rows.map((row) => ({
    employee_name: row.employee_name,
    created_at: row.created_at,
    created_by: row.created_by || null,
  }));
}

async function loadManualEmployeeNameSetForDraftMonth(monthId, client = pool) {
  const manualEmployees = await loadManualEmployeesForDraftMonth(monthId, client);
  return new Set(manualEmployees.map((entry) => entry.employee_name));
}

async function loadManualEmployeeSummaryForYear(year, client = pool) {
  const targetYear = Number.parseInt(String(year || ''), 10);
  if (!Number.isInteger(targetYear)) return [];

  const { rows } = await client.query(
    `SELECT month, employee_name
       FROM manual_shiftplan_employees
      WHERE month IS NOT NULL
        AND employee_name IS NOT NULL`
  );

  const grouped = new Map();

  for (const row of rows) {
    const parsedMonth = parseMonthLabel(row.month);
    if (!parsedMonth || parsedMonth.year !== targetYear) continue;

    const employeeName = normalizeEmployeeName(row.employee_name);
    if (!employeeName) continue;

    const monthId = `${parsedMonth.year}-${String(parsedMonth.month).padStart(2, '0')}`;
    if (!grouped.has(monthId)) {
      grouped.set(monthId, { month: monthId, employeeNames: new Map() });
    }

    const summary = grouped.get(monthId);
    const dedupeKey = employeeName.toLowerCase();
    if (!summary.employeeNames.has(dedupeKey)) {
      summary.employeeNames.set(dedupeKey, employeeName);
    }
  }

  return [...grouped.values()]
    .sort((left, right) => left.month.localeCompare(right.month))
    .map((entry) => {
      const employeeNames = [...entry.employeeNames.values()].sort((left, right) => left.localeCompare(right, 'de'));
      return {
        month: entry.month,
        count: employeeNames.length,
        employee_names: employeeNames,
      };
    });
}

function buildEmployeeAliasKeys(raw) {
  const normalized = normalizeEmployeeName(raw);
  if (!normalized) return [];

  const aliases = new Set([normalized.toLowerCase()]);
  let firstName = '';
  let lastName = '';

  if (normalized.includes(',')) {
    const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      lastName = parts[0];
      firstName = parts.slice(1).join(' ');
    }
  } else {
    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      firstName = parts.slice(0, -1).join(' ');
      lastName = parts[parts.length - 1];
    }
  }

  if (firstName && lastName) {
    const firstToken = firstName.split(/\s+/).filter(Boolean)[0] || firstName;
    const variants = [
      `${firstName} ${lastName}`,
      `${lastName}, ${firstName}`,
      `${lastName} ${firstName}`,
      `${firstToken} ${lastName}`,
      `${lastName}, ${firstToken}`,
      `${lastName} ${firstToken}`,
    ];

    for (const variant of variants) aliases.add(variant.toLowerCase());
  }

  return [...aliases];
}

function buildEmployeeNameLookup(employeeNames) {
  const lookup = new Map();

  for (const employeeName of employeeNames) {
    for (const key of buildEmployeeAliasKeys(employeeName)) {
      if (!lookup.has(key)) lookup.set(key, employeeName);
    }
  }

  return lookup;
}

function resolveEmployeeName(raw, lookup) {
  if (!lookup || lookup.size === 0) return normalizeEmployeeName(raw);

  for (const key of buildEmployeeAliasKeys(raw)) {
    const resolved = lookup.get(key);
    if (resolved) return resolved;
  }

  return normalizeEmployeeName(raw);
}

function hasSubmittedEmployeePreferences(preferenceRow) {
  if (!preferenceRow || typeof preferenceRow !== 'object') return false;

  const hasEntries = (value) => Array.isArray(value) && value.some((entry) => String(entry || '').trim());

  return (
    hasEntries(preferenceRow.preferred_shifts)
    || hasEntries(preferenceRow.unwanted_shifts)
    || hasEntries(preferenceRow.preferred_holidays)
    || hasEntries(preferenceRow.preferred_days)
    || hasEntries(preferenceRow.blocked_days)
    || (Number.isInteger(Number(preferenceRow.max_nights_per_month)) && preferenceRow.max_nights_per_month !== null)
    || String(preferenceRow.notes || '').trim().length > 0
    || String(preferenceRow.workload_preference || 'normal').trim().toLowerCase() !== 'normal'
  );
}

async function loadDraftWishStatus(employeeNames) {
  const deduplicatedEmployees = deduplicateEmployees(employeeNames);
  const employeeLookup = buildEmployeeNameLookup(deduplicatedEmployees);
  const { rows } = await pool.query(
    `SELECT ep.*, u.first_name, u.last_name, u.email
     FROM employee_preferences ep
     JOIN users u ON u.id = ep.user_id
     ORDER BY ep.updated_at DESC NULLS LAST, u.last_name, u.first_name`
  );

  const matchedPreferences = new Map();

  for (const row of rows) {
    const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    const fallbackName = [row.last_name, row.first_name].filter(Boolean).join(', ').trim();
    const employeeName = resolveEmployeeName(fullName || fallbackName, employeeLookup);
    if (!employeeName || matchedPreferences.has(employeeName)) continue;

    matchedPreferences.set(employeeName, {
      employee_name: employeeName,
      submitted: hasSubmittedEmployeePreferences(row),
      updated_at: row.updated_at || null,
    });
  }

  return deduplicatedEmployees.map((employeeName) => matchedPreferences.get(employeeName) || {
    employee_name: employeeName,
    submitted: false,
    updated_at: null,
  });
}

async function loadDraftAbsences(month) {
  const [yearStr, monthStr] = String(month || '').split('-');
  const year = Number.parseInt(yearStr, 10);
  const monthNumber = Number.parseInt(monthStr, 10);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) return [];

  const numDays = daysInMonth(year, monthNumber);
  const { rows } = await pool.query(
    `SELECT id, employee_name, start_date, end_date, type, note
     FROM absences
     WHERE start_date <= $1 AND end_date >= $2
     ORDER BY employee_name, start_date`,
    [`${month}-${numDays}`, `${month}-01`]
  );

  return rows;
}

async function loadEmployeesForPlanningYear(year, monthId = null) {
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
    const manualEmployees = monthId ? await loadManualEmployeesForDraftMonth(monthId) : [];
    return deduplicateEmployees([...yearScopedEmployees, ...manualEmployees.map((entry) => entry.employee_name)]);
  }

  const manualEmployees = monthId ? await loadManualEmployeesForDraftMonth(monthId) : [];
  return deduplicateEmployees([...yearPlanEmployees, ...rows.map((row) => row.employee_name), ...manualEmployees.map((entry) => entry.employee_name)]);
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
export async function generateShiftPlan(year, mon, numDays, createdBy, options = {}) {
  const carryState = options.carryState || {};
  const dbsPlanningConfig = await loadDbsPlanningConfig();
  const holidayStaffingConfig = await loadHolidayStaffingConfig();
  const defRes = await pool.query('SELECT * FROM shift_definitions WHERE is_active=TRUE ORDER BY sort_order, code');
  const shiftDefs = (defRes.rows.length > 0 ? defRes.rows : [
    { code: 'E1', name: 'Frühschicht 1', shift_type: 'early', min_staff: 1, max_staff: 5, color_hex: '#3b82f6', sort_order: 1, series_days: 5 },
    { code: 'E2', name: 'Frühschicht 2', shift_type: 'early', min_staff: 1, max_staff: 5, color_hex: '#60a5fa', sort_order: 2, series_days: 5 },
    { code: 'L1', name: 'Spätschicht 1', shift_type: 'late', min_staff: 1, max_staff: 5, color_hex: '#f59e0b', sort_order: 3, series_days: 5 },
    { code: 'L2', name: 'Spätschicht 2', shift_type: 'late', min_staff: 1, max_staff: 5, color_hex: '#fbbf24', sort_order: 4, series_days: 5 },
    { code: 'N', name: 'Nachtschicht', shift_type: 'night', min_staff: 1, max_staff: 3, color_hex: '#8b5cf6', sort_order: 5, series_days: 7 },
  ])
    .map((definition) => {
      const shiftCode = String(definition.code || '').trim().toUpperCase();
      if (shiftCode !== dbsPlanningConfig.shiftCode) return definition;
      if (!dbsPlanningConfig.enabled) return null;

      return {
        ...definition,
        applicable_days: [1, 2, 3, 4, 5, 6, 0],
        series_days: 7,
        min_staff: dbsPlanningConfig.requiredStaff,
        max_staff: Math.max(Number.parseInt(String(definition.max_staff ?? 0), 10) || 0, dbsPlanningConfig.requiredStaff),
      };
    })
    .filter(Boolean)
    .map(applyFixedShiftSeriesPattern)
    .filter(isShiftDefinitionDraftPlannable);

  const rotRes = await pool.query('SELECT * FROM shift_rotation_rules WHERE id=1');
  const rotation = rotRes.rows[0] || {
    max_consecutive_same: 5, max_consecutive_workdays: 6, min_free_after_streak: 1,
    night_to_early_forbidden: true, late_to_early_forbidden: true,
    min_hours_between_shifts: 11, max_nights_per_month: 7, max_weekends_per_month: 2, weekend_rule: 'balanced',
    free_days_after_night: 2, free_days_after_weekend: 2,
    night_next_workday: 4, night_next_shift_code: null,
    late_before_night_required: false,
    stability_priority: 70, max_shift_type_changes_per_month: 4,
    min_free_weekends_per_month: 2, min_recovery_days_after_shift_change: 1,
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
  const restrictedPoolShiftCodes = new Set([...specialPoolsByShift.keys()]);
  if (dbsPlanningConfig.enabled && dbsPlanningConfig.shiftCode) restrictedPoolShiftCodes.add(dbsPlanningConfig.shiftCode);

  const month = `${year}-${String(mon).padStart(2, '0')}`;
  let employees = await loadEmployeesForPlanningYear(year, month);
  if (employees.length === 0) {
    throw new Error('Keine Mitarbeiter im System gefunden');
  }
  const employeeNameLookup = buildEmployeeNameLookup(employees);

  const absRes = await pool.query(
    `SELECT employee_name, start_date, end_date, type FROM absences WHERE start_date <= $1 AND end_date >= $2`,
    [`${month}-${numDays}`, `${month}-01`]
  );
  const absenceMap = new Map();
  for (const absence of absRes.rows) {
    if (!absenceMap.has(absence.employee_name)) absenceMap.set(absence.employee_name, []);
    absenceMap.get(absence.employee_name).push(absence);
  }

  const exclRes = await pool.query(
    `SELECT employee_name, fixed_shift_type FROM shiftplan_exclusions WHERE is_active = TRUE`
  );
  const shiftExcludedSet = new Set();
  const fixedShiftTypeByEmployee = new Map();
  for (const row of exclRes.rows) {
    const fixedShiftType = normalizePlanningShiftTypeKey(row.fixed_shift_type);
    if (fixedShiftType) {
      if (!shiftExcludedSet.has(row.employee_name)) fixedShiftTypeByEmployee.set(row.employee_name, fixedShiftType);
      continue;
    }
    shiftExcludedSet.add(row.employee_name);
    fixedShiftTypeByEmployee.delete(row.employee_name);
  }

  const assignExclRes = await pool.query(
    `SELECT employee_name FROM assignment_employee_exclusions WHERE is_active = TRUE AND (valid_from IS NULL OR valid_from <= $1) AND (valid_to IS NULL OR valid_to >= $2)`,
    [`${month}-${numDays}`, `${month}-01`]
  );
  for (const row of assignExclRes.rows) shiftExcludedSet.add(row.employee_name);

  const skillsRes = await pool.query('SELECT * FROM employee_skills');
  const skillsMap = new Map();
  for (const skill of skillsRes.rows) skillsMap.set(skill.employee_name, skill);

  const prevMonth = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`;
  const prevMonthParts = prevMonth.split('-');
  const wellbeingRows = await loadWellbeingHistory(prevMonthParts[0], Number.parseInt(prevMonthParts[1], 10));
  const historyMap = new Map();
  for (const row of wellbeingRows) historyMap.set(row.employee_name, row);

  const prefRes = await pool.query(
    `SELECT pc.user_id, u.first_name, u.last_name, pc.preferred_employee_name
     FROM preferred_colleagues pc
     JOIN users u ON u.id = pc.user_id`
  );
  const preferredMap = new Map();
  for (const row of prefRes.rows) {
    const requesterName = resolveEmployeeName([row.first_name, row.last_name].filter(Boolean).join(' '), employeeNameLookup);
    const preferredEmployeeName = resolveEmployeeName(row.preferred_employee_name, employeeNameLookup);
    if (!requesterName || !preferredEmployeeName) continue;
    if (!preferredMap.has(requesterName)) preferredMap.set(requesterName, []);
    preferredMap.get(requesterName).push(preferredEmployeeName);
  }

  const empPrefRes = await pool.query(
    `SELECT ep.*, u.first_name, u.last_name, u.email
     FROM employee_preferences ep
     JOIN users u ON u.id = ep.user_id`
  );
  const empPrefsMap = new Map();
  for (const row of empPrefRes.rows) {
    const employeeName = resolveEmployeeName([row.first_name, row.last_name].filter(Boolean).join(' '), employeeNameLookup);
    if (!employeeName) continue;
    empPrefsMap.set(employeeName, row);
  }

  const staffRes = await pool.query('SELECT * FROM staffing_rules');
  const staffingRules = buildStaffingRulesByShiftType(staffRes.rows);

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

  const empStats = {};
  const empDayAssignment = {};
  const empConsecutiveWork = {};
  const empLastShiftType = {};
  const empRequiredFreeDays = {};
  const empHours = {};
  const empRecoveryReason = {};
  const empSeriesCode = {};
  const empSeriesRemaining = {};
  const empLastWorkedShiftCode = {};
  const empLastWorkedShiftType = {};
  const empLastWorkedDay = {};
  const empForcedNextShiftCode = {};

  const activeEmployees = employees.filter((employee) => !shiftExcludedSet.has(employee));
  planReport.activeEmployees = activeEmployees.length;
  const targetHours = parseTargetHoursValue(planConfig.monthly_target_hours, 174);
  const employeeTargetHours = Object.fromEntries(activeEmployees.map((employee) => [employee, targetHours]));
  const employeeTargetRes = await pool.query(
    `SELECT employee_name, target_hours
     FROM shiftplan_employee_monthly_targets
     WHERE month = $1`,
    [month]
  );
  for (const row of employeeTargetRes.rows) {
    const employeeName = resolveEmployeeName(row.employee_name, employeeNameLookup);
    if (!employeeName || !(employeeName in employeeTargetHours)) continue;
    employeeTargetHours[employeeName] = parseTargetHoursValue(row.target_hours, targetHours);
  }
  const baselineShiftSlots = buildShiftSlots(shiftDefs, staffingRules);
  const holidayMap = buildHessenHolidayMap(year);
  const totalWeekendBlocks = countWeekendBlocks(year, mon, numDays);
  const ramadanRange = await getRamadanRangeForYear(year);
  const featureFlags = await loadShiftplanFeatureFlags();
  let assignedToday = null;
  let assignedByShiftTypeToday = { early: 0, late: 0, night: 0, special: 0 };

  for (const employee of activeEmployees) {
    empStats[employee] = { nights: 0, weekends: 0, workedWeekendBlocks: new Set(), shiftTypeChanges: 0, earlyCount: 0, lateCount: 0, total: 0, actualHours: 0, targetHours: employeeTargetHours[employee], specialShiftCounts: {} };
    empDayAssignment[employee] = {};
    const carried = carryState[employee] || {};
    empConsecutiveWork[employee] = Math.max(Number.parseInt(carried.consecutiveWork, 10) || 0, 0);
    empLastShiftType[employee] = carried.lastShiftType || null;
    empRequiredFreeDays[employee] = Math.max(Number.parseInt(carried.requiredFreeDays, 10) || 0, 0);
    empHours[employee] = 0;
    empRecoveryReason[employee] = carried.recoveryReason || null;
    empSeriesCode[employee] = carried.seriesCode || null;
    empSeriesRemaining[employee] = Math.max(Number.parseInt(carried.seriesRemaining, 10) || 0, 0);
    empLastWorkedShiftCode[employee] = carried.lastWorkedShiftCode || null;
    empLastWorkedShiftType[employee] = carried.lastWorkedShiftType || null;
    empLastWorkedDay[employee] = null;
    empForcedNextShiftCode[employee] = carried.forcedNextShiftCode || null;
  }

  const isEmployeeAbsentOnDate = (employeeName, dateStr) => {
    const absences = absenceMap.get(employeeName) || [];
    const currentDate = new Date(dateStr);
    return absences.some((absence) => currentDate >= new Date(absence.start_date) && currentDate <= new Date(absence.end_date));
  };

  const getEmployeeAbsenceOnDate = (employeeName, dateStr) => {
    const absences = absenceMap.get(employeeName) || [];
    const currentDate = new Date(dateStr);
    return absences.find((absence) => currentDate >= new Date(absence.start_date) && currentDate <= new Date(absence.end_date)) || null;
  };

  const getCreditedAbsenceHours = (absence, weekend) => {
    if (!absence || weekend) return 0;
    return CREDITED_ABSENCE_TYPES.has(String(absence.type || '').toUpperCase()) ? CREDITED_ABSENCE_HOURS : 0;
  };

  const assignShiftToEmployee = ({ emp, shiftDef, day, dateStr, weekend, holidayName, explanationReasons = [], score = null, eligibleCount = null }) => {
    const previousWorkedShiftType = empLastWorkedShiftType[emp];
    const configuredSeriesDays = getShiftSeriesDays(shiftDef);
    const continuingBlock = empSeriesRemaining[emp] > 0 && empSeriesCode[emp] === shiftDef.code;
    const seriesDays = continuingBlock ? configuredSeriesDays : getAnchoredSeriesDays(shiftDef, dayOfWeek(year, mon, day));
    const remainingBefore = continuingBlock ? empSeriesRemaining[emp] : 0;
    const dayInSeries = continuingBlock ? Math.max(seriesDays - remainingBefore + 1, 1) : 1;
    const remainingAfter = seriesDays > 1
      ? (continuingBlock ? Math.max(remainingBefore - 1, 0) : seriesDays - 1)
      : 0;
    const blockEndsToday = remainingAfter === 0;

    if (remainingAfter > 0) {
      empSeriesCode[emp] = shiftDef.code;
      empSeriesRemaining[emp] = remainingAfter;
    } else {
      empSeriesCode[emp] = null;
      empSeriesRemaining[emp] = 0;
    }

    shifts.push({ employee_name: emp, day, shift_code: shiftDef.code });
    assignedToday.add(emp);
    empDayAssignment[emp][day] = shiftDef.code;
    assignedByShiftTypeToday[shiftDef.shift_type] = Number(assignedByShiftTypeToday[shiftDef.shift_type] || 0) + 1;
    empLastShiftType[emp] = shiftDef.shift_type;
    empLastWorkedShiftCode[emp] = shiftDef.code;
    empLastWorkedShiftType[emp] = shiftDef.shift_type;
    empLastWorkedDay[emp] = day;
    if (empForcedNextShiftCode[emp] === shiftDef.code) empForcedNextShiftCode[emp] = null;
    empConsecutiveWork[emp]++;

    const effectiveWorkdayLimit = Math.max(rotation.max_consecutive_workdays, seriesDays);
    if (rotation.min_free_after_streak > 0 && empConsecutiveWork[emp] >= effectiveWorkdayLimit && blockEndsToday) {
      empRequiredFreeDays[emp] = Math.max(empRequiredFreeDays[emp], rotation.min_free_after_streak);
      empRecoveryReason[emp] = 'Arbeitsserie';
    }
    if (shiftDef.shift_type === 'night' && blockEndsToday) {
      const targetWeekday = Math.max(0, Math.min(6, Number.parseInt(rotation.night_next_workday, 10) || 0));
      const currentWeekday = dayOfWeek(year, mon, day);
      const daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7 || 7;
      empRequiredFreeDays[emp] = Math.max(empRequiredFreeDays[emp], rotation.free_days_after_night, daysUntilTarget - 1);
      empRecoveryReason[emp] = 'Nachtschicht';
      empForcedNextShiftCode[emp] = rotation.night_next_shift_code || null;
    }
    if (weekend && rotation.free_days_after_weekend > 0 && blockEndsToday) {
      empRequiredFreeDays[emp] = Math.max(empRequiredFreeDays[emp], rotation.free_days_after_weekend);
      empRecoveryReason[emp] = 'Wochenendarbeit';
    }

    const shiftHours = getShiftDurationHours(shiftDef);
    if (shiftDef.shift_type === 'night') empStats[emp].nights++;
    if (weekend) {
      empStats[emp].weekends++;
      empStats[emp].workedWeekendBlocks.add(getWeekendBlockKey(year, mon, day));
    }
    if (String(shiftDef.code).toUpperCase() === dbsPlanningConfig.shiftCode && blockEndsToday) {
      empRequiredFreeDays[emp] = Math.max(empRequiredFreeDays[emp], dbsPlanningConfig.freeDaysAfterBlock);
      empRecoveryReason[emp] = 'DBS-Block';
    }
    if (previousWorkedShiftType && previousWorkedShiftType !== shiftDef.shift_type) empStats[emp].shiftTypeChanges++;
    if (shiftDef.shift_type === 'early') empStats[emp].earlyCount++;
    if (shiftDef.shift_type === 'late') empStats[emp].lateCount++;
    empStats[emp].total++;
    empStats[emp].specialShiftCounts[shiftDef.code] = Number(empStats[emp].specialShiftCounts[shiftDef.code] || 0) + 1;
    empHours[emp] += shiftHours;
    empStats[emp].actualHours = Number(empHours[emp].toFixed(2));
    planReport.totalShiftsPlanned++;

    const expKey = `${emp}_${day}`;
    const allReasons = [
      'Verfügbar (kein Urlaub/Abwesenheit, nicht ausgeschlossen)',
      `Schicht: ${shiftDef.name} (${shiftDef.code})`,
    ];
    if (seriesDays > 1) {
      allReasons.push(`Serienplanung: Tag ${dayInSeries}/${seriesDays}`);
    }
    if (!continuingBlock && configuredSeriesDays > seriesDays) {
      allReasons.push(`Wochenanker: Übergangsblock bis Montag (${seriesDays} Tage)`);
    }
    if (explanationReasons.length > 0) {
      allReasons.push(...explanationReasons);
    }
    if (Number.isFinite(score) && Number.isInteger(eligibleCount) && eligibleCount > 0) {
      allReasons.push(`Planungsbewertung: ${score} Punkte (Rang 1 von ${eligibleCount} zulässigen Kandidaten)`);
    }
    explanations[expKey] = { employee: emp, day, code: shiftDef.code, reasons: allReasons, score };

    const prefs = empPrefsMap.get(emp);
    if (prefs) {
      const preferenceShiftCode = getPreferenceShiftCode(shiftDef.code);
      if ((prefs.preferred_shifts || []).includes(preferenceShiftCode)) planReport.wishesRespected++;
      if ((prefs.unwanted_shifts || []).includes(preferenceShiftCode)) planReport.wishesDenied++;
      if (holidayName && (prefs.preferred_holidays || []).includes(holidayName)) planReport.wishesRespected++;
      if ((prefs.preferred_holidays || []).includes('Ramadan') && ramadanRange && dateStr >= ramadanRange.start && dateStr <= ramadanRange.end) {
        planReport.wishesRespected++;
      }
    }
  };

  for (let day = 1; day <= numDays; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const weekend = isWeekend(year, mon, day);
    const dow = dayOfWeek(year, mon, day);
    const holidayName = holidayMap[dateStr] || null;

    for (const employee of activeEmployees) {
      const absence = getEmployeeAbsenceOnDate(employee, dateStr);
      const creditedHours = getCreditedAbsenceHours(absence, weekend);
      if (creditedHours <= 0) continue;
      empHours[employee] += creditedHours;
      empStats[employee].actualHours = Number(empHours[employee].toFixed(2));
    }

    const availableForDay = activeEmployees.filter((employee) => {
      if (isEmployeeAbsentOnDate(employee, dateStr)) return false;
      if (empRequiredFreeDays[employee] > 0) return false;
      return true;
    });

    assignedToday = new Set();
  assignedByShiftTypeToday = { early: 0, late: 0, night: 0, special: 0 };
    const shiftSlots = buildDailyShiftSlots({
      shiftDefinitions: shiftDefs,
      staffingRules,
      activeEmployees,
      employeeHours: empHours,
      employeeTargetHours,
      monthlyTargetHours: targetHours,
      day,
      numDays,
      dayOfWeek: dow,
    }).sort((left, right) => {
      const leftPriority = restrictedPoolShiftCodes.has(String(left.code || '').trim().toUpperCase()) ? 0 : 1;
      const rightPriority = restrictedPoolShiftCodes.has(String(right.code || '').trim().toUpperCase()) ? 0 : 1;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      const seriesDifference = getShiftSeriesDays(right) - getShiftSeriesDays(left);
      if (seriesDifference !== 0) return seriesDifference;
      const leftSort = Number.parseInt(String(left.sort_order ?? 0), 10) || 0;
      const rightSort = Number.parseInt(String(right.sort_order ?? 0), 10) || 0;
      if (leftSort !== rightSort) return leftSort - rightSort;
      return String(left.code || '').localeCompare(String(right.code || ''), 'de');
    });

    const availableEmployeeSet = new Set(availableForDay);
    const availableShiftCodes = new Set(shiftSlots.map((slot) => slot.code));
    for (const employee of activeEmployees) {
      if (empSeriesRemaining[employee] <= 0) continue;
      if (!availableEmployeeSet.has(employee) || !availableShiftCodes.has(empSeriesCode[employee])) {
        empSeriesCode[employee] = null;
        empSeriesRemaining[employee] = 0;
      }
    }

    const continuationLockedEmployees = new Set(
      availableForDay.filter((employee) => empSeriesRemaining[employee] > 0 && availableShiftCodes.has(empSeriesCode[employee]))
    );

    for (const shiftDef of shiftSlots) {
      const continuingEmployees = availableForDay
        .filter((employee) => !assignedToday.has(employee) && empSeriesRemaining[employee] > 0 && empSeriesCode[employee] === shiftDef.code)
        .sort((left, right) => left.localeCompare(right, 'de'));
      const baseNeededStaff = Math.max(shiftDef.planned_slots || shiftDef.min_staff || 1, continuingEmployees.length);
      const holidayShiftTypeLimit = getHolidayShiftStaffingLimit(holidayStaffingConfig, holidayName, shiftDef.shift_type);
      const remainingHolidayCapacity = holidayShiftTypeLimit === null
        ? null
        : Math.max(holidayShiftTypeLimit - Number(assignedByShiftTypeToday[shiftDef.shift_type] || 0), 0);
      const neededStaff = remainingHolidayCapacity === null
        ? baseNeededStaff
        : Math.max(continuingEmployees.length, Math.min(baseNeededStaff, remainingHolidayCapacity));
      const shiftSkillSignals = featureFlags.skillsEnabled ? getShiftSkillSignals(shiftDef) : { ratedSkills: [], legacySkills: [] };

      for (const employee of continuingEmployees) {
        assignShiftToEmployee({
          emp: employee,
          shiftDef,
          day,
          dateStr,
          weekend,
          holidayName,
          explanationReasons: ['Blockfortsetzung aus der Vortagsplanung'],
        });
      }

      const hasConfiguredNightTransition = availableForDay.some((employee) => empForcedNextShiftCode[employee] === shiftDef.code);
      if (!canStartShiftSeries({ day, dayOfWeek: dow, definition: shiftDef }) && !hasConfiguredNightTransition) {
        const requiredStaff = Math.max(Number.parseInt(String(shiftDef.min_staff ?? 0), 10) || 0, 0);
        if (continuingEmployees.length < requiredStaff) {
          conflicts.push({
            day,
            date: dateStr,
            shift: shiftDef.code,
            severity: 'critical',
            type: 'series_understaffed',
            message: `${shiftDef.name} (${shiftDef.code}) am ${dateStr}: Serienbesetzung unterschritten; neue Wochenblöcke dürfen nur montags starten`,
          });
        }
        continue;
      }

      for (let slot = continuingEmployees.length; slot < neededStaff; slot++) {
        const candidates = availableForDay.filter((employee) => !assignedToday.has(employee) && !(continuationLockedEmployees.has(employee) && empSeriesCode[employee] !== shiftDef.code));
        const matchingSkillCandidates = featureFlags.skillsEnabled && (shiftSkillSignals.ratedSkills.length > 0 || shiftSkillSignals.legacySkills.length > 0)
          ? candidates.filter((employee) => {
              const skillProfile = skillsMap.get(employee);
              return hasLegacySkillMatch(skillProfile, shiftSkillSignals) || !!getBestRatedSkillMatch(skillProfile, shiftSkillSignals);
            })
          : [];

        if (candidates.length === 0) {
          conflicts.push({
            day,
            date: dateStr,
            shift: shiftDef.code,
            severity: 'critical',
            type: 'understaffed',
            message: `${shiftDef.name} (${shiftDef.code}) am ${dateStr}: Nicht genügend verfügbare Mitarbeiter (benötigt: ${neededStaff}, verfügbar: 0)`,
          });
          continue;
        }

        const scored = candidates.map((employee) => {
          let score = 1000;
          const reasons = [];
          const stats = empStats[employee];
          const history = historyMap.get(employee);
          const prefs = empPrefsMap.get(employee);
          const normalizedShiftCode = String(shiftDef.code || '').trim().toUpperCase();
          const plannedWeekendKey = getPlannedWeekendBlockKey(year, mon, day, shiftDef, numDays);
          const specialPool = specialPoolsByShift.get(normalizedShiftCode);
          const isRestrictedPoolShift = restrictedPoolShiftCodes.has(normalizedShiftCode);
          const fixedShiftType = fixedShiftTypeByEmployee.get(employee);
          const seriesDays = getAnchoredSeriesDays(shiftDef, dow);
          let hardBlocked = false;

          if (empForcedNextShiftCode[employee] && empForcedNextShiftCode[employee] !== shiftDef.code) {
            hardBlocked = true;
            reasons.push(`Nach Nachtblock ist ${empForcedNextShiftCode[employee]} als Folgeschicht vorgegeben`);
          }
          if (empForcedNextShiftCode[employee] === shiftDef.code) {
            score += 1_000_000;
            reasons.push(`Konfigurierte Folgeschicht nach Nachtblock: ${shiftDef.code}`);
          }

          if (fixedShiftType && fixedShiftType !== normalizePlanningShiftTypeKey(shiftDef.shift_type)) {
            hardBlocked = true;
            reasons.push(`Feste Schichtvorgabe: nur ${fixedShiftType}`);
          }

          const lastType = empLastShiftType[employee];
          if (lastType === 'night' && shiftDef.shift_type === 'early' && rotation.night_to_early_forbidden) {
            hardBlocked = true;
            reasons.push('Regelverstoß: Nacht→Früh verboten');
          }
          if (lastType === 'late' && shiftDef.shift_type === 'early' && rotation.late_to_early_forbidden) {
            hardBlocked = true;
            reasons.push('Regelverstoß: Spät→Früh verboten');
          }

          if (shiftDef.shift_type === 'night' && rotation.late_before_night_required) {
            const previousCode = empDayAssignment[employee]?.[day - 1];
            const previousDefinition = shiftDefs.find((definition) => definition.code === previousCode);
            const previousType = normalizePlanningShiftTypeKey(previousDefinition?.shift_type);
            if (day > 1 && previousType !== 'late') {
              hardBlocked = true;
              reasons.push('Regelverstoss: Vor Nachtschicht ist Spaetschicht vorgeschrieben');
            } else if (previousType === 'late') {
              score += 250_000;
              reasons.push('Nachtschicht-Transit: Vortag war Spaetschicht');
            }
          }

          const effectiveWorkdayLimit = Math.max(rotation.max_consecutive_workdays, seriesDays);
          if (empConsecutiveWork[employee] >= effectiveWorkdayLimit) {
            hardBlocked = true;
            reasons.push(`Max. Arbeitstage in Folge erreicht (${empConsecutiveWork[employee]}/${effectiveWorkdayLimit})`);
          }

          if (shiftDef.shift_type === 'night' && stats.nights + seriesDays > rotation.max_nights_per_month) {
            hardBlocked = true;
            reasons.push(`Nachtlimit erreicht (${stats.nights}/${rotation.max_nights_per_month})`);
          }

          if (plannedWeekendKey && !stats.workedWeekendBlocks.has(plannedWeekendKey) && stats.workedWeekendBlocks.size >= rotation.max_weekends_per_month) {
            hardBlocked = true;
            reasons.push(`Wochenendlimit erreicht (${stats.workedWeekendBlocks.size}/${rotation.max_weekends_per_month})`);
          }

          let consecutiveSame = 0;
          for (let previousDay = day - 1; previousDay >= 1; previousDay--) {
            const prevCode = empDayAssignment[employee][previousDay];
            if (!prevCode) break;
            const prevDef = shiftDefs.find((definition) => definition.code === prevCode);
            if (prevDef && prevDef.shift_type === shiftDef.shift_type) consecutiveSame++;
            else break;
          }
          const effectiveSameShiftLimit = Math.max(rotation.max_consecutive_same, seriesDays);
          if (consecutiveSame >= effectiveSameShiftLimit) {
            hardBlocked = true;
            reasons.push(`Max. gleiche Schichtart in Folge erreicht (${consecutiveSame}/${effectiveSameShiftLimit})`);
          }

          if (isRestrictedPoolShift) {
            const poolEntry = specialPool?.get(employee);
            if (!poolEntry) {
              hardBlocked = true;
              reasons.push(`Nicht im festen Pool für ${shiftDef.code}`);
            } else {
              const assignedCount = Number(stats.specialShiftCounts?.[shiftDef.code] || 0);
              if (assignedCount + seriesDays > poolEntry.monthlyMaxAssignments) {
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
            return { emp: employee, score: Number.NEGATIVE_INFINITY, reasons, hardBlocked: true };
          }

          if (fixedShiftType && fixedShiftType === normalizePlanningShiftTypeKey(shiftDef.shift_type)) {
            score += 200;
            reasons.push(`Feste Schichtvorgabe erfüllt: ${fixedShiftType}`);
          }

          if (featureFlags.skillsEnabled && (shiftSkillSignals.ratedSkills.length > 0 || shiftSkillSignals.legacySkills.length > 0)) {
            const skillProfile = skillsMap.get(employee);
            const ratedSkillMatch = getBestRatedSkillMatch(skillProfile, shiftSkillSignals);
            const legacySkillMatch = hasLegacySkillMatch(skillProfile, shiftSkillSignals);

            if (ratedSkillMatch) {
              score += 60 + ratedSkillMatch.rating * 18;
              reasons.push(`Skill-Match: ${ratedSkillMatch.skill} (${ratedSkillMatch.rating}/5)`);
            }

            if (legacySkillMatch) {
              score += 40;
              reasons.push('Qualifikationsprofil passt zur Schicht');
            }

            if (!ratedSkillMatch && !legacySkillMatch && matchingSkillCandidates.length > 0) {
              score -= 110;
              reasons.push('Skill-Matrix aktiv: andere Kandidaten passen fachlich besser');
            }
          }

          if (fairnessRules.balance_total_load) {
            const avgHours = activeEmployees.reduce((sum, currentEmployee) => sum + empHours[currentEmployee], 0) / activeEmployees.length || 0;
            const diffHours = empHours[employee] - avgHours;
            score -= diffHours * 8;
            if (diffHours < -8) reasons.push('Fairness: Weniger Stunden als Durchschnitt');
            if (diffHours > 8) reasons.push('Fairness: Mehr Stunden als Durchschnitt');
          }

          const remainingToTarget = employeeTargetHours[employee] - empHours[employee];
          score += getTargetHoursScore({ currentHours: empHours[employee], targetHours: employeeTargetHours[employee] });
          if (remainingToTarget > 16) reasons.push(`Sollzeit offen: ${remainingToTarget.toFixed(1)}h`);
          if (remainingToTarget < -8) reasons.push(`Bereits über Sollzeit: ${Math.abs(remainingToTarget).toFixed(1)}h`);

          const continuity = getShiftContinuityAdjustment({
            previousCode: empLastWorkedShiftCode[employee],
            previousType: empLastWorkedShiftType[employee],
            previousDay: empLastWorkedDay[employee],
            nextCode: shiftDef.code,
            nextType: shiftDef.shift_type,
            day,
          });
          const stabilityPriority = Math.max(0, Math.min(Number(rotation.stability_priority ?? 70), 100));
          score += continuity.score * (stabilityPriority / 50);
          if (continuity.reason) reasons.push(continuity.reason);

          const previousWorkedType = empLastWorkedShiftType[employee];
          const isShiftTypeChange = previousWorkedType && previousWorkedType !== shiftDef.shift_type;
          if (isShiftTypeChange) {
            const maxChanges = Math.max(Number(rotation.max_shift_type_changes_per_month ?? 4), 0);
            if (maxChanges > 0 && stats.shiftTypeChanges >= maxChanges) {
              score -= 5000;
              reasons.push(`Work-Life-Balance: Maximal ${maxChanges} Schichtartwechsel pro Monat erreicht`);
            }

            const requiredRecoveryDays = Math.max(Number(rotation.min_recovery_days_after_shift_change ?? 1), 0);
            const freeDaysSinceLastShift = Math.max(day - Number(empLastWorkedDay[employee] || day) - 1, 0);
            if (freeDaysSinceLastShift < requiredRecoveryDays) {
              score -= (requiredRecoveryDays - freeDaysSinceLastShift) * 1000;
              reasons.push(`Work-Life-Balance: ${requiredRecoveryDays} freie Tage vor Schichtartwechsel bevorzugt`);
            }
          }

          if (plannedWeekendKey) {
            const minimumFreeWeekends = Math.max(Number(rotation.min_free_weekends_per_month ?? 2), 0);
            const preferredWorkedWeekendLimit = Math.max(totalWeekendBlocks - minimumFreeWeekends, 0);
            if (!stats.workedWeekendBlocks.has(plannedWeekendKey) && stats.workedWeekendBlocks.size >= preferredWorkedWeekendLimit) {
              score -= 3000;
              reasons.push(`Work-Life-Balance: Mindestens ${minimumFreeWeekends} freie Wochenenden bevorzugt`);
            }
          }

          if (shiftDef.shift_type === 'night' && fairnessRules.balance_nights) {
            const avgNights = activeEmployees.reduce((sum, currentEmployee) => sum + empStats[currentEmployee].nights, 0) / activeEmployees.length || 0;
            score -= (stats.nights - avgNights) * 80;
            if (history && history.night_count > 3) {
              score -= 100;
              reasons.push('Fairnessausgleich: Hohe Nachtlast im Vormonat');
            }
          }

          if (plannedWeekendKey && fairnessRules.balance_weekends) {
            const avgWeekends = activeEmployees.reduce((sum, currentEmployee) => sum + empStats[currentEmployee].workedWeekendBlocks.size, 0) / activeEmployees.length || 0;
            score -= (stats.workedWeekendBlocks.size - avgWeekends) * 80;
          }

          if (planConfig.respect_employee_wishes && prefs) {
            const preferredShifts = prefs.preferred_shifts || [];
            const unwantedShifts = prefs.unwanted_shifts || [];
            const preferenceShiftCode = getPreferenceShiftCode(shiftDef.code);
            const preferredHolidays = prefs.preferred_holidays || [];
            const blockedDays = prefs.blocked_days || [];
            const preferredDays = prefs.preferred_days || [];
            const maxNights = prefs.max_nights_per_month;

            if (unwantedShifts.includes(preferenceShiftCode)) {
              score -= planConfig.soft_wishes_priority * 10;
              reasons.push(`Mitarbeiterwunsch: ${shiftDef.code} unerwünscht`);
            }
            if (preferredShifts.includes(preferenceShiftCode)) {
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
            ({ score, reasons } = applyHolidayWorkPreferenceScore({
              score,
              reasons,
              holidayName,
              preferredHolidays,
              ramadanRange,
              dateStr,
              softWishesPriority: planConfig.soft_wishes_priority,
            }));
            if (maxNights !== null && maxNights !== undefined && shiftDef.shift_type === 'night' && stats.nights >= maxNights) {
              score -= 1500;
              reasons.push(`Individuelles Nachtlimit erreicht (${stats.nights}/${maxNights})`);
            }

          }

          const preferred = preferredMap.get(employee);
          if (preferred) {
            const dayShifts = shifts.filter((entry) => entry.day === day);
            const colleaguePreferenceBonus = Math.max(0, Math.round((planConfig.soft_wishes_priority || 0) * 0.3));
            for (const preferredEmployee of preferred) {
              if (colleaguePreferenceBonus > 0 && dayShifts.some((entry) => entry.employee_name === preferredEmployee)) {
                score += colleaguePreferenceBonus;
                reasons.push(`Wunschkollege ${preferredEmployee} ebenfalls eingeteilt`);
              }
            }
          }

          return { emp: employee, score, reasons, hardBlocked: false };
        });

        const eligibleScored = scored.filter((entry) => Number.isFinite(entry.score));
        if (eligibleScored.length === 0) {
          const blockedPreview = scored
            .filter((entry) => entry.hardBlocked && entry.reasons.length > 0)
            .slice(0, 3)
            .map((entry) => `${entry.emp}: ${entry.reasons.join(', ')}`);
          conflicts.push({
            day,
            date: dateStr,
            shift: shiftDef.code,
            severity: 'critical',
            type: 'no_eligible_candidate',
            message: `${shiftDef.name} (${shiftDef.code}) am ${dateStr}: Keine zulässigen Kandidaten${blockedPreview.length > 0 ? ` (${blockedPreview.join(' | ')})` : ''}`,
          });
          continue;
        }

        eligibleScored.sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score;
          return left.emp.localeCompare(right.emp, 'de');
        });

        const winner = eligibleScored[0];
        if (!winner) continue;

        // Add relative ranking context to the winner's reasons
        if (eligibleScored.length > 1) {
          const runnerUp = eligibleScored[1];
          const scoreDiff = winner.score - runnerUp.score;
          if (scoreDiff > 0) {
            winner.reasons.push(`Vorsprung: +${scoreDiff} Punkte vor ${runnerUp.emp}`);
          } else {
            winner.reasons.push(`Gleichstand mit ${runnerUp.emp} — alphabetisch aufgelöst`);
          }
        } else {
          winner.reasons.push('Einziger zulässiger Kandidat');
        }

        assignShiftToEmployee({
          emp: winner.emp,
          shiftDef,
          day,
          dateStr,
          weekend,
          holidayName,
          explanationReasons: winner.reasons,
          score: winner.score,
          eligibleCount: eligibleScored.length,
        });
      }
    }

    for (const employee of activeEmployees) {
      if (!assignedToday.has(employee)) {
        if (empSeriesRemaining[employee] > 0) {
          empSeriesCode[employee] = null;
          empSeriesRemaining[employee] = 0;
        }
        const recoveryDaysBefore = empRequiredFreeDays[employee];
        const recoveryReasonBefore = empRecoveryReason[employee];
        empConsecutiveWork[employee] = 0;
        empLastShiftType[employee] = null;
        if (empRequiredFreeDays[employee] > 0) {
          empRequiredFreeDays[employee] = Math.max(empRequiredFreeDays[employee] - 1, 0);
          if (empRequiredFreeDays[employee] === 0) empRecoveryReason[employee] = null;
        }
        const expKey = `${employee}_${day}`;
        if (!explanations[expKey]) {
          const absence = getEmployeeAbsenceOnDate(employee, dateStr);
          const isAbsent = Boolean(absence);
          const creditedAbsenceHours = getCreditedAbsenceHours(absence, weekend);
          const absenceLabel = String(absence?.type || 'ABW').toUpperCase();
          explanations[expKey] = {
            employee,
            day,
            code: null,
            reasons: isAbsent
              ? [creditedAbsenceHours > 0
                ? `Nicht eingeteilt: ${absenceLabel} (${creditedAbsenceHours}h gutgeschrieben)`
                : `Nicht eingeteilt: ${absenceLabel} (keine Stundenanrechnung)`]
              : recoveryDaysBefore > 0
                ? [`Nicht eingeteilt: Erholungstag nach ${recoveryReasonBefore || 'Belastung'} erforderlich (${recoveryDaysBefore} verbleibend)`]
                : ['Nicht eingeteilt: Genügend andere Mitarbeiter für alle Schichten verfügbar'],
          };
        }
      }
    }

    for (const employee of employees) {
      if (shiftExcludedSet.has(employee)) {
        const expKey = `${employee}_${day}`;
        explanations[expKey] = {
          employee,
          day,
          code: null,
          reasons: ['Von der Schichtplanung ausgeschlossen (Admin-Einstellung)'],
        };
      }
    }
  }

  // Coverage planning is shift-centric. This mandatory employee-centric pass
  // closes individual contractual-hour gaps without changing fixed week blocks.
  const regularCatchupDefinitions = shiftDefs.filter((definition) => {
    const code = String(definition.code || '').trim().toUpperCase();
    return ['early', 'late'].includes(normalizePlanningShiftTypeKey(definition.shift_type) || '')
      && !['E1SA', 'E1WE', 'L1WE'].includes(code)
      && getShiftSeriesDays(definition) <= 5;
  });
  const targetCatchupSeriesDefinitions = shiftDefs.filter((definition) => {
    const code = String(definition.code || '').trim().toUpperCase();
    return ['E1SA', 'E1WE', 'L1WE'].includes(code) && getShiftSeriesDays(definition) > 1;
  });
  const shiftDefinitionByCode = new Map(shiftDefs.map((definition) => [String(definition.code || '').trim().toUpperCase(), definition]));
  const getAssignedShiftDefinition = (employee, day) => {
    const assignedCode = String(empDayAssignment[employee]?.[day] || '').trim().toUpperCase();
    return shiftDefinitionByCode.get(assignedCode) || null;
  };
  const getAssignedShiftType = (employee, day) => {
    const assignedDefinition = getAssignedShiftDefinition(employee, day);
    return normalizePlanningShiftTypeKey(assignedDefinition?.shift_type);
  };
  const isRecoveryProtectedDay = (employee, day) => {
    const reasons = explanations[`${employee}_${day}`]?.reasons || [];
    return reasons.some((reason) => String(reason).includes('Erholungstag'));
  };
  const wouldViolateAdjacentTransition = (employee, day, shiftDef) => {
    const currentType = normalizePlanningShiftTypeKey(shiftDef?.shift_type);
    const previousType = getAssignedShiftType(employee, day - 1);
    const nextType = getAssignedShiftType(employee, day + 1);

    if (previousType === 'night' && currentType === 'early' && rotation.night_to_early_forbidden) return true;
    if (currentType === 'night' && nextType === 'early' && rotation.night_to_early_forbidden) return true;
    if (previousType === 'late' && currentType === 'early' && rotation.late_to_early_forbidden) return true;
    if (currentType === 'late' && nextType === 'early' && rotation.late_to_early_forbidden) return true;

    return false;
  };
  const violatesWeekendRecoveryAfterBlock = (employee, workedDays) => {
    const requiredFreeDays = Math.max(Number.parseInt(String(rotation.free_days_after_weekend ?? 0), 10) || 0, 0);
    if (requiredFreeDays <= 0) return false;

    const projectedDays = new Set(workedDays);
    const weekendDays = workedDays.filter((day) => isWeekend(year, mon, day));
    if (weekendDays.length === 0) return false;

    const lastWeekendDay = Math.max(...weekendDays);
    for (let offset = 1; offset <= requiredFreeDays; offset++) {
      const recoveryDay = lastWeekendDay + offset;
      if (recoveryDay > numDays) break;
      if (projectedDays.has(recoveryDay)) continue;
      if (empDayAssignment[employee][recoveryDay]) return true;
    }
    return false;
  };
  const changeEmployeeShiftCode = (employee, day, newCode, reasons) => {
    const normalizedNewCode = String(newCode || '').trim().toUpperCase();
    const shift = shifts.find((entry) => entry.employee_name === employee && entry.day === day);
    const oldCode = String(shift?.shift_code || empDayAssignment[employee]?.[day] || '').trim().toUpperCase();
    if (shift) shift.shift_code = normalizedNewCode;
    empDayAssignment[employee][day] = normalizedNewCode;

    if (oldCode && oldCode !== normalizedNewCode) {
      empStats[employee].specialShiftCounts[oldCode] = Math.max(Number(empStats[employee].specialShiftCounts[oldCode] || 0) - 1, 0);
      empStats[employee].specialShiftCounts[normalizedNewCode] = Number(empStats[employee].specialShiftCounts[normalizedNewCode] || 0) + 1;
    }

    explanations[`${employee}_${day}`] = {
      employee,
      day,
      code: normalizedNewCode,
      reasons,
    };
  };
  const addEmployeeTargetCatchupShift = (employee, day, shiftDef, reasons) => {
    const normalizedCode = String(shiftDef.code || '').trim().toUpperCase();
    const weekend = isWeekend(year, mon, day);
    shifts.push({ employee_name: employee, day, shift_code: normalizedCode });
    empDayAssignment[employee][day] = normalizedCode;
    empLastWorkedShiftCode[employee] = normalizedCode;
    empLastWorkedShiftType[employee] = shiftDef.shift_type;
    empLastWorkedDay[employee] = day;

    const shiftHours = getShiftDurationHours(shiftDef);
    if (shiftDef.shift_type === 'night') empStats[employee].nights++;
    if (weekend) {
      empStats[employee].weekends++;
      empStats[employee].workedWeekendBlocks.add(getWeekendBlockKey(year, mon, day));
    }
    if (shiftDef.shift_type === 'early') empStats[employee].earlyCount++;
    if (shiftDef.shift_type === 'late') empStats[employee].lateCount++;
    empStats[employee].total++;
    empStats[employee].specialShiftCounts[normalizedCode] = Number(empStats[employee].specialShiftCounts[normalizedCode] || 0) + 1;
    empHours[employee] += shiftHours;
    empStats[employee].actualHours = Number(empHours[employee].toFixed(2));
    planReport.totalShiftsPlanned++;

    explanations[`${employee}_${day}`] = {
      employee,
      day,
      code: normalizedCode,
      reasons,
    };
  };

  for (const employee of activeEmployees) {
    const fixedShiftType = fixedShiftTypeByEmployee.get(employee);
    const prefs = empPrefsMap.get(employee);
    const preferredCodes = new Set((prefs?.preferred_shifts || []).map((code) => String(code).trim().toUpperCase()));
    const candidateDefinitions = regularCatchupDefinitions
      .filter((definition) => !fixedShiftType || fixedShiftType === normalizePlanningShiftTypeKey(definition.shift_type))
      .sort((left, right) => {
        const leftPreferred = preferredCodes.has(getPreferenceShiftCode(left.code)) ? 1 : 0;
        const rightPreferred = preferredCodes.has(getPreferenceShiftCode(right.code)) ? 1 : 0;
        if (rightPreferred !== leftPreferred) return rightPreferred - leftPreferred;
        const leftContinuity = left.code === empLastWorkedShiftCode[employee] ? 1 : 0;
        const rightContinuity = right.code === empLastWorkedShiftCode[employee] ? 1 : 0;
        if (rightContinuity !== leftContinuity) return rightContinuity - leftContinuity;
        return Number(left.sort_order || 0) - Number(right.sort_order || 0);
      });
    const catchupDefinition = candidateDefinitions[0];
    if (!catchupDefinition) continue;

    while (empHours[employee] < employeeTargetHours[employee]) {
      const availableDays = [];
      for (let day = 1; day <= numDays; day++) {
        if (empDayAssignment[employee][day]) continue;
        const dateStr = `${month}-${String(day).padStart(2, '0')}`;
        if (isEmployeeAbsentOnDate(employee, dateStr)) continue;
        if (isRecoveryProtectedDay(employee, day)) continue;
        if (wouldViolateAdjacentTransition(employee, day, catchupDefinition)) continue;
        const dow = dayOfWeek(year, mon, day);
        if (!normalizeWeekdaySetting(catchupDefinition.applicable_days, [1, 2, 3, 4, 5]).includes(dow)) continue;

        let adjacentWorkdays = 0;
        for (let previous = day - 1; previous >= 1 && empDayAssignment[employee][previous]; previous--) adjacentWorkdays++;
        for (let next = day + 1; next <= numDays && empDayAssignment[employee][next]; next++) adjacentWorkdays++;
        const exceedsWorkdayLimit = adjacentWorkdays + 1 > Math.max(rotation.max_consecutive_workdays || 6, 5);
        const sameCodeNeighbor = empDayAssignment[employee][day - 1] === catchupDefinition.code
          || empDayAssignment[employee][day + 1] === catchupDefinition.code;
        const recoveryEntry = explanations[`${employee}_${day}`]?.reasons?.some((reason) => String(reason).includes('Erholung'));
        availableDays.push({ day, score: (sameCodeNeighbor ? 100 : 0) - (recoveryEntry ? 50 : 0) - (exceedsWorkdayLimit ? 1000 : 0) });
      }

      if (availableDays.length === 0) break;
      availableDays.sort((left, right) => right.score - left.score || left.day - right.day);
      const selectedDay = availableDays[0].day;
      const selectedDate = `${month}-${String(selectedDay).padStart(2, '0')}`;
      const shiftHours = getShiftDurationHours(catchupDefinition);
      shifts.push({ employee_name: employee, day: selectedDay, shift_code: catchupDefinition.code });
      empDayAssignment[employee][selectedDay] = catchupDefinition.code;
      empHours[employee] += shiftHours;
      empStats[employee].total++;
      empStats[employee].actualHours = Number(empHours[employee].toFixed(2));
      if (catchupDefinition.shift_type === 'early') empStats[employee].earlyCount++;
      if (catchupDefinition.shift_type === 'late') empStats[employee].lateCount++;
      planReport.totalShiftsPlanned++;
      explanations[`${employee}_${selectedDay}`] = {
        employee,
        day: selectedDay,
        code: catchupDefinition.code,
        reasons: [
          `Verbindlicher Sollzeitausgleich auf mindestens ${employeeTargetHours[employee]} Stunden`,
          `Schichtkontinuität: ${catchupDefinition.code} statt zufälligem Schichtwechsel`,
          `Nicht abwesend am ${selectedDate}`,
        ],
      };
    }

    if (empHours[employee] < employeeTargetHours[employee]) {
      const earlyWeekendDefinition = shiftDefs.find((definition) => String(definition.code).toUpperCase() === 'E1WE');
      if (earlyWeekendDefinition) {
        for (let monday = 1; monday <= numDays - 6 && empHours[employee] < employeeTargetHours[employee]; monday++) {
          if (dayOfWeek(year, mon, monday) !== 1) continue;
          const saturday = monday + 5;
          const sunday = monday + 6;
          const hasCompleteSaturdayBlock = Array.from({ length: 6 }, (_, offset) => monday + offset)
            .every((day) => empDayAssignment[employee][day] === 'E1SA');
          const sundayDate = `${month}-${String(sunday).padStart(2, '0')}`;
          if (!hasCompleteSaturdayBlock || empDayAssignment[employee][sunday] || isEmployeeAbsentOnDate(employee, sundayDate)) continue;
          if (isRecoveryProtectedDay(employee, sunday)) continue;
          if (violatesWeekendRecoveryAfterBlock(employee, Array.from({ length: 7 }, (_, offset) => monday + offset))) continue;

          for (let day = monday; day <= saturday; day++) {
            const shift = shifts.find((entry) => entry.employee_name === employee && entry.day === day);
            if (shift) shift.shift_code = 'E1WE';
            empDayAssignment[employee][day] = 'E1WE';
            explanations[`${employee}_${day}`] = {
              employee,
              day,
              code: 'E1WE',
              reasons: ['Sollzeitausgleich: vollständiger E1WE-Block Montag bis Sonntag'],
            };
          }
          shifts.push({ employee_name: employee, day: sunday, shift_code: 'E1WE' });
          empDayAssignment[employee][sunday] = 'E1WE';
          empHours[employee] += getShiftDurationHours(earlyWeekendDefinition);
          empStats[employee].total++;
          empStats[employee].weekends++;
          empStats[employee].workedWeekendBlocks.add(getWeekendBlockKey(year, mon, sunday));
          empStats[employee].actualHours = Number(empHours[employee].toFixed(2));
          planReport.totalShiftsPlanned++;
          explanations[`${employee}_${sunday}`] = {
            employee,
            day: sunday,
            code: 'E1WE',
            reasons: [
              `Verbindlicher Sollzeitausgleich auf mindestens ${employeeTargetHours[employee]} Stunden`,
              'E1SA wurde regelkonform zu E1WE Montag bis Sonntag erweitert',
            ],
          };
        }
      }
    }

    while (empHours[employee] < employeeTargetHours[employee]) {
      const missingHours = employeeTargetHours[employee] - empHours[employee];
      const blockCandidates = [];

      for (const blockDefinition of targetCatchupSeriesDefinitions) {
        const blockCode = String(blockDefinition.code || '').trim().toUpperCase();
        const blockType = normalizePlanningShiftTypeKey(blockDefinition.shift_type);
        const seriesDays = getShiftSeriesDays(blockDefinition);
        if (fixedShiftType && fixedShiftType !== blockType) continue;

        const applicableDays = new Set(normalizeWeekdaySetting(blockDefinition.applicable_days, [1, 2, 3, 4, 5, 6, 0]));
        for (let monday = 1; monday <= numDays - seriesDays + 1; monday++) {
          if (dayOfWeek(year, mon, monday) !== 1) continue;

          const blockDays = [];
          let validSeries = true;
          for (let offset = 0; offset < seriesDays; offset++) {
            const day = monday + offset;
            if (!applicableDays.has(dayOfWeek(year, mon, day))) {
              validSeries = false;
              break;
            }
            blockDays.push(day);
          }
          if (!validSeries) continue;

          const weekdayBaseDays = blockDays.filter((day) => {
            const dow = dayOfWeek(year, mon, day);
            return dow >= 1 && dow <= 5;
          });
          if (weekdayBaseDays.length < 5) continue;
          if (!weekdayBaseDays.every((day) => empDayAssignment[employee][day] && getAssignedShiftType(employee, day) === blockType)) continue;

          const additionalDays = blockDays.filter((day) => !empDayAssignment[employee][day]);
          if (additionalDays.length === 0) continue;
          if (additionalDays.some((day) => isEmployeeAbsentOnDate(employee, `${month}-${String(day).padStart(2, '0')}`))) continue;
          if (additionalDays.some((day) => isRecoveryProtectedDay(employee, day))) continue;
          if (additionalDays.some((day) => wouldViolateAdjacentTransition(employee, day, blockDefinition))) continue;
          if (violatesWeekendRecoveryAfterBlock(employee, blockDays)) continue;

          const blockedByOtherShift = blockDays.some((day) => {
            const assignedCode = empDayAssignment[employee][day];
            if (!assignedCode) return false;
            return getAssignedShiftType(employee, day) !== blockType;
          });
          if (blockedByOtherShift) continue;

          const addedHours = additionalDays.reduce((sum) => sum + getShiftDurationHours(blockDefinition), 0);
          blockCandidates.push({
            blockDefinition,
            blockCode,
            blockDays,
            additionalDays,
            addedHours,
            score: Math.abs(addedHours - missingHours) + additionalDays.length * 0.01,
          });
        }
      }

      if (blockCandidates.length === 0) break;
      blockCandidates.sort((left, right) => left.score - right.score || left.blockDays[0] - right.blockDays[0] || left.blockCode.localeCompare(right.blockCode, 'de'));
      const selected = blockCandidates[0];
      const reason = `Verbindlicher Sollzeitausgleich auf mindestens ${employeeTargetHours[employee]} Stunden`;

      for (const day of selected.blockDays) {
        if (empDayAssignment[employee][day]) {
          changeEmployeeShiftCode(employee, day, selected.blockCode, [
            reason,
            `Blockregel: ${selected.blockCode} vollständig von Montag bis ${selected.blockDays.length === 6 ? 'Samstag' : 'Sonntag'}`,
          ]);
        } else {
          addEmployeeTargetCatchupShift(employee, day, selected.blockDefinition, [
            reason,
            `Blockregel: ${selected.blockCode} vollständig von Montag bis ${selected.blockDays.length === 6 ? 'Samstag' : 'Sonntag'}`,
            `Nicht abwesend am ${month}-${String(day).padStart(2, '0')}`,
          ]);
        }
      }
    }
  }

  shifts.sort((left, right) => left.day - right.day || left.employee_name.localeCompare(right.employee_name, 'de'));

  for (const employee of activeEmployees) {
    const missingHours = Number((employeeTargetHours[employee] - empHours[employee]).toFixed(2));
    if (missingHours <= 0) continue;
    conflicts.push({
      day: numDays,
      date: `${month}-${String(numDays).padStart(2, '0')}`,
      shift: null,
      employee: employee,
      severity: 'critical',
      type: 'target_hours_shortfall',
      message: `${employee}: Monatliche Sollzeit um ${missingHours.toFixed(2)} Stunden unterschritten`,
    });
  }

  const targetShortfalls = activeEmployees
    .map((employee) => ({ employee, actualHours: Number(empHours[employee].toFixed(2)), targetHours: employeeTargetHours[employee] }))
    .filter((entry) => entry.actualHours < entry.targetHours);
  if (targetShortfalls.length > 0 && !options.allowShortfall) {
    const preview = targetShortfalls.slice(0, 8).map((entry) => `${entry.employee}: ${entry.actualHours}/${entry.targetHours}h`).join(', ');
    const error = new Error(`Plan nicht gespeichert: ${targetShortfalls.length} Mitarbeiter unterschreiten die Mindeststunden (${preview})`);
    error.code = 'TARGET_HOURS_SHORTFALL';
    error.details = targetShortfalls;
    throw error;
  }

  const fairness = {};
  for (const employee of activeEmployees) {
    fairness[employee] = {
      nights: empStats[employee].nights,
      weekends: empStats[employee].weekends,
      workedWeekendBlocks: empStats[employee].workedWeekendBlocks.size,
      shiftTypeChanges: empStats[employee].shiftTypeChanges,
      earlyCount: empStats[employee].earlyCount,
      lateCount: empStats[employee].lateCount,
      total: empStats[employee].total,
      actualHours: Number(empHours[employee].toFixed(2)),
      targetHours: employeeTargetHours[employee],
      deltaHours: Number((empHours[employee] - employeeTargetHours[employee]).toFixed(2)),
    };
  }

  planReport.conflictsCount = conflicts.length;
  planReport.rulesApplied = [
    `Rotationsregeln: Max ${rotation.max_consecutive_workdays} Arbeitstage, ${rotation.max_nights_per_month} Nächte/Monat`,
    `Serienplanung aktiv: ${shiftDefs.map((definition) => `${definition.code}=${getShiftSeriesDays(definition)} Tage`).join(', ')}`,
    'Wochenanker aktiv: Neue Serien werden zur nächsten Montagkante ausgerichtet',
    `Abwesenheitsgutschrift: Urlaub, Krank und Seminar zählen mit ${CREDITED_ABSENCE_HOURS} Stunden pro Werktag`,
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
    carryState: Object.fromEntries(activeEmployees.map((employee) => [employee, {
      consecutiveWork: empConsecutiveWork[employee],
      lastShiftType: empLastShiftType[employee],
      requiredFreeDays: empRequiredFreeDays[employee],
      recoveryReason: empRecoveryReason[employee],
      seriesCode: empSeriesCode[employee],
      seriesRemaining: empSeriesRemaining[employee],
      lastWorkedShiftCode: empLastWorkedShiftCode[employee],
      lastWorkedShiftType: empLastWorkedShiftType[employee],
      forcedNextShiftCode: empForcedNextShiftCode[employee],
    }])),
    configSnapshot: {
      employees: employees.length,
      activeEmployees: activeEmployees.length,
      excluded: shiftExcludedSet.size,
      daysInMonth: numDays,
      shiftDefinitions: shiftDefs.map((definition) => ({
        code: definition.code,
        name: definition.name,
        type: definition.shift_type,
        minStaff: definition.min_staff,
        maxStaff: definition.max_staff,
        durationHours: getShiftDurationHours(definition),
        seriesDays: getShiftSeriesDays(definition),
        startDayOffset: Number.parseInt(String(definition.start_day_offset ?? 0), 10) || 0,
        endDayOffset: Number.parseInt(String(definition.end_day_offset ?? (definition.shift_type === 'night' ? 1 : 0)), 10) || 0,
      })),
      rotationRules: rotation,
      fairnessRules,
      planningConfig: planConfig,
      dbsPlanningConfig,
      staffingRules,
      specialPools: Object.fromEntries(
        [...specialPoolsByShift.entries()].map(([shiftCode, entries]) => [
          shiftCode,
          [...entries.entries()].map(([employeeName, value]) => ({ employeeName, monthlyMaxAssignments: value.monthlyMaxAssignments })),
        ])
      ),
      effectiveShiftSlots: baselineShiftSlots.map((definition) => ({
        code: definition.code,
        type: definition.shift_type,
        plannedSlots: definition.planned_slots,
        durationHours: getShiftDurationHours(definition),
        seriesDays: getShiftSeriesDays(definition),
      })),
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

router.get('/drafts/year/:year', async (req, res) => {
  try {
    const year = Number.parseInt(req.params.year, 10);
    if (!year || year < 2027 || year > 2040) return res.status(400).json({ ok: false, error: 'Ungültiges Planungsjahr' });
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (month) id AS "draftId", month, version, status, created_at
       FROM shiftplan_drafts
       WHERE month LIKE $1
       ORDER BY month, version DESC`,
      [`${year}-%`]
    );
    res.json({ ok: true, year, generated: rows, errors: [] });
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
    const draft = rows[0];
    const draftEmployees = deduplicateEmployees([
      ...(Array.isArray(draft.shifts_json) ? draft.shifts_json.map((entry) => entry.employee_name) : []),
      ...Object.keys(draft.fairness || {}),
    ]);
    const wishStatus = await loadDraftWishStatus(draftEmployees);
    const wishSummary = wishStatus.reduce((summary, entry) => {
      if (entry.submitted) summary.submitted += 1;
      else summary.missing += 1;
      return summary;
    }, { submitted: 0, missing: 0 });
    const absences = await loadDraftAbsences(draft.month);
    const manualEmployees = await loadManualEmployeesForDraftMonth(draft.month);

    res.json({
      ok: true,
      draft: {
        ...draft,
        wish_status: wishStatus,
        wish_summary: wishSummary,
        absences,
        manual_employees: manualEmployees,
      },
    });
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

    const manualEmployeeNames = await loadManualEmployeeNameSetForDraftMonth(draftMonth, client);

    // Delete existing shifts for this month. Also clean up legacy rows written with the raw YYYY-MM key.
    await client.query('DELETE FROM shifts WHERE month = $1 OR month = $2', [liveMonthLabel, draftMonth]);

    // Insert draft shifts
    for (const s of shifts) {
      await client.query(
        'INSERT INTO shifts (month, employee_name, day, shift_code, source) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (month, employee_name, day) DO UPDATE SET shift_code = $4, source = $5',
        [liveMonthLabel, s.employee_name, s.day, s.shift_code, manualEmployeeNames.has(s.employee_name) ? 'manual' : 'import']
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
  E1SA: { fill: 'DBEAFE', font: '1E40AF' },
  E1WE: { fill: 'BFDBFE', font: '1E40AF' },
  L1: { fill: 'FEF3C7', font: '92400E' },
  L2: { fill: 'FDE68A', font: '92400E' },
  L1WE: { fill: 'FEF3C7', font: '92400E' },
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
    ws.getCell(4, statsCol).value = 'Stunden';
    ws.getCell(4, statsCol).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    ws.getCell(4, statsCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A5F' } };
    ws.getCell(4, statsCol).alignment = { horizontal: 'center' };
    ws.getRow(4).height = 22;

    const durationByCode = new Map(
      (draft.config_snapshot?.shiftDefinitions || []).map((definition) => [
        String(definition.code || '').trim().toUpperCase(),
        Number(definition.durationHours) || 8,
      ])
    );

    // Data rows
    empNames.forEach((emp, idx) => {
      const row = idx + 5;
      const nameCell = ws.getCell(row, 1);
      nameCell.value = emp;
      nameCell.font = { name: 'Calibri', size: 9, bold: true };
      nameCell.border = { top: { style: 'thin', color: { argb: 'D1D5DB' } }, bottom: { style: 'thin', color: { argb: 'D1D5DB' } }, left: { style: 'thin', color: { argb: 'D1D5DB' } }, right: { style: 'thin', color: { argb: 'D1D5DB' } } };
      if (idx % 2 === 1) nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };

      let fallbackHours = 0;
      for (let d = 1; d <= numDays; d++) {
        const code = byEmployee[emp][d] || '';
        const cell = ws.getCell(row, d + 1);
        cell.value = code;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 9 };
        cell.border = { top: { style: 'thin', color: { argb: 'D1D5DB' } }, bottom: { style: 'thin', color: { argb: 'D1D5DB' } }, left: { style: 'thin', color: { argb: 'D1D5DB' } }, right: { style: 'thin', color: { argb: 'D1D5DB' } } };

        const colors = SHIFT_COLORS[code];
        if (code) fallbackHours += durationByCode.get(String(code).trim().toUpperCase()) || 8;
        if (colors) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.fill } };
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: colors.font } };
        } else {
          const dow = new Date(year, mon - 1, d).getDay();
          if (dow === 0 || dow === 6) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } };
          } else if (idx % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };
          }
        }
      }

      // Credited monthly hours (includes configured shift durations and absences).
      const totalCell = ws.getCell(row, statsCol);
      const reportedHours = Number(draft.fairness?.[emp]?.actualHours);
      totalCell.value = Number.isFinite(reportedHours) ? reportedHours : fallbackHours;
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
    ws.getCell(footerRow, 1).value = `Exportiert am ${new Date().toLocaleString('de-DE', { timeZone: config.OPERATIONAL_TIMEZONE })} — ODIN Schichtplan v${draft.version}`;
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
    const employees = await loadEmployeesForPlanningYear(year, String(month));
    const manualEmployees = await loadManualEmployeesForDraftMonth(String(month));

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
        manualEmployees,
        month,
        daysInMonth: numDays,
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/manual-employees', requirePageAccess('shiftplan_control', 'view'), async (req, res) => {
  try {
    const month = String(req.query?.month || '').trim();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ ok: false, error: 'month parameter required (YYYY-MM)' });
    }

    const employees = await loadManualEmployeesForDraftMonth(month);
    res.json({ ok: true, employees });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/manual-employees/summary', requirePageAccess('shiftplan_control', 'view'), async (req, res) => {
  try {
    const year = Number.parseInt(String(req.query?.year || ''), 10);
    if (!Number.isInteger(year)) {
      return res.status(400).json({ ok: false, error: 'year parameter required' });
    }

    const months = await loadManualEmployeeSummaryForYear(year);
    res.json({ ok: true, months });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/manual-employees', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  try {
    const month = String(req.body?.month || '').trim();
    const employeeName = normalizeEmployeeName(req.body?.employeeName);
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ ok: false, error: 'month parameter required (YYYY-MM)' });
    }
    if (!employeeName) {
      return res.status(400).json({ ok: false, error: 'employeeName is required' });
    }

    const liveMonthLabel = resolveLiveMonthLabelFromDraftMonth(month);
    if (!liveMonthLabel) {
      return res.status(400).json({ ok: false, error: 'Ungültiges Monatsformat' });
    }

    const duplicateRes = await pool.query(
      `SELECT COALESCE(source, 'import') AS source
         FROM shifts
        WHERE month = $1
          AND employee_name = $2
        LIMIT 1`,
      [liveMonthLabel, employeeName]
    );
    if (duplicateRes.rowCount > 0 && duplicateRes.rows[0]?.source !== 'manual') {
      return res.status(409).json({ ok: false, error: 'Employee already exists in the imported shiftplan for this month' });
    }

    const createdBy = req.user?.displayName || req.user?.email || req.user?.username || 'unknown';
    const { rows } = await pool.query(
      `INSERT INTO manual_shiftplan_employees (month, employee_name, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (month, employee_name) DO NOTHING
       RETURNING employee_name, created_at, created_by`,
      [liveMonthLabel, employeeName, createdBy]
    );

    if (!rows.length) {
      return res.status(409).json({ ok: false, error: 'Manual employee already exists for this month' });
    }

    res.status(201).json({ ok: true, employee: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/manual-employees', requirePageAccess('shiftplan_control', 'write'), async (req, res) => {
  const client = await pool.connect();
  try {
    const month = String(req.query?.month || '').trim();
    const employeeName = normalizeEmployeeName(req.query?.employeeName);
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ ok: false, error: 'month parameter required (YYYY-MM)' });
    }
    if (!employeeName) {
      return res.status(400).json({ ok: false, error: 'employeeName is required' });
    }

    const liveMonthLabel = resolveLiveMonthLabelFromDraftMonth(month);
    if (!liveMonthLabel) {
      return res.status(400).json({ ok: false, error: 'Ungültiges Monatsformat' });
    }

    await client.query('BEGIN');
    const deleteManualRes = await client.query(
      `DELETE FROM manual_shiftplan_employees
        WHERE month = $1
          AND employee_name = $2`,
      [liveMonthLabel, employeeName]
    );

    if (deleteManualRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Manual employee not found' });
    }

    await client.query(
      `DELETE FROM shifts
        WHERE month = $1
          AND employee_name = $2
          AND COALESCE(source, 'import') = 'manual'`,
      [liveMonthLabel, employeeName]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
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
    if (!yearNum || yearNum < 2027 || yearNum > 2040) {
      return res.status(400).json({ ok: false, error: 'Jahresplanungen sind nur für 2027–2040 möglich' });
    }

    console.log(`[SHIFTPLAN] Generating drafts for full year ${yearNum}`);
    const createdBy = req.user?.email || req.user?.username || 'system';
    const results = [];
    const generatedPlans = [];
    let carryState = null;

    for (let mon = 1; mon <= 12; mon++) {
      const month = `${yearNum}-${String(mon).padStart(2, '0')}`;
      const numDays = daysInMonth(yearNum, mon);
      const result = await generateShiftPlan(yearNum, mon, numDays, createdBy, { carryState });
      carryState = result.carryState;
      generatedPlans.push({ month, result });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const { month, result } of generatedPlans) {
        const verRes = await client.query(
          'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM shiftplan_drafts WHERE month = $1',
          [month]
        );
        const nextVersion = verRes.rows[0].next_version;

        const { rows } = await client.query(
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
      }
      await client.query('COMMIT');
    } catch (insertErr) {
      await client.query('ROLLBACK');
      throw insertErr;
    } finally {
      client.release();
    }

    console.log(`[SHIFTPLAN] Year ${yearNum}: complete connected plan with ${results.length}/12 months generated`);
    res.json({ ok: true, year: yearNum, generated: results, errors: [], total: results.length });
  } catch (err) {
    console.error('Year generation error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
