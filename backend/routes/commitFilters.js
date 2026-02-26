/* ———————————————————————————————— */
/* COMMIT – SAVED FILTERS ROUTES (V2) */
/* /commit/filters                   */
/* ———————————————————————————————— */

import express from "express";
import db from "../db.js";

const router = express.Router();

/* ------------------------------------------------ */
/* HELPERS                                          */
/* ------------------------------------------------ */

function parseFilter(body = {}) {
  const label = String(body.label ?? "").trim();
  const rules = Array.isArray(body.rules) ? body.rules : [];

  if (!label) return { error: "label is required" };
  if (!rules.length) return { error: "rules are required" };

  const cleanRules = rules
    .map((r) => ({
      field: String(r.field ?? "").trim(),
      values: Array.isArray(r.values)
        ? Array.from(
            new Set(
              r.values
                .map((v) => String(v ?? "").trim())
                .filter(Boolean)
            )
          )
        : [],
    }))
    .filter((r) => r.field && r.values.length);

  if (!cleanRules.length)
    return { error: "invalid rules" };

  return { label, rules: cleanRules };
}

/* ------------------------------------------------ */
/* GET ALL                                          */
/* ------------------------------------------------ */

router.get("/filters", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        label,
        rules_json AS rules,
        created_at,
        updated_at
      FROM commit_saved_filters
      ORDER BY label ASC
    `);

    res.json(result.rows ?? []);
  } catch (err) {
    console.error("GET /commit/filters failed:", err);
    res.status(500).json({ error: "failed_to_load_filters" });
  }
});

/* ------------------------------------------------ */
/* CREATE                                           */
/* ------------------------------------------------ */

router.post("/filters", async (req, res) => {
  const parsed = parseFilter(req.body);
  if (parsed.error)
    return res.status(400).json({ error: parsed.error });

  try {
    const result = await db.query(
      `
      INSERT INTO commit_saved_filters (label, rules_json)
      VALUES ($1, $2::jsonb)
      RETURNING
        id,
        label,
        rules_json AS rules,
        created_at,
        updated_at
      `,
      [parsed.label, JSON.stringify(parsed.rules)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /commit/filters failed:", err);
    res.status(500).json({ error: "failed_to_create_filter" });
  }
});

/* ------------------------------------------------ */
/* DELETE                                           */
/* ------------------------------------------------ */

router.delete("/filters/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const result = await db.query(
      `DELETE FROM commit_saved_filters WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!result.rows?.length)
      return res.status(404).json({ error: "not_found" });

    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /commit/filters/:id failed:", err);
    res.status(500).json({ error: "failed_to_delete_filter" });
  }
});

export default router;
