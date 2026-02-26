/* ———————————————————————————————— */
/* RBAC – PAGE ACCESS ENFORCEMENT                   */
/* Source of truth: group policy + user override    */
/* Levels: none | view | write                      */
/* ———————————————————————————————— */

import db from "../db.js";
import { normalizeGroupKey } from "../db/initSchema.js";

/* ———————————————————————————————— */
/* ACCESS LEVEL ORDER                               */
/* ———————————————————————————————— */

const LEVEL_ORDER = {
  none: 0,
  view: 1,
  write: 2,
};

function normalizeLevel(raw) {
  const l = String(raw || "").toLowerCase().trim();
  if (l === "view" || l === "write") return l;
  if (l === "manage") return "write"; // legacy safety
  return "none";
}

function meets(level, min) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[min];
}

/* ———————————————————————————————— */
/* MAIN MIDDLEWARE                                  */
/* ———————————————————————————————— */

export function requirePageAccess(pageKey, minLevel = "view") {
  return async function (req, res, next) {
    try {
      /* --- authMiddleware MUSS vorher laufen --- */
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      /* --- Root: immer erlaubt --- */
      if (user.is_root === true) {
        return next();
      }

      /* --- Nicht approved: block --- */
      if (user.approved !== true) {
        return res.status(403).json({
          code: "ACCOUNT_NOT_APPROVED",
          message: "Account wartet auf Freigabe",
        });
      }

      /* ———————————————————————————————— */
      /* LOAD GROUP POLICY                         */
      /* ———————————————————————————————— */

      const groupKey = normalizeGroupKey(user.group);

      const groupRes = await db.query(
        `SELECT policy FROM groups WHERE key = $1`,
        [groupKey]
      );

      const groupPolicy =
        groupRes.rowCount > 0 ? groupRes.rows[0].policy || {} : {};

      /* ———————————————————————————————— */
      /* LOAD USER OVERRIDES                       */
      /* ———————————————————————————————— */

      const userRes = await db.query(
        `SELECT access_override FROM users WHERE id = $1`,
        [user.id]
      );

      const accessOverride =
        userRes.rowCount > 0 ? userRes.rows[0].access_override || {} : {};

      /* ———————————————————————————————— */
      /* EFFECTIVE LEVEL                           */
      /* override > group > none                  */
      /* ———————————————————————————————— */

      const rawLevel =
        Object.prototype.hasOwnProperty.call(accessOverride, pageKey)
          ? accessOverride[pageKey]
          : groupPolicy[pageKey];

      const level = normalizeLevel(rawLevel);
      const required = normalizeLevel(minLevel);

      if (!meets(level, required)) {
        return res.status(403).json({
          code: "INSUFFICIENT_PERMISSION",
          message: `Access denied (${pageKey}:${required})`,
        });
      }

      next();
    } catch (err) {
      console.error("RBAC ERROR:", err);
      res.status(500).json({ message: "Permission check failed" });
    }
  };
}
