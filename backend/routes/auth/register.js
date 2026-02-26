/* ———————————————————————————————— */
/* AUTH ROUTES – REGISTER (FINAL)     */
/* ———————————————————————————————— */

import express from "express";
import bcrypt from "bcrypt";
import db from "../../db.js";
import { groupExists, normalizeGroupKey } from "../../db/initSchema.js";

/* ———————————————————————————————— */
/* ROUTER SETUP                       */
/* ———————————————————————————————— */

const router = express.Router();

/* ———————————————————————————————— */
/* POST /api/auth/register            */
/* ———————————————————————————————— */

router.post("/register", async (req, res) => {
  const { firstName, lastName, email, password, ibx, department } = req.body;

  /* Pflichtfelder */
  if (!firstName || !lastName || !email || !password || !ibx || !department) {
    return res.status(400).json({ message: "Bitte alle Felder ausfüllen" });
  }

  try {
    const emailLower = String(email).toLowerCase().trim();

    /* CHECK: E-Mail UNIQUE */
    const exists = await db.query(
      `SELECT 1 FROM users WHERE email = $1`,
      [emailLower]
    );
    if (exists.rowCount > 0) {
      return res.status(400).json({ message: "E-Mail existiert bereits" });
    }

    /* GROUP / DEPARTMENT (RBAC) */
    const groupKey = normalizeGroupKey(department);
    const groupOk = await groupExists(groupKey);
    if (!groupOk) {
      return res.status(400).json({ message: "Ungültige Abteilung" });
    }

    /* USERNAME */
    const username =
      firstName.trim().charAt(0).toLowerCase() +
      lastName.trim().toLowerCase();

    /* PASSWORD HASH */
    const passwordHash = await bcrypt.hash(password, 10);

    /* INSERT USER (CLEAN + COMPLETE) */
    await db.query(
      `
      INSERT INTO users
        (
          first_name,
          last_name,
          username,
          email,
          password_hash,
          is_root,
          approved,
          user_group,
          ibx,
          department
        )
      VALUES
        ($1,$2,$3,$4,$5,false,false,$6,$7,$8)
      `,
      [
        firstName,
        lastName,
        username,
        emailLower,
        passwordHash,
        groupKey,   // RBAC group
        ibx,        // Standort / IBX
        department, // Team / Abteilung
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Registrierung eingegangen. Freigabe erforderlich.",
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
