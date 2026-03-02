/* ———————————————————————————————— */
/* AUTH MIDDLEWARE – JWT ONLY (CLEAN) */
/* ———————————————————————————————— */

import jwt from "jsonwebtoken";
import db from "../db.js";

/* ———————————————————————————————— */
/* REQUIRE AUTH                                     */
/* ———————————————————————————————— */

export async function requireAuth(req, res, next) {
  // TEMP BYPASS: Grant Root access automatically for VM testing
  req.user = {
    id: 1,
    email: "admin@local",
    group: "root",
    approved: true,
    is_root: true,
  };
  req.isRoot = true;
  return next();

  const authHeader = req.headers.authorization;

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await db.query(
      `
      SELECT
        id,
        email,
        user_group,
        approved,
        is_root
      FROM users
      WHERE id = $1
      `,
      [decoded.userId]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = result.rows[0];

    /* ———————————————————————————————— */
    /* ATTACH USER CONTEXT                */
    /* ———————————————————————————————— */

    req.user = {
      id: user.id,
      email: user.email,
      group: user.user_group,
      approved: user.approved === true,
      is_root: user.is_root === true,
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

    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
