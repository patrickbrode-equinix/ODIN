/* ------------------------------------------------ */
/* TEAMS INTEGRATION ROUTES                         */
/* /api/teams                                       */
/* ------------------------------------------------ */

import express from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { config } from "../config/index.js";

const router = express.Router();

/* ------------------------------------------------ */
/* TEAMS WEBHOOK SENDER                             */
/* ------------------------------------------------ */

/**
 * Send an Adaptive Card / simple message via Teams Incoming Webhook.
 * Falls back gracefully if no webhook URL is configured.
 */
async function sendTeamsMessage(webhookUrl, title, body) {
  if (!webhookUrl) {
    console.warn("[Teams] No webhook URL configured – message skipped.");
    return { skipped: true };
  }

  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.2",
          body: [
            { type: "TextBlock", size: "Large", weight: "Bolder", text: title },
            { type: "TextBlock", text: body, wrap: true },
            {
              type: "TextBlock",
              text: `ODIN · ${new Date().toLocaleString("de-DE")}`,
              isSubtle: true,
              size: "Small",
            },
          ],
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Teams webhook returned ${res.status}: ${text}`);
  }

  return { sent: true };
}

/* ------------------------------------------------ */
/* LOG HELPER                                       */
/* ------------------------------------------------ */

async function logMessage(type, recipient, channel, content, status, errorMsg) {
  await db.query(
    `INSERT INTO teams_message_log (message_type, recipient, channel, content, status, error_msg)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [type, recipient || null, channel || null, content, status, errorMsg || null]
  );
}

/* ------------------------------------------------ */
/* ROUTES                                           */
/* ------------------------------------------------ */

/* GET /api/teams/log — fetch teams message log */
router.get("/log", requireAuth, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const { rows } = await db.query(
      `SELECT * FROM teams_message_log ORDER BY sent_at DESC LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /teams/log error", err);
    res.status(500).json({ error: "Failed to fetch Teams log" });
  }
});

/* POST /api/teams/send — send an ad-hoc message */
router.post("/send", requireAuth, async (req, res) => {
  try {
    const { title, body, type = "ANNOUNCEMENT", recipient, channel } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "title and body required" });
    }

    const webhookUrl = channel === "personal"
      ? config.TEAMS_PERSONAL_WEBHOOK
      : config.TEAMS_CHANNEL_WEBHOOK;

    let status = "sent";
    let errorMsg = null;

    try {
      await sendTeamsMessage(webhookUrl, title, body);
    } catch (err) {
      status = "failed";
      errorMsg = String(err.message || err);
    }

    await logMessage(type, recipient || null, channel || "channel", `${title}: ${body}`, status, errorMsg);

    if (status === "failed") {
      return res.status(502).json({ error: "Teams delivery failed", detail: errorMsg });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("POST /teams/send error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* POST /api/teams/notify-assignment — personal assignment notification */
router.post("/notify-assignment", requireAuth, async (req, res) => {
  try {
    const { employee_name, ticket_id, ticket_title } = req.body;
    if (!employee_name || !ticket_id) {
      return res.status(400).json({ error: "employee_name and ticket_id required" });
    }

    const title = `Ticket zugewiesen: ${ticket_id}`;
    const body = `Hallo ${employee_name}, Ihnen wurde das Ticket **${ticket_title || ticket_id}** in ODIN zugewiesen.`;

    let status = "sent";
    let errorMsg = null;

    try {
      await sendTeamsMessage(config.TEAMS_PERSONAL_WEBHOOK, title, body);
    } catch (err) {
      status = "failed";
      errorMsg = String(err.message || err);
    }

    await logMessage("ASSIGNMENT", employee_name, "personal", body, status, errorMsg);

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: "Failed to send assignment notification" });
  }
});

/* POST /api/teams/announce — global team announcement */
router.post("/announce", requireAuth, async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ error: "title and body required" });

    let status = "sent";
    let errorMsg = null;

    try {
      await sendTeamsMessage(config.TEAMS_CHANNEL_WEBHOOK, title, body);
    } catch (err) {
      status = "failed";
      errorMsg = String(err.message || err);
    }

    await logMessage("ANNOUNCEMENT", null, "channel", `${title}: ${body}`, status, errorMsg);

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: "Failed to send announcement" });
  }
});

export { sendTeamsMessage, logMessage };
export default router;
