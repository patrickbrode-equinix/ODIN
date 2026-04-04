/* ================================================ */
/* Assignment Engine — Load Candidate Workers       */
/* ================================================ */

import pool from '../../db.js';

/**
 * Weekplan role ↔ engine role mapping.
 * The weekplan uses slightly different key names than the engine constants.
 */
const WEEKPLAN_TO_ENGINE_ROLE = {
  dispatcher: 'dispatcher',
  dbs_project: 'deutsche_boerse',
  colo: 'normal',          // Kolo has no special assignment restriction (informational)
  largeorder: 'large_order',
  projekt: 'project',
  lead: 'leads',
  buddy: 'buddy',
  neueinsteiger: 'neustarter',
  cc: 'cross_connect',
  support: 'support',
};

/**
 * Load candidate workers from the user/shift system.
 * Includes assignment_role, shift_active, and current workload.
 * Weekplan role for today takes priority over static assignment_role.
 *
 * Returns an array of worker objects:
 * { id, name, email, group, site, responsibility, role, weekplanRole, shiftActive, onBreak, absent, autoAssignable, blocked }
 */
export async function loadCandidateWorkers() {
  const today = new Date().toISOString().split('T')[0];

  const { rows } = await pool.query(`
    SELECT
      u.id,
      COALESCE(u.first_name || ' ' || u.last_name, u.email) AS name,
      u.email,
      u.user_group AS "group",
      u.ibx AS site,
      u.department AS responsibility,
      COALESCE(u.assignment_role, 'normal') AS assignment_role,
      COALESCE(u.shift_active, true) AS shift_active,
      COALESCE(u.auto_assignable, true) AS auto_assignable,
      COALESCE(u.blocked, false) AS blocked,
      COALESCE(u.on_break, false) AS on_break,
      COALESCE(u.absent, false) AS absent,
      wr.role_key AS weekplan_role
    FROM users u
    LEFT JOIN weekplan_roles wr
      ON LOWER(TRIM(COALESCE(u.first_name || ' ' || u.last_name, u.email))) = LOWER(TRIM(wr.employee_name))
      AND wr.date = $1
    WHERE u.approved = true
      AND u.is_root = false
    ORDER BY u.id
  `, [today]);

  return rows.map(r => {
    // Weekplan role for today takes priority over static assignment_role
    const weekplanRole = r.weekplan_role || null;
    const engineRole = weekplanRole
      ? (WEEKPLAN_TO_ENGINE_ROLE[weekplanRole] || 'normal')
      : (r.assignment_role || 'normal');

    return {
      id: r.id,
      name: r.name || r.email,
      email: r.email,
      group: r.group,
      site: r.site || null,
      responsibility: r.responsibility || null,
      role: engineRole,
      weekplanRole: weekplanRole,
      shiftActive: r.shift_active !== false,
      onBreak: !!r.on_break,
      absent: !!r.absent,
      autoAssignable: r.auto_assignable !== false,
      blocked: !!r.blocked,
    };
  });
}

/**
 * Build the candidate pool from loaded workers.
 * Applies basic filtering (active, not blocked, auto-assignable).
 */
export function buildCandidatePool(workers) {
  return workers.filter(w =>
    w.autoAssignable &&
    !w.blocked
  );
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
    nameToId.set(c.name?.toLowerCase().trim(), c.id);
    nameToId.set(c.email?.toLowerCase().trim(), c.id);
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
        AND qi.owner IS NOT NULL
        AND qi.owner <> ''
      ORDER BY qi.id
    `);

    for (const row of rows) {
      const ownerKey = row.owner?.toLowerCase().trim();
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
