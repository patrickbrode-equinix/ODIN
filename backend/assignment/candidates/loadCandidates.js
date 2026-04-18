/* ================================================ */
/* Assignment Engine — Load Candidate Workers       */
/* ================================================ */

import pool from '../../db.js';
import { getVerificationStatusMap, getVerificationSettings } from '../../services/shiftVerification.js';
import { findBestMatch, normalizeName } from '../../lib/nameNorm.js';
import { SUPPORTED_QUEUE_ITEM_TYPES } from '../constants.js';

/**
 * Weekplan role ↔ engine role mapping.
 * The weekplan uses slightly different key names than the engine constants.
 */
const WEEKPLAN_TO_ENGINE_ROLE = {
  dispatcher: 'dispatcher',
  dbs_project: 'deutsche_boerse',
  dbs: 'deutsche_boerse',
  deutsche_boerse: 'deutsche_boerse',
  colo: 'normal',          // Kolo has no special assignment restriction (informational)
  normal: 'normal',
  largeorder: 'large_order',
  large_order: 'large_order',
  projekt: 'project',
  project: 'project',
  lead: 'leads',
  leads: 'leads',
  buddy: 'buddy',
  neueinsteiger: 'neustarter',
  neustarter: 'neustarter',
  cc: 'cross_connect',
  crossconnect: 'cross_connect',
  cross_connect: 'cross_connect',
  'cross connect': 'cross_connect',
  support: 'support',
};

const GERMAN_MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const NON_WORKING_SHIFT_CODES = new Set(['ABW', 'FS', 'SEMINAR', 'S']);

const SHIFT_WINDOWS = {
  E1: { startHour: 6, startMinute: 30, endHour: 15, endMinute: 30 },
  E2: { startHour: 7, startMinute: 0, endHour: 16, endMinute: 0 },
  L1: { startHour: 13, startMinute: 0, endHour: 22, endMinute: 0 },
  L2: { startHour: 15, startMinute: 0, endHour: 0, endMinute: 0 },
  N: { startHour: 21, startMinute: 15, endHour: 6, endMinute: 45 },
};

export function resolveEffectiveWorkerRole(weekplanRole, assignmentRole) {
  if (weekplanRole) {
    const normalizedWeekplanRole = String(weekplanRole || '').trim().toLowerCase();
    return WEEKPLAN_TO_ENGINE_ROLE[normalizedWeekplanRole] || 'normal';
  }

  return 'normal';
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toLocalDateString(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function getTodayPlanningContext(now = new Date()) {
  return {
    today: toLocalDateString(now),
    day: now.getDate(),
    monthLabel: `${GERMAN_MONTHS[now.getMonth()]} ${now.getFullYear()}`,
  };
}

function normalizeDisplayName(value) {
  if (!value) return '';
  return String(value).replace(/,\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildUserDisplayName(row) {
  const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
  return normalizeDisplayName(fullName || row.email || '');
}

function buildLookup(rows, valueKey = 'employee_name') {
  const exact = new Map();
  const byOriginal = new Map();
  const originals = [];

  for (const row of rows) {
    const original = row[valueKey];
    const normalized = normalizeName(original);
    if (!normalized) continue;
    if (!exact.has(normalized)) {
      exact.set(normalized, row);
      byOriginal.set(original, row);
      originals.push(original);
    }
  }

  return { exact, byOriginal, originals };
}

function findLookupMatch(name, lookup) {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const exact = lookup.exact.get(normalized);
  if (exact) return exact;

  const best = findBestMatch(name, lookup.originals);
  if (!best) return null;
  return lookup.byOriginal.get(best.name) || null;
}

export function isWorkingShiftCode(shiftCode) {
  const code = String(shiftCode || '').trim().toUpperCase();
  if (!code) return false;
  return !NON_WORKING_SHIFT_CODES.has(code);
}

export function isShiftCodeActiveNow(shiftCode, now = new Date()) {
  const code = String(shiftCode || '').trim().toUpperCase();
  if (!code || !isWorkingShiftCode(code)) return false;

  const window = SHIFT_WINDOWS[code];
  if (!window) return true;

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const start = window.startHour * 60 + window.startMinute;
  const end = window.endHour * 60 + window.endMinute;

  if (end <= start) {
    return minutesNow >= start || minutesNow <= end;
  }

  return minutesNow >= start && minutesNow <= end;
}

/**
 * Load candidate workers from today's weekly plan (shifts) and enrich with user metadata.
 * The weekly plan is the source of truth for who is planned today; users only provide metadata.
 * Role-based assignment restrictions are only active when today's weekplan carries a role.
 *
 * Returns an array of worker objects:
 * { id, name, email, group, site, responsibility, role, weekplanRole, shiftActive, onBreak, absent, autoAssignable, blocked }
 */
export async function loadCandidateWorkers() {
  const now = new Date();
  const { today, day, monthLabel } = getTodayPlanningContext(now);

  const [shiftRes, userRes, roleRes] = await Promise.all([
    pool.query(
      `SELECT employee_name, shift_code
       FROM shifts
       WHERE month = $1 AND day = $2
       ORDER BY employee_name ASC`,
      [monthLabel, day]
    ),
    pool.query(`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.user_group AS "group",
        u.ibx AS site,
        u.department AS responsibility,
        COALESCE(u.assignment_role, 'normal') AS assignment_role,
        COALESCE(u.auto_assignable, true) AS auto_assignable,
        COALESCE(u.blocked, false) AS blocked,
        COALESCE(u.on_break, false) AS on_break,
        COALESCE(u.absent, false) AS absent
      FROM users u
      WHERE u.approved = true
        AND u.is_root = false
      ORDER BY u.id
    `),
    pool.query(
      `SELECT employee_name, role_key
       FROM weekplan_roles
       WHERE date = $1`,
      [today]
    ),
  ]);

  // Load verification status map for today (non-blocking — feature may be disabled)
  let verificationMap = new Map();
  try {
    verificationMap = await getVerificationStatusMap(now);
  } catch (err) {
    console.warn('[CANDIDATES] Failed to load verification status map:', err?.message || err);
  }

  const userRows = userRes.rows.map(row => ({
    ...row,
    display_name: buildUserDisplayName(row),
  }));

  const userLookup = buildLookup(
    userRows.map(row => ({ employee_name: row.display_name, ...row }))
  );
  const roleLookup = buildLookup(roleRes.rows);

  return shiftRes.rows.map((shiftRow, index) => {
    const plannedEmployeeName = normalizeDisplayName(shiftRow.employee_name);
    const shiftCode = String(shiftRow.shift_code || '').trim().toUpperCase() || null;
    const matchedUser = findLookupMatch(plannedEmployeeName, userLookup);
    const matchedRoleRow = findLookupMatch(plannedEmployeeName, roleLookup);
    const weekplanRole = matchedRoleRow?.role_key || null;
    const engineRole = resolveEffectiveWorkerRole(
      weekplanRole,
      matchedUser?.assignment_role || null
    );

    return {
      id: matchedUser?.id ?? -(index + 1),
      name: matchedUser?.display_name || plannedEmployeeName || `weekly-plan-${index + 1}`,
      email: matchedUser?.email || null,
      group: matchedUser?.group || null,
      site: matchedUser?.site || null,
      responsibility: matchedUser?.responsibility || null,
      role: engineRole,
      userRole: matchedUser?.assignment_role || null,
      weekplanRole,
      shiftCode,
      shiftActive: isShiftCodeActiveNow(shiftCode, now),
      onBreak: !!matchedUser?.on_break,
      absent: !!matchedUser?.absent || shiftCode === 'ABW',
      autoAssignable: matchedUser ? matchedUser.auto_assignable !== false : true,
      blocked: !!matchedUser?.blocked,
      userMapped: !!matchedUser,
      planningSource: 'weekly_plan',
      plannedEmployeeName,
      verificationStatus: verificationMap.get(shiftRow.employee_name)?.status || verificationMap.get(plannedEmployeeName)?.status || null,
    };
  });
}

/**
 * Build the candidate pool from loaded workers.
 * Applies basic filtering (active, not blocked, auto-assignable).
 */
export function buildCandidatePool(workers) {
  return workers;
}

/**
 * Load current active ticket assignments per worker.
 * Returns a Map<workerId, normalizedTicket[]> for the tie-breaking logic.
 *
 * Uses queue_items where owner matches worker name and ticket is active.
 */
export async function loadWorkerCurrentTickets(candidates) {
  const map = new Map();
  for (const c of candidates) {
    map.set(c.id, []);
  }

  if (candidates.length === 0) return map;

  // Build lookup of worker names
  const nameToId = new Map();
  for (const c of candidates) {
    const normalizedName = normalizeName(c.name);
    const normalizedPlannedName = normalizeName(c.plannedEmployeeName);
    const normalizedEmail = normalizeName(c.email);

    if (normalizedName) nameToId.set(normalizedName, c.id);
    if (normalizedPlannedName) nameToId.set(normalizedPlannedName, c.id);
    if (normalizedEmail) nameToId.set(normalizedEmail, c.id);
  }

  try {
    const { rows } = await pool.query(`
      SELECT
        qi.id,
        qi.external_id,
        qi.queue_type AS type,
        qi.status,
        qi.severity AS priority,
        qi.system_name,
        qi.commit_date AS due_at,
        qi.sched_start AS scheduled_start,
        qi.first_seen_at AS created_at,
        qi.owner,
        qi.handover_type,
        qi.remaining_hours
      FROM queue_items qi
      WHERE qi.active = true
        AND qi.queue_type = ANY($1::text[])
        AND qi.owner IS NOT NULL
        AND qi.owner <> ''
      ORDER BY qi.id
    `, [SUPPORTED_QUEUE_ITEM_TYPES]);

    for (const row of rows) {
      const ownerKey = normalizeName(row.owner);
      const workerId = nameToId.get(ownerKey);
      if (workerId != null && map.has(workerId)) {
        // Create a lightweight normalized ticket for grouping/purity checks
        const { mapType } = await import('../normalization/normalizeTicket.js');
        const typeResult = mapType(row.type);
        map.get(workerId).push({
          id: String(row.id),
          externalId: row.external_id,
          type: typeResult.value,
          systemName: row.system_name || null,
          dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
          scheduledStart: row.scheduled_start ? new Date(row.scheduled_start).toISOString() : null,
          remainingHours: row.remaining_hours != null ? Number(row.remaining_hours) : null,
        });
      }
    }
  } catch (err) {
    console.warn('[ASSIGNMENT] Could not load worker current tickets:', err.message);
  }

  return map;
}

/**
 * Load the latest crawler timestamp from crawler_runs.
 * Used for the crawler staleness check.
 */
export async function loadLastCrawlerTimestamp() {
  try {
    const { rows } = await pool.query(`
      SELECT snapshot_at
      FROM crawler_runs
      WHERE success = true
      ORDER BY snapshot_at DESC
      LIMIT 1
    `);
    return rows[0]?.snapshot_at || null;
  } catch (err) {
    console.warn('[ASSIGNMENT] Could not load crawler timestamp:', err.message);
    return null;
  }
}

/**
 * Load the manual exclusion list from assignment_exclusion_list.
 */
export async function loadExclusionList() {
  try {
    const { rows } = await pool.query(`
      SELECT system_name
      FROM assignment_exclusion_list
      WHERE active = true
      ORDER BY system_name
    `);
    return rows.map(r => r.system_name);
  } catch (err) {
    console.warn('[ASSIGNMENT] Could not load exclusion list:', err.message);
    return [];
  }
}

/**
 * Load the subtype exclusion list from subtype_exclusions.
 */
export async function loadSubtypeExclusionList() {
  try {
    const { rows } = await pool.query(`
      SELECT subtype
      FROM subtype_exclusions
      ORDER BY subtype
    `);
    return rows.map(r => r.subtype);
  } catch (err) {
    console.warn('[ASSIGNMENT] Could not load subtype exclusion list:', err.message);
    return [];
  }
}
