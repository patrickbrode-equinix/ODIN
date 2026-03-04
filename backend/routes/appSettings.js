/* ------------------------------------------------ */
/* APP SETTINGS ROUTES                              */
/* /api/app-settings                                */
/* Thresholds: shift warnings, understaffing,       */
/* wellbeing, log retention.                        */
/* ------------------------------------------------ */

import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/* GET /api/app-settings */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT key, value FROM app_settings ORDER BY key");
    // Return as a flat object for convenience
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json(settings);
  } catch (err) {
    console.error("GET /app-settings error", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

/* PUT /api/app-settings — bulk update */
router.put("/", requireAuth, async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Body must be a key-value object" });
    }

    const actor = req.user?.name || req.user?.email || "system";

    for (const [key, val] of Object.entries(updates)) {
      await db.query(
        `INSERT INTO app_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
        [key, String(val), actor]
      );
    }

    const { rows } = await db.query("SELECT key, value FROM app_settings ORDER BY key");
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  } catch (err) {
    console.error("PUT /app-settings error", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

/* PATCH /api/app-settings/:key — single value */
router.patch("/:key", requireAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: "value is required" });
    }

    const actor = req.user?.name || req.user?.email || "system";
    const { rows } = await db.query(
      `INSERT INTO app_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()
       RETURNING *`,
      [key, String(value), actor]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to update setting" });
  }
});

export default router;
