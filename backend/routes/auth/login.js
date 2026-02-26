/* ———————————————————————————————— */
/* AUTH ROUTES – LOGIN (FINAL / CLEAN) */
/* Single source of truth: DB users   */
/* ———————————————————————————————— */

import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import db from "../../db.js";
import { config } from "../../config/index.js";
import { getGroupPolicy } from "../../db/initSchema.js";
import { ensureUserSettings } from "../../db/userSettings.js";

const router = express.Router();

/* ———————————————————————————————— */
/* RBAC HELPERS                       */
/* ———————————————————————————————— */

const ALLOWED_LEVELS = new Set(["none", "view", "write"]);

function normalizeLevel(level) {
  const v = String(level || "").toLowerCase().trim();
  if (v === "manage") return "write";
  if (ALLOWED_LEVELS.has(v)) return v;
  return "none";
}

function sanitizePolicy(input) {
  const policy = input && typeof input === "object" ? input : {};
  const out = {};
  for (const [key, level] of Object.entries(policy)) {
    out[key] = normalizeLevel(level);
  }
  return out;
}

function mergePolicies(groupPolicy, userOverride) {
  return {
    ...sanitizePolicy(groupPolicy),
    ...sanitizePolicy(userOverride),
  };
}

/* ———————————————————————————————— */
/* POST /api/auth/login               */
/* ———————————————————————————————— */

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "E-Mail und Passwort erforderlich" });
  }

  try {
    /* USER LOAD */
    const { rows } = await db.query(
      `
      SELECT
        id,
        email,
        first_name,
        last_name,
        password_hash,
        is_root,
        approved,
        user_group,
        ibx,
        department,
        access_override
      FROM users
      WHERE email = $1
      `,
      [String(email).toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Ungültige Zugangsdaten" });
    }

    const user = rows[0];

    /* DISPLAY NAME (SINGLE SOURCE OF TRUTH) */
    const displayName =
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.email;

    /* PASSWORD CHECK */
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Ungültige Zugangsdaten" });
    }

    /* APPROVAL */
    if (!user.is_root && user.approved !== true) {
      return res.status(403).json({ message: "Account pending approval" });
    }

    /* RBAC */
    const groupPolicy = (await getGroupPolicy(user.user_group)) || {};
    const accessPolicy = mergePolicies(
      groupPolicy,
      user.access_override || {}
    );

    /* ENSURE SETTINGS */
    await ensureUserSettings(user.id);

    /* LAST LOGIN */
    await db.query(
      `UPDATE users SET last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    /* JWT (TECH ONLY) */
    const token = jwt.sign(
      {
        userId: user.id,
        isRoot: user.is_root === true,
      },
      config.JWT_SECRET,
      {
        expiresIn: config.JWT_EXPIRES_IN,
      }
    );

    /* FINAL RESPONSE */
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,

        firstName: user.first_name,
        lastName: user.last_name,
        displayName,

        location: user.ibx,
        team: user.department,
        group: user.user_group,

        approved: user.approved,
        isRoot: user.is_root === true,

        accessPolicy,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
