/* ------------------------------------------------ */
/* TEAMS COMMUNICATION CENTER ROUTES                */
/* /api/teams-config                                */
/* Events, Routing, Templates, Settings, Test       */
/* ------------------------------------------------ */

import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { requirePageAccess } from "../middleware/requirePageAccess.js";
import { logSettingsChange } from "../services/settingsAudit.js";

const router = express.Router();

/* ================================================ */
/* OVERVIEW / STATUS                                */
/* ================================================ */

/* GET /api/teams-config/status */
router.get("/status", requireAuth, requirePageAccess("teams_center", "view"), async (_req, res) => {
  try {
    // Collect health data
    const [
      { rows: todayStats },
      { rows: lastSuccess },
      { rows: lastError },
      { rows: pendingRetries },
      { rows: mappingCount },
    ] = await Promise.all([
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'sent') as sent_today,
           COUNT(*) FILTER (WHERE status = 'failed') as failed_today
         FROM teams_message_log
         WHERE sent_at >= CURRENT_DATE`
      ),
      db.query(
        `SELECT sent_at, message_type, recipient FROM teams_message_log
         WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 1`
      ),
      db.query(
        `SELECT sent_at, error_msg, message_type FROM teams_message_log
         WHERE status = 'failed' ORDER BY sent_at DESC LIMIT 1`
      ),
      db.query(
        `SELECT COUNT(*) as count FROM teams_message_log
         WHERE status = 'failed' AND sent_at >= NOW() - INTERVAL '24 hours'`
      ),
      db.query(
        `SELECT COUNT(*) as count FROM employee_contacts WHERE email IS NOT NULL AND email != ''`
      ),
    ]);

    const hasWebhook = !!(process.env.TEAMS_CHANNEL_WEBHOOK || process.env.TEAMS_PERSONAL_WEBHOOK);

    res.json({
      webhook_configured: hasWebhook,
      bot_configured: !!process.env.BOT_INTERNAL_API_KEY,
      graph_configured: !!(process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET),
      sent_today: parseInt(todayStats[0]?.sent_today || 0),
      failed_today: parseInt(todayStats[0]?.failed_today || 0),
      last_success: lastSuccess[0] || null,
      last_error: lastError[0] || null,
      pending_retries: parseInt(pendingRetries[0]?.count || 0),
      mapped_employees: parseInt(mappingCount[0]?.count || 0),
    });
  } catch (err) {
    console.error("GET /teams-config/status error", err);
    res.status(500).json({ error: "Failed to fetch Teams status" });
  }
});

/* ================================================ */
/* EVENT CONFIG                                     */
/* ================================================ */

/* GET /api/teams-config/events */
router.get("/events", requireAuth, requirePageAccess("teams_center", "view"), async (_req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM teams_event_config ORDER BY priority, event_key"
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /teams-config/events error", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

/* PUT /api/teams-config/events/:eventKey */
router.put("/events/:eventKey", requireAuth, requirePageAccess("teams_center", "write"), async (req, res) => {
  try {
    const { eventKey } = req.params;
    const { enabled, priority, send_mode, respect_quiet_hours, cooldown_minutes, deduplicate, escalation } = req.body;
    const actor = req.user?.name || req.user?.email || "system";

    // Get old value
    const { rows: old } = await db.query("SELECT * FROM teams_event_config WHERE event_key = $1", [eventKey]);
    if (old.length === 0) return res.status(404).json({ error: "Event not found" });

    await db.query(
      `UPDATE teams_event_config SET
         enabled = COALESCE($2, enabled),
         priority = COALESCE($3, priority),
         send_mode = COALESCE($4, send_mode),
         respect_quiet_hours = COALESCE($5, respect_quiet_hours),
         cooldown_minutes = COALESCE($6, cooldown_minutes),
         deduplicate = COALESCE($7, deduplicate),
         escalation = COALESCE($8, escalation),
         updated_at = NOW()
       WHERE event_key = $1`,
      [eventKey, enabled, priority, send_mode, respect_quiet_hours, cooldown_minutes, deduplicate, escalation]
    );

    // Audit
    const oldRow = old[0];
    if (enabled != null && enabled !== oldRow.enabled) {
      await logSettingsChange("teams", `event.${eventKey}.enabled`, oldRow.enabled, enabled, actor);
    }
    if (priority != null && priority !== oldRow.priority) {
      await logSettingsChange("teams", `event.${eventKey}.priority`, oldRow.priority, priority, actor);
    }

    const { rows } = await db.query("SELECT * FROM teams_event_config WHERE event_key = $1", [eventKey]);
    res.json(rows[0]);
  } catch (err) {
    console.error("PUT /teams-config/events error", err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

/* ================================================ */
/* ROUTING RULES                                    */
/* ================================================ */

/* GET /api/teams-config/routing */
router.get("/routing", requireAuth, requirePageAccess("teams_center", "view"), async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*, e.label as event_label
       FROM teams_routing_rules r
       JOIN teams_event_config e ON e.event_key = r.event_key
       ORDER BY r.event_key, r.sort_order`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /teams-config/routing error", err);
    res.status(500).json({ error: "Failed to fetch routing rules" });
  }
});

/* POST /api/teams-config/routing */
router.post("/routing", requireAuth, requirePageAccess("teams_center", "write"), async (req, res) => {
  try {
    const { event_key, target_type, target_value, enabled = true, sort_order = 0 } = req.body;
    if (!event_key || !target_type || !target_value) {
      return res.status(400).json({ error: "event_key, target_type, target_value required" });
    }
    const actor = req.user?.name || req.user?.email || "system";

    const { rows } = await db.query(
      `INSERT INTO teams_routing_rules (event_key, target_type, target_value, enabled, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [event_key, target_type, target_value, enabled, sort_order]
    );

    await logSettingsChange("teams", `routing.${event_key}`, null, `${target_type}:${target_value}`, actor, "Rule added");
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("POST /teams-config/routing error", err);
    res.status(500).json({ error: "Failed to create routing rule" });
  }
});

/* PUT /api/teams-config/routing/:id */
router.put("/routing/:id", requireAuth, requirePageAccess("teams_center", "write"), async (req, res) => {
  try {
    const { id } = req.params;
    const { target_type, target_value, enabled, sort_order } = req.body;
    const actor = req.user?.name || req.user?.email || "system";

    const { rows } = await db.query(
      `UPDATE teams_routing_rules SET
         target_type = COALESCE($2, target_type),
         target_value = COALESCE($3, target_value),
         enabled = COALESCE($4, enabled),
         sort_order = COALESCE($5, sort_order)
       WHERE id = $1 RETURNING *`,
      [id, target_type, target_value, enabled, sort_order]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Rule not found" });

    await logSettingsChange("teams", `routing.${rows[0].event_key}`, null, JSON.stringify(req.body), actor, "Rule updated");
    res.json(rows[0]);
  } catch (err) {
    console.error("PUT /teams-config/routing error", err);
    res.status(500).json({ error: "Failed to update routing rule" });
  }
});

/* DELETE /api/teams-config/routing/:id */
router.delete("/routing/:id", requireAuth, requirePageAccess("teams_center", "write"), async (req, res) => {
  try {
    const { id } = req.params;
    const actor = req.user?.name || req.user?.email || "system";

    const { rows } = await db.query("DELETE FROM teams_routing_rules WHERE id = $1 RETURNING *", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Rule not found" });

    await logSettingsChange("teams", `routing.${rows[0].event_key}`, `${rows[0].target_type}:${rows[0].target_value}`, null, actor, "Rule deleted");
    res.json({ deleted: true });
  } catch (err) {
    console.error("DELETE /teams-config/routing error", err);
    res.status(500).json({ error: "Failed to delete routing rule" });
  }
});

/* ================================================ */
/* TEMPLATES                                        */
/* ================================================ */

/* GET /api/teams-config/templates */
router.get("/templates", requireAuth, requirePageAccess("teams_center", "view"), async (_req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM teams_templates ORDER BY template_key");
    res.json(rows);
  } catch (err) {
    console.error("GET /teams-config/templates error", err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

/* PUT /api/teams-config/templates/:templateKey */
router.put("/templates/:templateKey", requireAuth, requirePageAccess("teams_center", "write"), async (req, res) => {
  try {
    const { templateKey } = req.params;
    const { title, body_text, compact_body, include_deep_link, include_ticket_details, include_remaining_time, include_priority_badge } = req.body;
    const actor = req.user?.name || req.user?.email || "system";

    const { rows: old } = await db.query("SELECT * FROM teams_templates WHERE template_key = $1", [templateKey]);
    if (old.length === 0) return res.status(404).json({ error: "Template not found" });

    await db.query(
      `UPDATE teams_templates SET
         title = COALESCE($2, title),
         body_text = COALESCE($3, body_text),
         compact_body = COALESCE($4, compact_body),
         include_deep_link = COALESCE($5, include_deep_link),
         include_ticket_details = COALESCE($6, include_ticket_details),
         include_remaining_time = COALESCE($7, include_remaining_time),
         include_priority_badge = COALESCE($8, include_priority_badge),
         updated_at = NOW()
       WHERE template_key = $1`,
      [templateKey, title, body_text, compact_body, include_deep_link, include_ticket_details, include_remaining_time, include_priority_badge]
    );

    await logSettingsChange("teams", `template.${templateKey}`, old[0].body_text, body_text || old[0].body_text, actor);

    const { rows } = await db.query("SELECT * FROM teams_templates WHERE template_key = $1", [templateKey]);
    res.json(rows[0]);
  } catch (err) {
    console.error("PUT /teams-config/templates error", err);
    res.status(500).json({ error: "Failed to update template" });
  }
});

/* POST /api/teams-config/templates/preview — render a template with sample data */
router.post("/templates/preview", requireAuth, requirePageAccess("teams_center", "view"), async (req, res) => {
  try {
    const { body_text, sample_data } = req.body;
    if (!body_text) return res.status(400).json({ error: "body_text required" });

    const defaults = {
      employeeName: "Max Mustermann",
      ticketId: "TT-12345",
      activity: "SmartHands Install",
      systemName: "FR5-0101A",
      ticketType: "SmartHands",
      priority: "high",
      restTime: "2h 15m",
      commitDate: "2026-04-03 14:00",
      shift: "E1",
      reason: "Nur 3 von 5 Mitarbeitern verfügbar",
      dashboardLink: "https://odin.equinix.com/dashboard",
      threshold: "10",
      totalTickets: "42",
      assignedCount: "28",
      openCount: "14",
      accountName: "Deutsche Telekom",
    };

    const data = { ...defaults, ...(sample_data || {}) };
    let rendered = body_text;
    for (const [key, val] of Object.entries(data)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }

    res.json({ rendered, placeholders: Object.keys(data) });
  } catch (err) {
    res.status(500).json({ error: "Preview failed" });
  }
});

/* ================================================ */
/* TEAMS SETTINGS                                   */
/* ================================================ */

/* GET /api/teams-config/settings */
router.get("/settings", requireAuth, requirePageAccess("teams_center", "view"), async (_req, res) => {
  try {
    const { rows } = await db.query("SELECT key, value FROM teams_settings ORDER BY key");
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  } catch (err) {
    console.error("GET /teams-config/settings error", err);
    res.status(500).json({ error: "Failed to fetch Teams settings" });
  }
});

/* PUT /api/teams-config/settings */
router.put("/settings", requireAuth, requirePageAccess("teams_center", "write"), async (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Body must be a key-value object" });
    }
    const actor = req.user?.name || req.user?.email || "system";

    for (const [key, val] of Object.entries(updates)) {
      // Get old value
      const { rows: old } = await db.query("SELECT value FROM teams_settings WHERE key = $1", [key]);
      const oldVal = old.length > 0 ? old[0].value : null;

      await db.query(
        `INSERT INTO teams_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
        [key, String(val), actor]
      );

      if (oldVal !== String(val)) {
        await logSettingsChange("teams", key, oldVal, String(val), actor);
      }
    }

    const { rows } = await db.query("SELECT key, value FROM teams_settings ORDER BY key");
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  } catch (err) {
    console.error("PUT /teams-config/settings error", err);
    res.status(500).json({ error: "Failed to update Teams settings" });
  }
});

/* ================================================ */
/* MESSAGE LOG / AUDIT                              */
/* ================================================ */

/* GET /api/teams-config/log */
router.get("/log", requireAuth, requirePageAccess("teams_center", "view"), async (req, res) => {
  try {
    const { limit = 100, offset = 0, status, recipient, message_type, start, end } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (recipient) { conditions.push(`recipient ILIKE $${idx++}`); params.push(`%${recipient}%`); }
    if (message_type) { conditions.push(`message_type = $${idx++}`); params.push(message_type); }
    if (start) { conditions.push(`sent_at >= $${idx++}`); params.push(start); }
    if (end) { conditions.push(`sent_at <= $${idx++}`); params.push(end); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await db.query(
      `SELECT * FROM teams_message_log ${where} ORDER BY sent_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    // Total count for pagination
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) as total FROM teams_message_log ${where}`,
      params.slice(0, -2)
    );

    res.json({ rows, total: parseInt(countRows[0]?.total || 0) });
  } catch (err) {
    console.error("GET /teams-config/log error", err);
    res.status(500).json({ error: "Failed to fetch message log" });
  }
});

/* ================================================ */
/* ERROR & RETRY                                    */
/* ================================================ */

/* GET /api/teams-config/errors */
router.get("/errors", requireAuth, requirePageAccess("teams_center", "view"), async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const { rows } = await db.query(
      `SELECT * FROM teams_message_log WHERE status = 'failed'
       ORDER BY sent_at DESC LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /teams-config/errors error", err);
    res.status(500).json({ error: "Failed to fetch errors" });
  }
});

/* POST /api/teams-config/retry/:id */
router.post("/retry/:id", requireAuth, requirePageAccess("teams_center", "write"), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query("SELECT * FROM teams_message_log WHERE id = $1", [parseInt(id)]);
    if (rows.length === 0) return res.status(404).json({ error: "Message not found" });

    const msg = rows[0];
    // Re-attempt to send
    const webhookUrl = msg.channel === "personal"
      ? process.env.TEAMS_PERSONAL_WEBHOOK
      : process.env.TEAMS_CHANNEL_WEBHOOK;

    if (!webhookUrl) {
      return res.status(503).json({ error: "No webhook configured for retry" });
    }

    try {
      const card = {
        type: "message",
        attachments: [{
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.2",
            body: [
              { type: "TextBlock", size: "Large", weight: "Bolder", text: "Retry: " + (msg.message_type || "Message") },
              { type: "TextBlock", text: msg.content || "", wrap: true },
            ],
          },
        }],
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });

      if (!response.ok) throw new Error(`Webhook returned ${response.status}`);

      await db.query(
        "UPDATE teams_message_log SET status = 'sent', error_msg = NULL WHERE id = $1",
        [parseInt(id)]
      );

      res.json({ success: true, retried: true });
    } catch (sendErr) {
      await db.query(
        "UPDATE teams_message_log SET error_msg = $2 WHERE id = $1",
        [parseInt(id), String(sendErr.message)]
      );
      res.status(502).json({ error: "Retry failed", detail: sendErr.message });
    }
  } catch (err) {
    console.error("POST /teams-config/retry error", err);
    res.status(500).json({ error: "Retry failed" });
  }
});

/* ================================================ */
/* TEST CENTER                                      */
/* ================================================ */

/* POST /api/teams-config/test/send */
router.post("/test/send", requireAuth, requirePageAccess("teams_center", "write"), async (req, res) => {
  try {
    const { channel = "channel", title = "ODIN Test Message", body = "Dies ist eine Testnachricht von ODIN." } = req.body;
    const webhookUrl = channel === "personal"
      ? process.env.TEAMS_PERSONAL_WEBHOOK
      : process.env.TEAMS_CHANNEL_WEBHOOK;

    if (!webhookUrl) {
      return res.status(503).json({ error: `Kein ${channel} Webhook konfiguriert.` });
    }

    const card = {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.2",
          body: [
            { type: "TextBlock", size: "Large", weight: "Bolder", text: title },
            { type: "TextBlock", text: body, wrap: true },
            { type: "TextBlock", text: `Test via ODIN · ${new Date().toLocaleString("de-DE")}`, isSubtle: true, size: "Small" },
          ],
        },
      }],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return res.status(502).json({ error: `Webhook returned ${response.status}`, detail: text });
    }

    // Log test message
    await db.query(
      `INSERT INTO teams_message_log (message_type, recipient, channel, content, status)
       VALUES ('TEST', $1, $2, $3, 'sent')`,
      [req.user?.email || "test", channel, `${title}: ${body}`]
    );

    res.json({ success: true, channel });
  } catch (err) {
    console.error("POST /teams-config/test error", err);
    res.status(500).json({ error: "Test send failed" });
  }
});

/* POST /api/teams-config/test/template */
router.post("/test/template", requireAuth, requirePageAccess("teams_center", "write"), async (req, res) => {
  try {
    const { template_key, channel = "channel" } = req.body;
    if (!template_key) return res.status(400).json({ error: "template_key required" });

    const { rows } = await db.query("SELECT * FROM teams_templates WHERE template_key = $1", [template_key]);
    if (rows.length === 0) return res.status(404).json({ error: "Template not found" });

    const tpl = rows[0];
    const sampleData = {
      employeeName: req.user?.name || "Test User",
      ticketId: "TEST-00001",
      activity: "SmartHands Install",
      systemName: "FR5-TEST",
      ticketType: "SmartHands",
      priority: "high",
      restTime: "3h 45m",
      shift: "E1",
      reason: "Testfall",
      threshold: "10",
    };

    let rendered = tpl.body_text;
    for (const [key, val] of Object.entries(sampleData)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }

    // Forward to test/send
    req.body = { channel, title: tpl.title.replace(/\{\{ticketId\}\}/g, "TEST-00001"), body: rendered };
    // Re-use test/send handler logic
    const webhookUrl = channel === "personal" ? process.env.TEAMS_PERSONAL_WEBHOOK : process.env.TEAMS_CHANNEL_WEBHOOK;
    if (!webhookUrl) return res.status(503).json({ error: "Kein Webhook konfiguriert." });

    const card = {
      type: "message",
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.2",
          body: [
            { type: "TextBlock", size: "Large", weight: "Bolder", text: req.body.title },
            { type: "TextBlock", text: rendered, wrap: true },
            { type: "TextBlock", text: `Template Test · ${new Date().toLocaleString("de-DE")}`, isSubtle: true, size: "Small" },
          ],
        },
      }],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Webhook returned ${response.status}` });
    }

    res.json({ success: true, template_key, rendered });
  } catch (err) {
    console.error("POST /teams-config/test/template error", err);
    res.status(500).json({ error: "Template test failed" });
  }
});

/* ================================================ */
/* EMPLOYEE MAPPING                                 */
/* ================================================ */

/* GET /api/teams-config/employees */
router.get("/employees", requireAuth, requirePageAccess("teams_center", "view"), async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ec.employee_name, ec.email, ec.email_source, ec.is_active, ec.updated_at,
              u.id as user_id
       FROM employee_contacts ec
       LEFT JOIN users u ON LOWER(u.email) = LOWER(ec.email)
       ORDER BY ec.employee_name`
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /teams-config/employees error", err);
    res.status(500).json({ error: "Failed to fetch employee mappings" });
  }
});

export default router;
