/* ------------------------------------------------ */
/* FEEDBACK ROUTE – E-MAIL VERSAND (KEIN DB)        */
/* Empfänger: patrick.brode / marco.dessi            */
/* ------------------------------------------------ */

import express from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/authMiddleware.js";

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
/* EMPFÄNGER                                        */
/* ------------------------------------------------ */

const FEEDBACK_RECIPIENTS = [
  "patrick.brode@eu.equinix.com",
  "marco.dessi@eu.equinix.com",
];

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

      // E-Mail versenden
      const smtp = createTransporter();
      if (!smtp) {
        console.error("[FEEDBACK] SMTP nicht konfiguriert. Feedback-Daten:", { type, title: title.trim(), sender: senderName, timestamp });
        return res.status(503).json({
          error: "E-Mail-Versand ist aktuell nicht konfiguriert. Bitte IT kontaktieren.",
          logged: true,
        });
      }

      await smtp.transporter.sendMail({
        from: smtp.fromAddress,
        to: FEEDBACK_RECIPIENTS.join(", "),
        subject,
        text: body,
        html: htmlBody,
        attachments,
      });

      console.log(`[FEEDBACK] E-Mail gesendet: [${type}] ${title.trim()} von ${senderName}`);
      res.json({ success: true, message: "Feedback wurde erfolgreich gesendet." });

    } catch (err) {
      console.error("[FEEDBACK] Fehler beim Versand:", err);
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

export default router;
