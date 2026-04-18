/**
 * Adaptive Card: Shift Verification Request
 * Sent to individual employees after shift start to verify availability.
 *
 * Flow:
 * 1. Initial card: "Bist du anwesend und verfügbar?" → Ja / Nein
 * 2. If "Nein": Follow-up card: "Warum?" → Krank / Andere Schicht
 */

import { ACTION_TYPES } from "../models/index";

export interface VerificationPayload {
  employeeName: string;
  shiftCode: string;
  date: string;
  shiftStart?: string;
}

/**
 * Build the initial verification card.
 * Buttons: "Ja" (verified) / "Nein" (triggers follow-up)
 */
export function buildVerificationCard(payload: VerificationPayload): Record<string, unknown> {
  const shiftLabel = getShiftLabel(payload.shiftCode);

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "auto",
            items: [
              { type: "TextBlock", text: "🔔", size: "Large" },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: "Schicht-Verifizierung",
                weight: "Bolder",
                size: "Medium",
                wrap: true,
              },
              {
                type: "TextBlock",
                text: `ODIN prüft deine Verfügbarkeit für heute`,
                spacing: "None",
                isSubtle: true,
                wrap: true,
              },
            ],
          },
        ],
      },
      {
        type: "Container",
        separator: true,
        spacing: "Medium",
        items: [
          factRow("Schicht", `${payload.shiftCode} — ${shiftLabel}`),
          factRow("Datum", formatDateDE(payload.date)),
          ...(payload.shiftStart ? [factRow("Schichtbeginn", payload.shiftStart)] : []),
        ],
      },
      {
        type: "TextBlock",
        text: "**Bist du anwesend und verfügbar?**",
        spacing: "Medium",
        wrap: true,
        size: "Medium",
      },
    ],
    actions: [
      {
        type: "Action.Execute",
        title: "✅ Ja, ich bin verfügbar",
        verb: ACTION_TYPES.VERIFICATION_YES,
        data: {
          action: ACTION_TYPES.VERIFICATION_YES,
          entityId: `${payload.employeeName}|${payload.date}|${payload.shiftCode}`,
          context: {
            employeeName: payload.employeeName,
            date: payload.date,
            shiftCode: payload.shiftCode,
          },
        },
        style: "positive",
      },
      {
        type: "Action.Execute",
        title: "❌ Nein",
        verb: ACTION_TYPES.VERIFICATION_NO,
        data: {
          action: ACTION_TYPES.VERIFICATION_NO,
          entityId: `${payload.employeeName}|${payload.date}|${payload.shiftCode}`,
          context: {
            employeeName: payload.employeeName,
            date: payload.date,
            shiftCode: payload.shiftCode,
          },
        },
        style: "destructive",
      },
    ],
  };
}

/**
 * Build the follow-up card when employee clicks "Nein".
 * Buttons: "Krank" / "Andere Schicht"
 */
export function buildVerificationFollowUpCard(payload: VerificationPayload): Record<string, unknown> {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "auto",
            items: [
              { type: "TextBlock", text: "❓", size: "Large" },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: "Warum bist du nicht verfügbar?",
                weight: "Bolder",
                size: "Medium",
                wrap: true,
              },
              {
                type: "TextBlock",
                text: `Schicht: ${payload.shiftCode} am ${formatDateDE(payload.date)}`,
                spacing: "None",
                isSubtle: true,
                wrap: true,
              },
            ],
          },
        ],
      },
    ],
    actions: [
      {
        type: "Action.Execute",
        title: "🤒 Krank",
        verb: ACTION_TYPES.VERIFICATION_SICK,
        data: {
          action: ACTION_TYPES.VERIFICATION_SICK,
          entityId: `${payload.employeeName}|${payload.date}|${payload.shiftCode}`,
          context: {
            employeeName: payload.employeeName,
            date: payload.date,
            shiftCode: payload.shiftCode,
          },
        },
        style: "destructive",
      },
      {
        type: "Action.Execute",
        title: "🔄 Andere Schicht",
        verb: ACTION_TYPES.VERIFICATION_WRONG_SHIFT,
        data: {
          action: ACTION_TYPES.VERIFICATION_WRONG_SHIFT,
          entityId: `${payload.employeeName}|${payload.date}|${payload.shiftCode}`,
          context: {
            employeeName: payload.employeeName,
            date: payload.date,
            shiftCode: payload.shiftCode,
          },
        },
      },
    ],
  };
}

/**
 * Build a confirmation card after the employee has responded.
 */
export function buildVerificationConfirmationCard(
  payload: VerificationPayload,
  status: string
): Record<string, unknown> {
  const statusInfo = getStatusInfo(status);

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "auto",
            items: [
              { type: "TextBlock", text: statusInfo.emoji, size: "Large" },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: statusInfo.title,
                weight: "Bolder",
                size: "Medium",
                wrap: true,
              },
              {
                type: "TextBlock",
                text: statusInfo.description,
                spacing: "None",
                isSubtle: true,
                wrap: true,
              },
            ],
          },
        ],
      },
      {
        type: "Container",
        separator: true,
        spacing: "Medium",
        items: [
          factRow("Schicht", `${payload.shiftCode}`),
          factRow("Datum", formatDateDE(payload.date)),
          factRow("Status", statusInfo.label),
        ],
      },
    ],
  };
}

// ── Helpers ──

function factRow(label: string, value: string): Record<string, unknown> {
  return {
    type: "ColumnSet",
    spacing: "Small",
    columns: [
      {
        type: "Column",
        width: "100px",
        items: [
          { type: "TextBlock", text: label, isSubtle: true, size: "Small", wrap: true },
        ],
      },
      {
        type: "Column",
        width: "stretch",
        items: [
          { type: "TextBlock", text: value, weight: "Bolder", size: "Small", wrap: true },
        ],
      },
    ],
  };
}

function getShiftLabel(code: string): string {
  const labels: Record<string, string> = {
    E1: "Frühschicht (06:30–15:30)",
    E2: "Frühschicht (07:00–16:00)",
    L1: "Spätschicht (13:00–22:00)",
    L2: "Spätschicht (15:00–00:00)",
    N: "Nachtschicht (21:15–06:45)",
  };
  return labels[code.toUpperCase()] || code;
}

function formatDateDE(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function getStatusInfo(status: string): { emoji: string; title: string; description: string; label: string } {
  switch (status) {
    case "verified":
      return {
        emoji: "✅",
        title: "Verifizierung bestätigt",
        description: "Du wurdest als verfügbar registriert. ODIN wird dir Tickets zuweisen können.",
        label: "Verifiziert",
      };
    case "sick":
      return {
        emoji: "🤒",
        title: "Krankmeldung erfasst",
        description: "Deine Krankmeldung wurde registriert. Du wirst heute keine Tickets erhalten.",
        label: "Krank",
      };
    case "wrong_shift":
      return {
        emoji: "🔄",
        title: "Abweichende Schicht",
        description: "Dein Schichtstatus wurde aktualisiert. Du wirst für diese Schicht nicht berücksichtigt.",
        label: "Andere Schicht",
      };
    default:
      return {
        emoji: "ℹ️",
        title: "Status aktualisiert",
        description: `Dein Status wurde auf "${status}" gesetzt.`,
        label: status,
      };
  }
}
