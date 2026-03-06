/* ------------------------------------------------ */
/* NEW STARTERS – ROUTES (POSTGRESQL)               */
/* Probation-period management for new employees.   */
/* RBAC: page-based (shiftplan:view / write)        */
/* ------------------------------------------------ */

import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requirePageAccess } from "../middleware/requirePageAccess.js";

const router = express.Router();

/* ──────────────────────────────────────────────── */
/* HELPERS                                          */
/* ──────────────────────────────────────────────── */

/**
 * Adds exactly 6 calendar months to a Date object.
 * Handles month-end edge cases: if the resulting month doesn't have
 * the same day, it clamps to the last day of that month.
 * Example: 31.08 + 6m → 28.02 (not 03.03)
 */
function addSixMonths(date) {
  const d = new Date(date);
  const targetMonth = d.getMonth() + 6;
  d.setMonth(targetMonth);

  // If month overflowed (e.g. Jan 31 + 1m → Mar 3), correct it
  // This happens because setMonth clamps automatically in JS,
  // so no extra handling needed — JS setMonth already overflows correctly.
  // However for the 6-month case we verify:
  const expectedMonth = ((date.getMonth() + 6) % 12);
  if (d.getMonth() !== expectedMonth) {
    // Clamped beyond month end — go back to last day of intended month
    d.setDate(0); // last day of previous month
  }
  return d;
}

/**
 * Subtracts 14 days from a Date object.
 */
function subtractTwoWeeks(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - 14);
  return d;
}

/**
 * Formats a Date as ISO date string "YYYY-MM-DD"
 */
function toISODate(d) {
  return d.toISOString().split("T")[0];
}

/**
 * Rating field names (10 categories)
 */
const RATING_FIELDS = [
  "punctuality",
  "politeness",
  "team_integration",
  "motivation",
  "technical_understanding",
  "work_quality",
  "german_language",
  "english_language",
  "workplace_cleanliness",
  "clothing_cleanliness",
];

/**
 * Computes average from a ratings object, ignoring null/undefined.
 * Returns null if no fields are rated.
 */
function computeAverage(ratings) {
  const values = RATING_FIELDS
    .map((f) => ratings[f])
    .filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)));
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + Number(b), 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/* ──────────────────────────────────────────────── */
/* GET /api/new-starters                            */
/* Returns all new starters with their ratings.     */
/* ──────────────────────────────────────────────── */
router.get(
  "/",
  requireAuth,
  requirePageAccess("shiftplan", "view"),
  async (req, res) => {
    try {
      const { status } = req.query; // optional filter: 'active'|'archived'

      let whereClause = "";
      const params = [];
      if (status === "active" || status === "archived") {
        whereClause = "WHERE ns.status = $1";
        params.push(status);
      }

      const { rows } = await db.query(
        `
        SELECT
          ns.id,
          ns.first_name,
          ns.last_name,
          ns.start_date,
          ns.probation_end_date,
          ns.last_termination_date,
          ns.comment,
          ns.status,
          ns.created_at,
          ns.updated_at,
          -- ratings (may be NULL if not yet created)
          r.punctuality,
          r.politeness,
          r.team_integration,
          r.motivation,
          r.technical_understanding,
          r.work_quality,
          r.german_language,
          r.english_language,
          r.workplace_cleanliness,
          r.clothing_cleanliness,
          r.average_rating
        FROM new_starters ns
        LEFT JOIN new_starter_ratings r ON r.new_starter_id = ns.id
        ${whereClause}
        ORDER BY ns.status ASC, ns.start_date DESC
        `,
        params,
      );

      res.json(rows);
    } catch (err) {
      console.error("[NEW-STARTERS] GET / error:", err);
      res.status(500).json({ error: "Fehler beim Laden der Neustarter" });
    }
  },
);

/* ──────────────────────────────────────────────── */
/* POST /api/new-starters                           */
/* Creates a new starter record.                    */
/* ──────────────────────────────────────────────── */
router.post(
  "/",
  requireAuth,
  requirePageAccess("shiftplan", "write"),
  async (req, res) => {
    try {
      const { first_name, last_name, start_date, comment, status } = req.body;

      if (!first_name || !last_name || !start_date) {
        return res.status(400).json({
          error: "first_name, last_name und start_date sind Pflichtfelder",
        });
      }

      const startDateObj = new Date(start_date);
      if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ error: "Ungültiges Startdatum" });
      }

      const probationEnd = addSixMonths(startDateObj);
      const lastTermination = subtractTwoWeeks(probationEnd);

      const { rows } = await db.query(
        `
        INSERT INTO new_starters
          (first_name, last_name, start_date, probation_end_date, last_termination_date, comment, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          first_name.trim(),
          last_name.trim(),
          toISODate(startDateObj),
          toISODate(probationEnd),
          toISODate(lastTermination),
          comment?.trim() || null,
          status === "archived" ? "archived" : "active",
        ],
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("[NEW-STARTERS] POST / error:", err);
      res.status(500).json({ error: "Fehler beim Anlegen des Neustarters" });
    }
  },
);

/* ──────────────────────────────────────────────── */
/* PUT /api/new-starters/:id                        */
/* Updates basic fields of a new starter.           */
/* ──────────────────────────────────────────────── */
router.put(
  "/:id",
  requireAuth,
  requirePageAccess("shiftplan", "write"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Ungültige ID" });
      }

      const { first_name, last_name, start_date, comment, status } = req.body;

      // Build dynamic SET clause
      const setClauses = [];
      const params = [];
      let paramIdx = 1;

      if (first_name !== undefined) {
        setClauses.push(`first_name = $${paramIdx++}`);
        params.push(first_name.trim());
      }
      if (last_name !== undefined) {
        setClauses.push(`last_name = $${paramIdx++}`);
        params.push(last_name.trim());
      }
      if (start_date !== undefined) {
        const startDateObj = new Date(start_date);
        if (isNaN(startDateObj.getTime())) {
          return res.status(400).json({ error: "Ungültiges Startdatum" });
        }
        const probationEnd = addSixMonths(startDateObj);
        const lastTermination = subtractTwoWeeks(probationEnd);

        setClauses.push(`start_date = $${paramIdx++}`);
        params.push(toISODate(startDateObj));
        setClauses.push(`probation_end_date = $${paramIdx++}`);
        params.push(toISODate(probationEnd));
        setClauses.push(`last_termination_date = $${paramIdx++}`);
        params.push(toISODate(lastTermination));
      }
      if (comment !== undefined) {
        setClauses.push(`comment = $${paramIdx++}`);
        params.push(comment?.trim() || null);
      }
      if (status !== undefined && (status === "active" || status === "archived")) {
        setClauses.push(`status = $${paramIdx++}`);
        params.push(status);
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: "Keine zu aktualisierenden Felder angegeben" });
      }

      setClauses.push(`updated_at = NOW()`);
      params.push(id);

      const { rows } = await db.query(
        `UPDATE new_starters SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
        params,
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Neustarter nicht gefunden" });
      }

      res.json(rows[0]);
    } catch (err) {
      console.error("[NEW-STARTERS] PUT /:id error:", err);
      res.status(500).json({ error: "Fehler beim Aktualisieren des Neustarters" });
    }
  },
);

/* ──────────────────────────────────────────────── */
/* DELETE /api/new-starters/:id                     */
/* ──────────────────────────────────────────────── */
router.delete(
  "/:id",
  requireAuth,
  requirePageAccess("shiftplan", "write"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Ungültige ID" });
      }

      const { rowCount } = await db.query(
        `DELETE FROM new_starters WHERE id = $1`,
        [id],
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: "Neustarter nicht gefunden" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("[NEW-STARTERS] DELETE /:id error:", err);
      res.status(500).json({ error: "Fehler beim Löschen des Neustarters" });
    }
  },
);

/* ──────────────────────────────────────────────── */
/* PUT /api/new-starters/:id/ratings                */
/* Upsert ratings for a new starter.                */
/* ──────────────────────────────────────────────── */
router.put(
  "/:id/ratings",
  requireAuth,
  requirePageAccess("shiftplan", "write"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Ungültige ID" });
      }

      // Verify starter exists
      const checkResult = await db.query(
        `SELECT id FROM new_starters WHERE id = $1`,
        [id],
      );
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: "Neustarter nicht gefunden" });
      }

      // Extract and validate rating values
      const ratingValues = {};
      for (const field of RATING_FIELDS) {
        const val = req.body[field];
        if (val === null || val === undefined) {
          ratingValues[field] = null;
        } else {
          const num = Number(val);
          if (!Number.isInteger(num) || num < 1 || num > 5) {
            return res.status(400).json({
              error: `Ungültiger Wert für ${field}: muss zwischen 1 und 5 liegen`,
            });
          }
          ratingValues[field] = num;
        }
      }

      const avg = computeAverage(ratingValues);

      // UPSERT
      const { rows } = await db.query(
        `
        INSERT INTO new_starter_ratings (
          new_starter_id,
          punctuality, politeness, team_integration, motivation,
          technical_understanding, work_quality, german_language,
          english_language, workplace_cleanliness, clothing_cleanliness,
          average_rating, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (new_starter_id) DO UPDATE SET
          punctuality             = EXCLUDED.punctuality,
          politeness              = EXCLUDED.politeness,
          team_integration        = EXCLUDED.team_integration,
          motivation              = EXCLUDED.motivation,
          technical_understanding = EXCLUDED.technical_understanding,
          work_quality            = EXCLUDED.work_quality,
          german_language         = EXCLUDED.german_language,
          english_language        = EXCLUDED.english_language,
          workplace_cleanliness   = EXCLUDED.workplace_cleanliness,
          clothing_cleanliness    = EXCLUDED.clothing_cleanliness,
          average_rating          = EXCLUDED.average_rating,
          updated_at              = NOW()
        RETURNING *
        `,
        [
          id,
          ratingValues.punctuality,
          ratingValues.politeness,
          ratingValues.team_integration,
          ratingValues.motivation,
          ratingValues.technical_understanding,
          ratingValues.work_quality,
          ratingValues.german_language,
          ratingValues.english_language,
          ratingValues.workplace_cleanliness,
          ratingValues.clothing_cleanliness,
          avg,
        ],
      );

      res.json(rows[0]);
    } catch (err) {
      console.error("[NEW-STARTERS] PUT /:id/ratings error:", err);
      res.status(500).json({ error: "Fehler beim Speichern der Bewertungen" });
    }
  },
);

export default router;
