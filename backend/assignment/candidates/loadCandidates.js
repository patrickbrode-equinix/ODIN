/* ================================================ */
/* Assignment Engine — Load Candidate Workers       */
/* ================================================ */

import pool from '../../db.js';

/**
 * Load candidate workers from the shift/schedule system.
 * Only loads workers who are in the current active shift context.
 *
 * Returns an array of worker objects:
 * { id, name, email, group, site, responsibility, shiftType, onBreak, absent, autoAssignable, blocked }
 */
export async function loadCandidateWorkers() {
  // Load all active users who could be candidates
  // Uses actual ODIN users table columns:
  //   user_group = group, ibx = site, department = responsibility
  const { rows } = await pool.query(`
    SELECT
      u.id,
      COALESCE(u.first_name || ' ' || u.last_name, u.email) AS name,
      u.email,
      u.user_group AS "group",
      u.ibx AS site,
      u.department AS responsibility,
      COALESCE(u.auto_assignable, true) AS auto_assignable,
      COALESCE(u.blocked, false) AS blocked,
      COALESCE(u.on_break, false) AS on_break,
      COALESCE(u.absent, false) AS absent
    FROM users u
    WHERE u.approved = true
      AND u.is_root = false
    ORDER BY u.id
  `);

  return rows.map(r => ({
    id: r.id,
    name: r.name || r.email,
    email: r.email,
    group: r.group,
    site: r.site || null,
    responsibility: r.responsibility || null,
    shiftType: null, // Will be enriched if shift data is available
    onBreak: !!r.on_break,
    absent: !!r.absent,
    autoAssignable: r.auto_assignable !== false,
    blocked: !!r.blocked,
  }));
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
