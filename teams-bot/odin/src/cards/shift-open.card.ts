/**
 * Adaptive Card: Shift Open / Understaffing Notification
 * Posted to a team channel or group chat when ODIN detects understaffing.
 */

import type { ShiftOpenNotifyPayload } from "../models/index";
import { ACTION_TYPES } from "../models/index";

export function buildShiftOpenCard(payload: ShiftOpenNotifyPayload): Record<string, unknown> {
  const startStr = new Date(payload.startAt).toLocaleString("de-DE", {
    weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const endStr = new Date(payload.endAt).toLocaleString("de-DE", {
    hour: "2-digit", minute: "2-digit",
  });

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
            items: [{ type: "TextBlock", text: "⚠️", size: "Large" }],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: payload.title,
                weight: "Bolder",
                size: "Medium",
                color: "Attention",
                wrap: true,
              },
              ...(payload.message
                ? [{
                    type: "TextBlock",
                    text: payload.message,
                    spacing: "None",
                    isSubtle: true,
                    wrap: true,
                  }]
                : []),
            ],
          },
        ],
      },
      {
        type: "Container",
        separator: true,
        spacing: "Medium",
        items: [
          factRow("Zeitraum", `${startStr} – ${endStr}`),
          ...(payload.location ? [factRow("Standort", payload.location)] : []),
          factRow("Schicht-ID", payload.shiftId),
          ...(payload.requiresSupervisorApproval
            ? [{ type: "TextBlock", text: "ℹ️ Supervisor-Freigabe erforderlich", size: "Small", isSubtle: true, spacing: "Small", wrap: true }]
            : []),
        ],
      },
    ],
    actions: [
      {
        type: "Action.Execute",
        title: "✅ Ich übernehme",
        verb: ACTION_TYPES.SHIFT_ACCEPT,
        data: {
          action: ACTION_TYPES.SHIFT_ACCEPT,
          entityId: payload.shiftId,
          context: { startAt: payload.startAt, endAt: payload.endAt, location: payload.location },
        },
        style: "positive",
      },
      {
        type: "Action.Execute",
        title: "❌ Kann nicht",
        verb: ACTION_TYPES.SHIFT_REJECT,
        data: {
          action: ACTION_TYPES.SHIFT_REJECT,
          entityId: payload.shiftId,
          context: { startAt: payload.startAt, endAt: payload.endAt },
        },
        style: "destructive",
      },
    ],
  };
}

function factRow(label: string, value: string): Record<string, unknown> {
  return {
    type: "ColumnSet",
    spacing: "Small",
    columns: [
      {
        type: "Column",
        width: "100px",
        items: [{ type: "TextBlock", text: label, isSubtle: true, size: "Small", wrap: true }],
      },
      {
        type: "Column",
        width: "stretch",
        items: [{ type: "TextBlock", text: value, weight: "Bolder", size: "Small", wrap: true }],
      },
    ],
  };
}
