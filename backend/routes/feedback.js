/* ------------------------------------------------ */
/* FEEDBACK ROUTE – E-MAIL VERSAND + DB FALLBACK    */
/* Empfänger: konfigurierbar via app_settings        */
/* ------------------------------------------------ */

import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/authMiddleware.js";
import db from "../db.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------------------------------ */
/* MULTER – Screenshot in Memory (kein Disk)        */
/* ------------------------------------------------ */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Nur Bilddateien (PNG, JPEG, GIF, WebP) sind erlaubt"));
    }
  },
});

/* ------------------------------------------------ */
/* SMTP TRANSPORTER (ENV-basiert)                    */
/* ------------------------------------------------ */

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const secure = process.env.SMTP_SECURE === "true";
  const fromAddress = process.env.SMTP_FROM || "odin-feedback@eu.equinix.com";

  if (!host) {
    console.warn("[FEEDBACK] SMTP_HOST nicht konfiguriert – E-Mail-Versand nicht möglich");
    return null;
  }

  console.log(`[FEEDBACK] SMTP Transport: host=${host}, port=${port}, secure=${secure}, user=${user ? "(set)" : "(none)"}`);

  const transportConfig = {
    host,
    port,
    secure,
    tls: { rejectUnauthorized: false },
  };

  // Nur Auth hinzufügen, wenn Credentials vorhanden
  if (user && pass) {
    transportConfig.auth = { user, pass };
  }

  return {
    transporter: nodemailer.createTransport(transportConfig),
    fromAddress,
  };
}

/* ------------------------------------------------ */
/* EMPFÄNGER (aus app_settings, Fallback hardcoded) */
/* ------------------------------------------------ */

// Fallback: env-basiert, dann leer (= Fehler, wenn auch DB leer)
const DEFAULT_RECIPIENTS = (process.env.FEEDBACK_TO || "")
  .split(",")
  .map(e => e.trim())
  .filter(Boolean);

async function getRecipients() {
  try {
    const { rows } = await db.query("SELECT value FROM app_settings WHERE key = 'feedback.recipients'");
    if (rows.length > 0 && rows[0].value) {
      const parsed = rows[0].value.split(",").map(e => e.trim()).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn("[FEEDBACK] Could not load recipients from DB, using defaults");
  }
  if (DEFAULT_RECIPIENTS.length > 0) return DEFAULT_RECIPIENTS;
  console.warn("[FEEDBACK] Keine Empfänger konfiguriert (weder DB noch FEEDBACK_TO env)");
  return [];
}

async function getFeedbackSettings() {
  try {
    const { rows } = await db.query("SELECT key, value FROM app_settings WHERE key LIKE 'feedback.%'");
    return Object.fromEntries(rows.map(r => [r.key.replace('feedback.', ''), r.value]));
  } catch {
    return {};
  }
}

async function saveFeedbackToDb(data) {
  try {
    await db.query(
      `INSERT INTO feedback_entries (type, title, description, sender_name, sender_email, screenshot_name, email_sent, email_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [data.type, data.title, data.description, data.senderName, data.senderEmail, data.screenshotName, data.emailSent, data.emailError]
    );
  } catch (err) {
    console.error("[FEEDBACK] Failed to save feedback to DB:", err.message);
  }
}

/* ------------------------------------------------ */
/* POST /api/feedback                               */
/* ------------------------------------------------ */

router.post(
  "/",
  requireAuth,
  upload.single("screenshot"),
  async (req, res) => {
    try {
      const { type, title, description, route } = req.body;

      // Validierung
      if (!type || !["Bug", "Verbesserung"].includes(type)) {
        return res.status(400).json({ error: "Typ muss 'Bug' oder 'Verbesserung' sein" });
      }
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Titel ist ein Pflichtfeld" });
      }
      if (!description || typeof description !== "string" || description.trim().length === 0) {
        return res.status(400).json({ error: "Beschreibung ist ein Pflichtfeld" });
      }

      // User-Kontext
      const senderName = req.user?.displayName || req.user?.email || "Unbekannt";
      const senderEmail = req.user?.email || "unbekannt@local";
      const timestamp = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

      // Betreff
      const subject = `[${type}] ${title.trim()}`;

      // Body
      const body = [
        `ODIN Feedback – ${type}`,
        `${"=".repeat(40)}`,
        ``,
        `Typ:           ${type}`,
        `Titel:         ${title.trim()}`,
        ``,
        `Beschreibung:`,
        `${description.trim()}`,
        ``,
        `${"─".repeat(40)}`,
        `Absender:      ${senderName}`,
        `E-Mail:        ${senderEmail}`,
        `Zeitpunkt:     ${timestamp}`,
        `Route:         ${route || "–"}`,
        ``,
        req.file ? `Screenshot:    ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)` : `Screenshot:    –`,
      ].join("\n");

      // HTML Body
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px;">
          <h2 style="color: ${type === "Bug" ? "#dc2626" : "#2563eb"}; margin-bottom: 4px;">
            [${type}] ${escapeHtml(title.trim())}
          </h2>
          <hr style="border: 1px solid #e5e7eb;" />
          <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
            <tr><td style="padding: 6px 12px; font-weight: bold; width: 120px;">Typ:</td><td style="padding: 6px 12px;">${escapeHtml(type)}</td></tr>
            <tr><td style="padding: 6px 12px; font-weight: bold;">Titel:</td><td style="padding: 6px 12px;">${escapeHtml(title.trim())}</td></tr>
            <tr><td style="padding: 6px 12px; font-weight: bold; vertical-align: top;">Beschreibung:</td><td style="padding: 6px 12px; white-space: pre-wrap;">${escapeHtml(description.trim())}</td></tr>
          </table>
          <hr style="border: 1px solid #e5e7eb;" />
          <table style="border-collapse: collapse; width: 100%; font-size: 13px; color: #6b7280;">
            <tr><td style="padding: 4px 12px; font-weight: bold; width: 120px;">Absender:</td><td style="padding: 4px 12px;">${escapeHtml(senderName)}</td></tr>
            <tr><td style="padding: 4px 12px; font-weight: bold;">E-Mail:</td><td style="padding: 4px 12px;">${escapeHtml(senderEmail)}</td></tr>
            <tr><td style="padding: 4px 12px; font-weight: bold;">Zeitpunkt:</td><td style="padding: 4px 12px;">${escapeHtml(timestamp)}</td></tr>
            <tr><td style="padding: 4px 12px; font-weight: bold;">Route:</td><td style="padding: 4px 12px;">${escapeHtml(route || "–")}</td></tr>
            ${req.file ? `<tr><td style="padding: 4px 12px; font-weight: bold;">Screenshot:</td><td style="padding: 4px 12px;">${escapeHtml(req.file.originalname)}</td></tr>` : ""}
          </table>
          <p style="font-size: 11px; color: #9ca3af; margin-top: 16px;">Gesendet über ODIN Feedback-System</p>
        </div>
      `;

      // Attachments
      const attachments = [];
      if (req.file) {
        attachments.push({
          filename: req.file.originalname,
          content: req.file.buffer,
          contentType: req.file.mimetype,
        });
      }

      // Check if feedback is enabled
      const settings = await getFeedbackSettings();
      if (settings.enabled === 'false') {
        return res.status(403).json({ error: "Feedback-Funktion ist aktuell deaktiviert." });
      }

      // E-Mail versenden
      const smtp = createTransporter();
      const recipients = await getRecipients();
      const cc = settings.cc ? settings.cc.split(',').map(e => e.trim()).filter(Boolean) : [];
      const subjectPrefix = settings.subject_prefix || '[ODIN Feedback]';
      const fullSubject = `${subjectPrefix} ${subject}`;

      let emailSent = false;
      let emailError = null;

      if (!smtp) {
        emailError = "SMTP nicht konfiguriert";
        console.error("[FEEDBACK] SMTP nicht konfiguriert. Feedback-Daten:", { type, title: title.trim(), sender: senderName, timestamp });
      } else if (recipients.length === 0) {
        emailError = "Keine Empfänger konfiguriert";
        console.error("[FEEDBACK] Keine Empfänger konfiguriert – E-Mail kann nicht gesendet werden.");
      } else {
        try {
          const mailOpts = {
            from: smtp.fromAddress,
            to: recipients.join(", "),
            subject: fullSubject,
            text: body,
            html: htmlBody,
            attachments,
          };
          if (cc.length > 0) mailOpts.cc = cc.join(", ");

          await smtp.transporter.sendMail(mailOpts);
          emailSent = true;
          console.log(`[FEEDBACK] E-Mail gesendet: [${type}] ${title.trim()} von ${senderName}`);
        } catch (sendErr) {
          emailError = sendErr.message;
          console.error("[FEEDBACK] Sendefehler:", sendErr.message);
        }
      }

      // Always save to DB if configured or if email failed
      const shouldSaveToDb = settings.save_to_db_on_failure !== 'false';
      if (!emailSent && shouldSaveToDb) {
        await saveFeedbackToDb({
          type, title: title.trim(), description: description.trim(),
          senderName, senderEmail, screenshotName: req.file?.originalname || null,
          emailSent, emailError,
        });
      } else if (emailSent) {
        // Also save to DB for record-keeping
        await saveFeedbackToDb({
          type, title: title.trim(), description: description.trim(),
          senderName, senderEmail, screenshotName: req.file?.originalname || null,
          emailSent: true, emailError: null,
        });
      }

      if (emailSent) {
        res.json({ success: true, message: "Feedback wurde erfolgreich gesendet." });
      } else if (shouldSaveToDb) {
        res.json({ success: true, message: "Feedback wurde gespeichert. E-Mail-Versand fehlgeschlagen, wird manuell geprüft.", saved_to_db: true });
      } else {
        res.status(503).json({
          error: "E-Mail-Versand ist aktuell nicht konfiguriert. Bitte IT kontaktieren.",
          logged: true,
        });
      }

    } catch (err) {
      console.error("[FEEDBACK] Fehler beim Versand:", err);
      // Last resort: try saving to DB
      try {
        await saveFeedbackToDb({
          type: req.body?.type, title: req.body?.title, description: req.body?.description,
          senderName: req.user?.email || 'unknown', senderEmail: req.user?.email,
          screenshotName: null, emailSent: false, emailError: err.message,
        });
      } catch { /* ignore */ }
      res.status(500).json({
        error: "Feedback konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.",
      });
    }
  }
);

/* ------------------------------------------------ */
/* HTML ESCAPE HELPER                               */
/* ------------------------------------------------ */

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Log SMTP config status on module load
if (process.env.SMTP_HOST) {
  console.log(`[FEEDBACK] SMTP konfiguriert: host=${process.env.SMTP_HOST}, port=${process.env.SMTP_PORT || "587"}`);
} else {
  console.warn("[FEEDBACK] SMTP_HOST nicht gesetzt. Feedback-E-Mails werden nicht versendet. Setze SMTP_HOST, SMTP_PORT (opt.), SMTP_USER (opt.), SMTP_PASS (opt.), SMTP_FROM (opt.) in der .env-Datei.");
}

export default router;
