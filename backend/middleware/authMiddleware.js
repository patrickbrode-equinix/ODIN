/* ———————————————————————————————— */
/* AUTH MIDDLEWARE – JWT ONLY (CLEAN) */
/* ———————————————————————————————— */

import jwt from "jsonwebtoken";
import db from "../db.js";
import { resolveUserRole } from "../auth/accessControl.js";

/* ———————————————————————————————— */
/* REQUIRE AUTH                                     */
/* ———————————————————————————————— */

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // Also support ?token= for EventSource (SSE) which can't set headers
  let rawToken = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    rawToken = authHeader.split(" ")[1];
  } else if (req.query?.token) {
    rawToken = String(req.query.token);
  }

  if (!rawToken) {
    return res.status(401).json({ message: "Missing or malformed Authorization header" });
  }

  try {
    const token = rawToken;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await db.query(
      `
      SELECT
        id,
        email,
        user_group,
        approved,
        is_root,
        is_admin,
        must_change_password
      FROM users
      WHERE id = $1
      `,
      [decoded.userId]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = result.rows[0];
  const role = resolveUserRole(user);

    /* ———————————————————————————————— */
    /* ATTACH USER CONTEXT                */
    /* ———————————————————————————————— */

    req.user = {
      id: user.id,
      email: user.email,
      group: user.user_group,
      approved: user.approved === true,
      is_root: user.is_root === true,
      is_admin: user.is_admin === true,
      must_change_password: user.must_change_password === true,
      role,
    };

    req.isRoot = user.is_root === true;

    /* ———————————————————————————————— */
    /* APPROVAL CHECK (ROOT BYPASS)       */
    /* ———————————————————————————————— */

    if (!req.user.approved && !req.isRoot) {
      return res.status(403).json({
        code: "ACCOUNT_NOT_APPROVED",
        message: "Account wartet auf Freigabe",
      });
    }

    if (req.user.must_change_password && !req.isRoot) {
      const allowPasswordChangeOnly = req.originalUrl.startsWith("/api/auth/change-password") || req.originalUrl.startsWith("/api/user/");
      if (!allowPasswordChangeOnly) {
        return res.status(403).json({
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "Initiales Passwort muss vor der Nutzung von ODIN geändert werden",
        });
      }
    }

    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
