/* ------------------------------------------------ */
/* SCHEDULE / SHIFTPLAN – ROUTES (POSTGRESQL)       */
/* RBAC: page-based (view / write)                  */
/* ------------------------------------------------ */

import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requirePageAccess } from "../middleware/requirePageAccess.js";
import { recomputeConstraintsInternal } from "./constraints.js"; // [NEW]
import { parseMonthLabel } from "../lib/monthParser.js";

const router = express.Router();

/* ------------------------------------------------ */
/* GET /api/schedules – MONATSLISTE                 */
/* Recht: shiftplan:view                            */
/* ------------------------------------------------ */

router.get(
  "/",
  requireAuth,
  requirePageAccess("shiftplan", "view"),
  async (req, res) => {
    try {
      const result = await db.query(
        `SELECT DISTINCT month FROM shifts`
      );

      const rawMonths = result.rows
        .map((r) => r.month)
        .filter((m) => typeof m === "string" && m.trim().length > 0);

      const monthsSorted = rawMonths
        .map((label) => ({ label, parsed: parseMonthLabel(label) }))
        .filter((x) => x.parsed)
        .sort((a, b) => {
          if (a.parsed.year !== b.parsed.year) {
            return a.parsed.year - b.parsed.year;
          }
          return a.parsed.month - b.parsed.month;
        })
        .map((x) => x.label);

      res.json({ months: monthsSorted });
    } catch (err) {
      console.error("SCHEDULE MONTH LIST ERROR:", err);
      res.status(500).json({ error: "Failed to read months" });
    }
  }
);

/* ------------------------------------------------ */
/* GET /api/schedules/last-upload                   */
/* Returns the most recent shiftplan upload info.   */
/* ------------------------------------------------ */

router.get("/last-upload", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM shiftplan_upload_log ORDER BY uploaded_at DESC LIMIT 1`
    );
    res.json(rows[0] || null);
  } catch (err) {
    // Table might not exist yet — return null gracefully
    res.json(null);
  }
});

/* ------------------------------------------------ */
/* GET /api/schedules/:month – MONAT LADEN          */
/* Recht: shiftplan:view                            */
/* ------------------------------------------------ */

import { logActivity } from "./activity.js";

// Helper for padding
function pad2(n) {
  return String(n).padStart(2, "0");
}

router.get(
  "/:month",
  requireAuth,
  requirePageAccess("shiftplan", "view"),
  async (req, res) => {
    try {
      const monthLabel = req.params.month;

      const parsed = parseMonthLabel(monthLabel);
      if (!parsed) {
        return res.status(400).json({
          error: "Invalid month label (expected e.g. 'Januar 2026')",
        });
      }

      // Check if data exists
      let result = await db.query(
        `
        SELECT employee_name, day, shift_code
        FROM shifts
        WHERE month = $1
        `,
        [monthLabel]
      );

      // --- AUTO-SEED LOGIC FOR 2027 ---
      if (parsed.year === 2027 && result.rows.length === 0) {
        // 1. Get employees who were active in 2026
        // "Distinct employees from shiftplan entries where year=2026"
        // Note: 'shifts' table has 'month' column string "Januar 2026".
        // simple LIKE query:
        const empResult = await db.query(`
           SELECT DISTINCT employee_name 
           FROM shifts 
           WHERE month LIKE '%2026'
        `);
        const employees = empResult.rows.map(r => r.employee_name);

        if (employees.length > 0) {
          const seedValues = [];
          const daysInMonth = new Date(parsed.year, parsed.month, 0).getDate();

          // 2. Generate E2 for Mon-Fri
          for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(parsed.year, parsed.month - 1, d);
            const dow = dateObj.getDay();
            if (dow === 0 || dow === 6) continue; // Skip weekend

            // shift_code = E2
            employees.forEach(emp => {
              seedValues.push([monthLabel, emp, d, "E2"]);
            });
          }

          if (seedValues.length > 0) {
            // Batch Insert
            const flatValues = [];
            const placeholders = [];
            let idx = 1;

            seedValues.forEach(row => {
              placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
              flatValues.push(row[0], row[1], row[2], row[3]);
              idx += 4;
            });

            const query = `
                  INSERT INTO shifts (month, employee_name, day, shift_code)
                  VALUES ${placeholders.join(", ")}
              `;

            await db.query(query, flatValues);

            // Log
            await logActivity(
              req.user?.id,
              req.user?.displayName || "System",
              "shiftplan_baseline_create",
              "SHIFTPLAN",
              "month",
              monthLabel,
              null,
              { year: parsed.year, month: parsed.month, createdCount: seedValues.length, shiftCode: "E2" }
            );

            // Re-fetch data
            result = await db.query(
              `
                SELECT employee_name, day, shift_code
                FROM shifts
                WHERE month = $1
                `,
              [monthLabel]
            );
          }
        }
      }
      // --------------------------------

      const schedule = {};
      let maxDay = 0;

      for (const row of result.rows) {
        const emp = row.employee_name;
        const day = Number(row.day);
        const code = row.shift_code;

        if (!schedule[emp]) schedule[emp] = {};
        schedule[emp][day] = code;
        if (day > maxDay) maxDay = day;
      }

      res.json({
        meta: {
          label: monthLabel,
          year: parsed.year,
          month: parsed.month,
          id: `${parsed.year}-${String(parsed.month).padStart(2, "0")}`,
          daysInMonth: maxDay || 31,
        },
        schedule,
      });
    } catch (err) {
      console.error("SCHEDULE LOAD ERROR:", err);
      res.status(500).json({ error: "Failed to load schedule" });
    }
  }
);

/* ------------------------------------------------ */
/* POST /api/schedules/import – MONAT SPEICHERN     */
/* Recht: shiftplan:write                           */
/* ------------------------------------------------ */

router.post(
  "/import",
  requireAuth,
  requirePageAccess("shiftplan", "write"),
  async (req, res) => {
    const client = await db.connect();

    try {
      const { month, data } = req.body;

      if (!month || !data) {
        return res.status(400).json({ error: "Missing data" });
      }

      const parsedMonth = parseMonthLabel(month);
      if (!parsedMonth) {
        return res.status(400).json({
          error: "Invalid month label (expected e.g. 'Januar 2026')",
        });
      }

      await client.query("BEGIN");

      // [AUDIT] 1. Fetch existing shifts for comparison
      const existingRes = await client.query(`SELECT employee_name, day, shift_code FROM shifts WHERE month = $1`, [month]);
      const existingMap = new Map(); // key: "Name|Day" -> code
      existingRes.rows.forEach(r => {
        existingMap.set(`${r.employee_name}|${r.day}`, r.shift_code);
      });

      // [AUDIT] 2. Prepare Diff
      const auditLogParams = [];
      const changedBy = req.user?.displayName || req.user?.username || "Unknown";
      const source = "UI_SAVE";
      const now = new Date();

      // We need to parse month label to get year/month for date construction
      const parsedAudit = parseMonthLabel(month);
      const year = parsedAudit?.year || new Date().getFullYear();
      const monthIdx = (parsedAudit?.month || 1) - 1; // 0-based

      const incomingMap = new Map(); // key: "Name|Day" -> code

      // Prepare Insert Data
      const insertValues = []; // Array of params

      for (const employee of Object.keys(data)) {
        const days = data[employee] || {};

        for (const rawDay of Object.keys(days)) {
          const day = Number(rawDay);
          const shift = days[rawDay];

          if (!Number.isFinite(day) || day < 1 || day > 31) continue;
          // treat empty string as deletion if it existed, otherwise skip
          if (!shift || typeof shift !== "string" || shift === "") continue;

          const key = `${employee}|${day}`;
          incomingMap.set(key, shift);

          const oldShift = existingMap.get(key);

          // CHANGE or NEW
          if (oldShift !== shift) {
            const dateObj = new Date(year, monthIdx, day);
            const dateStr = dateObj.toISOString().split('T')[0];
            // Params: emp_name, date, old, new, by, source
            auditLogParams.push([employee, dateStr, oldShift || null, shift, changedBy, source]);
          }
        }
      }

      // DELETIONS (Existed but not in incoming)
      // Note: Incoming `data` usually contains the FULL schedule for the month.
      // If a day is missing in `data`, it means it's deleted/empty.
      // However, `data` might be partial updates? 
      // The current implementation of `POST /import` does `DELETE FROM shifts WHERE month=$1`.
      // So it IS a full overwrite.
      // We must detect what was in `existingMap` but NOT in `incomingMap`.

      for (const [key, oldCode] of existingMap.entries()) {
        if (!incomingMap.has(key)) {
          // Deleted
          const [emp, day] = key.split('|');
          const dateObj = new Date(year, monthIdx, Number(day));
          const dateStr = dateObj.toISOString().split('T')[0];
          auditLogParams.push([emp, dateStr, oldCode, null, changedBy, source]);
        }
      }

      // [AUDIT] 3. Batch Insert Logs
      if (auditLogParams.length > 0) {
        const logPlaceholders = auditLogParams.map((_, i) =>
          `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`
        ).join(", ");

        const flatParams = auditLogParams.flat();

        await client.query(
          `INSERT INTO shift_change_log (employee_name, date, old_value, new_value, changed_by, source) VALUES ${logPlaceholders}`,
          flatParams
        );
      }

      // 4. Overwrite Data
      await client.query(`DELETE FROM shifts WHERE month = $1`, [month]);

      for (const [key, code] of incomingMap.entries()) {
        const [emp, day] = key.split('|');
        await client.query(
          `INSERT INTO shifts (month, employee_name, day, shift_code) VALUES ($1,$2,$3,$4)`,
          [month, emp, day, code]
        );
      }

      await client.query("COMMIT");

      // [NEW] Trigger Constraint Check
      // Fire and forget (or await if we want strictness)
      recomputeConstraintsInternal(month).catch(err => console.error("Constraint Recompute Error:", err));

      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("IMPORT ERROR:", err);
      res.status(500).json({ error: "Import failed" });
    } finally {
      client.release();
    }
  }
);

/* ------------------------------------------------ */
/* POST /api/schedules/import/merge – BATCH UPDATE  */
/* Recht: shiftplan:write                           */
/* Body: { schedules: { [monthLabel]: { [emp]: { [day]: code } } } } */
/* ------------------------------------------------ */

router.post(
  "/import/merge",
  requireAuth,
  requirePageAccess("shiftplan", "write"),
  async (req, res) => {
    const client = await db.connect();

    try {
      const { schedules } = req.body; // Object: { "Januar 2026": { ...data... }, ... }

      if (!schedules || typeof schedules !== "object") {
        return res.status(400).json({ error: "Missing or invalid schedules data" });
      }

      await client.query("BEGIN");

      const monthsToUpdate = Object.keys(schedules);

      for (const monthLabel of monthsToUpdate) {
        const parsedMonth = parseMonthLabel(monthLabel);
        if (!parsedMonth) {
          throw new Error(`Invalid month label: ${monthLabel}`);
        }

        // 1. CLEAR existing data for this month
        await client.query(`DELETE FROM shifts WHERE month = $1`, [monthLabel]);

        // 2. INSERT new data
        const monthData = schedules[monthLabel];
        for (const employee of Object.keys(monthData)) {
          const days = monthData[employee] || {};

          for (const rawDay of Object.keys(days)) {
            const day = Number(rawDay);
            const shift = days[rawDay];

            if (!Number.isFinite(day) || day < 1 || day > 31) continue;
            if (!shift || typeof shift !== "string") continue;

            await client.query(
              `INSERT INTO shifts (month, employee_name, day, shift_code) VALUES ($1, $2, $3, $4)`,
              [monthLabel, employee, day, shift]
            );
          }
        }
      }

      await client.query("COMMIT");

      // Log the upload
      try {
        const uploaderName = req.user?.displayName || req.user?.email || "unknown";
        const totalEmployees = Object.values(schedules).reduce(
          (acc, monthData) => acc + Object.keys(monthData || {}).length, 0
        );
        await db.query(
          `INSERT INTO shiftplan_upload_log (uploaded_by, months_affected, employees_count, changes_count)
           VALUES ($1, $2, $3, $4)`,
          [uploaderName, monthsToUpdate, totalEmployees, totalEmployees]
        );
      } catch (logErr) {
        console.warn("shiftplan_upload_log insert failed (non-fatal):", logErr.message);
      }

      res.json({ success: true, updatedMonths: monthsToUpdate });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("IMPORT MERGE ERROR:", err);
      res.status(500).json({ error: "Merge import failed: " + err.message });
    } finally {
      client.release();
    }
  }
);


/* ------------------------------------------------ */
/* PUT /api/schedules/:month/cell (write)           */
/* Body: { employeeName, day, shiftCode }           */
/* ------------------------------------------------ */

router.put(
  "/:month/cell",
  requireAuth,
  requirePageAccess("shiftplan", "write"),
  async (req, res) => {
    const month = String(req.params.month || "").trim();
    const employeeName = String(req.body?.employeeName || "").trim();
    const day = Number(req.body?.day);
    const shiftCodeRaw = req.body?.shiftCode;
    const shiftCode = shiftCodeRaw === null || shiftCodeRaw === undefined ? "" : String(shiftCodeRaw).trim();

    if (!month || !employeeName || !Number.isFinite(day) || day < 1 || day > 31) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      if (!shiftCode) {
        await client.query(
          `DELETE FROM shifts WHERE month=$1 AND employee_name=$2 AND day=$3`,
          [month, employeeName, day]
        );
      } else {
        await client.query(
          `
          INSERT INTO shifts (month, employee_name, day, shift_code)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (month, employee_name, day)
          DO UPDATE SET shift_code = EXCLUDED.shift_code
          `,
          [month, employeeName, day, shiftCode]
        );
      }

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("SCHEDULE CELL UPDATE ERROR:", e);
      res.status(500).json({ error: "Update failed" });
    } finally {
      client.release();
    }
  }
);

/* ------------------------------------------------ */
/* POST /api/schedules/:month/swap (write)          */
/* Body: { employeeA, employeeB, day }              */
/* ------------------------------------------------ */

router.post(
  "/:month/swap",
  requireAuth,
  requirePageAccess("shiftplan", "write"),
  async (req, res) => {
    const month = String(req.params.month || "").trim();
    const employeeA = String(req.body?.employeeA || "").trim();
    const employeeB = String(req.body?.employeeB || "").trim();
    const day = Number(req.body?.day);

    if (!month || !employeeA || !employeeB || employeeA === employeeB || !Number.isFinite(day) || day < 1 || day > 31) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const a = await client.query(
        `SELECT shift_code FROM shifts WHERE month=$1 AND employee_name=$2 AND day=$3 FOR UPDATE`,
        [month, employeeA, day]
      );
      const b = await client.query(
        `SELECT shift_code FROM shifts WHERE month=$1 AND employee_name=$2 AND day=$3 FOR UPDATE`,
        [month, employeeB, day]
      );

      const aShift = a.rows?.[0]?.shift_code ?? null;
      const bShift = b.rows?.[0]?.shift_code ?? null;

      // upsert A -> bShift
      if (bShift === null) {
        await client.query(`DELETE FROM shifts WHERE month=$1 AND employee_name=$2 AND day=$3`, [month, employeeA, day]);
      } else {
        await client.query(
          `
          INSERT INTO shifts (month, employee_name, day, shift_code)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (month, employee_name, day)
          DO UPDATE SET shift_code = EXCLUDED.shift_code
          `,
          [month, employeeA, day, bShift]
        );
      }

      // upsert B -> aShift
      if (aShift === null) {
        await client.query(`DELETE FROM shifts WHERE month=$1 AND employee_name=$2 AND day=$3`, [month, employeeB, day]);
      } else {
        await client.query(
          `
          INSERT INTO shifts (month, employee_name, day, shift_code)
          VALUES ($1,$2,$3,$4)
          ON CONFLICT (month, employee_name, day)
          DO UPDATE SET shift_code = EXCLUDED.shift_code
          `,
          [month, employeeB, day, aShift]
        );
      }

      await client.query("COMMIT");
      res.json({ success: true, swapped: true });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("SCHEDULE SWAP ERROR:", e);
      res.status(500).json({ error: "Swap failed" });
    } finally {
      client.release();
    }
  }
);



/* ------------------------------------------------ */
/* GET /api/schedules/history                       */
/* ------------------------------------------------ */
router.get(
  "/history",
  requireAuth,
  async (req, res) => {
    try {
      const { year, month, employee_name, limit = 100 } = req.query;

      let query = `SELECT * FROM shift_change_log`;
      const params = [];
      const conditions = [];

      if (year && month) {
        const parsedM = Number(month);
        const start = `${year}-${String(parsedM).padStart(2, '0')}-01`;
        const end = `${year}-${String(parsedM).padStart(2, '0')}-31`;
        conditions.push(`date >= $${params.length + 1}`);
        params.push(start);
        conditions.push(`date <= $${params.length + 1}`);
        params.push(end);
      }

      if (employee_name) {
        conditions.push(`employee_name = $${params.length + 1}`);
        params.push(employee_name);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += ` ORDER BY changed_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const { rows } = await db.query(query, params);
      res.json(rows);

    } catch (err) {
      console.error("HISTORY ERROR:", err);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  }
);

export default router;
