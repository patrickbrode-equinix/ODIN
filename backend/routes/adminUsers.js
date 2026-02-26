/* ———————————————— */
/* USERS – MANAGEMENT API (POLICY-ONLY)            */
/* Root is technical & protected via is_root       */
/* RBAC enforced via requirePageAccess             */
/* ———————————————— */

import express from "express";
import bcrypt from "bcrypt";
import db from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  groupExists,
  normalizeGroupKey,
} from "../db/initSchema.js";
import { requirePageAccess } from "../middleware/requirePageAccess.js";

const router = express.Router();

/* ———————————————— */
/* HELPERS                                          */
/* ———————————————— */

function normalizeEmail(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeGroup(value) {
  return normalizeGroupKey(value);
}

/* 🔒 FINAL: sanitize access override */
function sanitizeAccessOverride(input) {
  const out = {};

  if (!input || typeof input !== "object") {
    return out;
  }

  for (const [pageKey, rawLevel] of Object.entries(input)) {
    const level = String(rawLevel || "").toLowerCase().trim();

    if (level === "view" || level === "write") {
      out[pageKey] = level;
    } else if (level === "manage") {
      // legacy mapping
      out[pageKey] = "write";
    }
    // alles andere -> ignorieren (Default greift)
  }

  return out;
}

/* ———————————————— */
/* GET – LIST USERS                                 */
/* view access                                      */
/* ———————————————— */

router.get(
  "/",
  requireAuth,
  requirePageAccess("user_management", "view"),
  async (req, res) => {
    try {
      const result = await db.query(
        `
        SELECT
          id,
          first_name AS "firstName",
          last_name  AS "lastName",
          email,
          ibx,
          department,
          user_group AS "group",
          approved,
          is_root    AS "isRoot",
          created_at AS "createdAt"
        FROM users
        ORDER BY id ASC
        `
      );

      res.json(result.rows);
    } catch (err) {
      console.error("USERS LIST ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ———————————————— */
/* POST – CREATE USER                               */
/* write access                                     */
/* ———————————————— */

router.post(
  "/",
  requireAuth,
  requirePageAccess("user_management", "write"),
  async (req, res) => {
    const { firstName, lastName, email, ibx, department, group } = req.body;

    if (!firstName || !lastName || !email || !ibx || !(department || group)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      const emailLower = normalizeEmail(email);
      const groupKey = normalizeGroup(department || group);

      if (!(await groupExists(groupKey))) {
        return res.status(400).json({ message: "Invalid group" });
      }

      const existing = await db.query(
        `SELECT 1 FROM users WHERE email = $1`,
        [emailLower]
      );
      if (existing.rowCount > 0) {
        return res.status(409).json({ message: "User already exists" });
      }

      const username =
        firstName.trim().charAt(0).toLowerCase() +
        lastName.trim().toLowerCase();

      const passwordHash = await bcrypt.hash("1234", 10);

      const result = await db.query(
        `
        INSERT INTO users (
          first_name,
          last_name,
          username,
          email,
          password_hash,
          user_group,
          department,
          ibx,
          approved,
          is_root
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,false)
        RETURNING id
        `,
        [
          firstName,
          lastName,
          username,
          emailLower,
          passwordHash,
          groupKey,
          groupKey,
          ibx,
        ]
      );

      res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
      console.error("USER CREATE ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ———————————————— */
/* PATCH – UPDATE USER                              */
/* write access                                     */
/* ———————————————— */

router.patch(
  "/:id",
  requireAuth,
  requirePageAccess("user_management", "write"),
  async (req, res) => {
    const targetUserId = Number(req.params.id);
    const { group, department, ibx, firstName, lastName, approved } = req.body;

    try {
      const current = await db.query(
        `SELECT is_root FROM users WHERE id = $1`,
        [targetUserId]
      );

      if (current.rowCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      if (current.rows[0].is_root) {
        return res
          .status(403)
          .json({ message: "Root user cannot be modified" });
      }

      const fields = [];
      const values = [];
      let idx = 1;

      if (group !== undefined || department !== undefined) {
        const g = normalizeGroup(department || group);
        if (!(await groupExists(g))) {
          return res.status(400).json({ message: "Invalid group" });
        }
        fields.push(`user_group = $${idx++}`);
        values.push(g);
        fields.push(`department = $${idx++}`);
        values.push(g);
      }

      if (ibx !== undefined) {
        fields.push(`ibx = $${idx++}`);
        values.push(ibx);
      }

      if (firstName !== undefined) {
        fields.push(`first_name = $${idx++}`);
        values.push(firstName);
      }

      if (lastName !== undefined) {
        fields.push(`last_name = $${idx++}`);
        values.push(lastName);
      }

      if (approved !== undefined) {
        fields.push(`approved = $${idx++}`);
        values.push(Boolean(approved));
      }

      if (!fields.length) {
        return res.status(400).json({ message: "Nothing to update" });
      }

      values.push(targetUserId);

      await db.query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`,
        values
      );

      res.json({ success: true });
    } catch (err) {
      console.error("USER UPDATE ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ———————————————— */
/* DELETE – DELETE USER                             */
/* write access                                     */
/* ———————————————— */

router.delete(
  "/:id",
  requireAuth,
  requirePageAccess("user_management", "write"),
  async (req, res) => {
    const targetUserId = Number(req.params.id);

    try {
      const result = await db.query(
        `SELECT is_root FROM users WHERE id = $1`,
        [targetUserId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      if (result.rows[0].is_root) {
        return res
          .status(403)
          .json({ message: "Root user cannot be deleted" });
      }

      if (req.user.id === targetUserId) {
        return res
          .status(403)
          .json({ message: "You cannot delete your own account" });
      }

      await db.query(`DELETE FROM users WHERE id = $1`, [targetUserId]);

      res.json({ success: true });
    } catch (err) {
      console.error("USER DELETE ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* ———————————————— */
/* USER ACCESS OVERRIDES                            */
/* view / write access                              */
/* ———————————————— */

router.get(
  "/:id/access-override",
  requireAuth,
  requirePageAccess("user_management", "view"),
  async (req, res) => {
    const userId = Number(req.params.id);

    try {
      const result = await db.query(
        `
        SELECT
          id,
          user_group,
          access_override
        FROM users
        WHERE id = $1
        `,
        [userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const u = result.rows[0];

      res.json({
        id: u.id,
        group: u.user_group,
        accessOverride: u.access_override || {},
      });
    } catch (err) {
      console.error("GET USER ACCESS OVERRIDE ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/:id/access-override",
  requireAuth,
  requirePageAccess("user_management", "write"),
  async (req, res) => {
    const userId = Number(req.params.id);
    const { accessOverride } = req.body;

    if (!accessOverride || typeof accessOverride !== "object") {
      return res.status(400).json({ message: "Invalid accessOverride" });
    }

    try {
      const sanitized = sanitizeAccessOverride(accessOverride);

      const result = await db.query(
        `
        UPDATE users
        SET access_override = $1
        WHERE id = $2
        RETURNING id
        `,
        [sanitized, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("UPDATE USER ACCESS OVERRIDE ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
