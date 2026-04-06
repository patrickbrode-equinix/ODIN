/* ———————————————— */
/* USERS – MANAGEMENT API (POLICY-ONLY)            */
/* Root is technical & protected via is_root       */
/* Simplified RBAC: user + admin                   */
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
import { syncEmployeeContacts } from "./employeeContacts.js";
import { provisionUsersFromShiftplan } from "../services/shiftUserProvisioning.service.js";
import { logActivity } from "./activity.js";

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
          is_admin   AS "isAdmin",
          is_root    AS "isRoot",
          last_login AS "lastLogin",
          must_change_password AS "mustChangePassword",
          provisioned_from_shiftplan AS "provisionedFromShiftplan",
          provisioned_employee_name AS "provisionedEmployeeName",
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
    const { firstName, lastName, email, ibx, department, group, isAdmin } = req.body;

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

      const passwordHash = await bcrypt.hash("root", 12);

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
          is_admin,
          is_root,
          must_change_password
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,false,true)
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
          Boolean(isAdmin),
        ]
      );

      res.status(201).json({ id: result.rows[0].id });
    } catch (err) {
      console.error("USER CREATE ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/provision-from-shifts",
  requireAuth,
  requirePageAccess("user_management", "write"),
  async (req, res) => {
    const dryRun = req.body?.dryRun === true;

    try {
      let contactSync = null;
      try {
        contactSync = await syncEmployeeContacts();
      } catch (contactErr) {
        console.warn("USER PROVISIONING CONTACT SYNC ERROR:", contactErr.message);
      }

      const result = await provisionUsersFromShiftplan({ dryRun });

      await logActivity(
        req.user.id,
        req.user.email,
        dryRun ? "USER_PROVISIONING_DRY_RUN" : "USER_PROVISIONING_SYNC",
        "user_management",
        "users",
        null,
        null,
        { contactSync, ...result }
      );

      res.json({ success: true, contactSync, ...result });
    } catch (err) {
      console.error("USER PROVISIONING ERROR:", err);
      res.status(500).json({ message: "User provisioning failed" });
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
    const { group, department, ibx, firstName, lastName, approved, isAdmin, mustChangePassword } = req.body;

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

      if (isAdmin !== undefined) {
        fields.push(`is_admin = $${idx++}`);
        values.push(Boolean(isAdmin));
      }

      if (mustChangePassword !== undefined) {
        fields.push(`must_change_password = $${idx++}`);
        values.push(Boolean(mustChangePassword));
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

export default router;
