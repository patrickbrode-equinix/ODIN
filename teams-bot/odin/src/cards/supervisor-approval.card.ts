/**
 * Adaptive Card: Supervisor Approval Request
 * Sent to a supervisor for approve/reject of a shift change or similar action.
 */

import type { SupervisorApprovalPayload } from "../models/index";
import { ACTION_TYPES } from "../models/index";

export function buildSupervisorApprovalCard(payload: SupervisorApprovalPayload): Record<string, unknown> {
  const startStr = payload.startAt
    ? new Date(payload.startAt).toLocaleString("de-DE", {
        weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      })
    : undefined;
  const endStr = payload.endAt
    ? new Date(payload.endAt).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : undefined;

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
            items: [{ type: "TextBlock", text: "🔐", size: "Large" }],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: "Supervisor-Freigabe erforderlich",
                weight: "Bolder",
                size: "Medium",
                wrap: true,
              },
              {
                type: "TextBlock",
                text: `Typ: ${payload.entityType}`,
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
          factRow("Mitarbeiter", payload.employeeName),
          ...(payload.shiftLabel ? [factRow("Schicht", payload.shiftLabel)] : []),
          ...(startStr && endStr ? [factRow("Zeitraum", `${startStr} – ${endStr}`)] : []),
          ...(payload.reason ? [factRow("Grund", payload.reason)] : []),
          factRow("Referenz", payload.entityId),
        ],
      },
    ],
    actions: [
      {
        type: "Action.Execute",
        title: "✅ Freigeben",
        verb: ACTION_TYPES.SUPERVISOR_APPROVE,
        data: {
          action: ACTION_TYPES.SUPERVISOR_APPROVE,
          entityId: payload.entityId,
          context: {
            entityType: payload.entityType,
            employeeName: payload.employeeName,
          },
        },
        style: "positive",
      },
      {
        type: "Action.Execute",
        title: "❌ Ablehnen",
        verb: ACTION_TYPES.SUPERVISOR_REJECT,
        data: {
          action: ACTION_TYPES.SUPERVISOR_REJECT,
          entityId: payload.entityId,
          context: {
            entityType: payload.entityType,
            employeeName: payload.employeeName,
          },
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
