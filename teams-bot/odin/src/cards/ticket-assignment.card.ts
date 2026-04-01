/**
 * Adaptive Card: Ticket Assignment Notification
 * Sent to individual employees when ODIN assigns a ticket.
 */

import type { TicketNotifyPayload } from "../models/index";
import { ACTION_TYPES } from "../models/index";

export function buildTicketAssignmentCard(payload: TicketNotifyPayload): Record<string, unknown> {
  const priorityColor = getPriorityColor(payload.priority);
  const remainingText = payload.remainingMinutes != null
    ? `${payload.remainingMinutes} Minuten`
    : "—";

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
              {
                type: "TextBlock",
                text: "🎫",
                size: "Large",
              },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: "Neue Ticket-Zuweisung",
                weight: "Bolder",
                size: "Medium",
                wrap: true,
              },
              {
                type: "TextBlock",
                text: `ODIN hat dir ein Ticket zugewiesen`,
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
          factRow("Ticket ID", payload.ticketId),
          factRow("Typ", payload.ticketType),
          factRow("Priorität", payload.priority, priorityColor),
          factRow("System", payload.systemName),
          ...(payload.accountName ? [factRow("Account", payload.accountName)] : []),
          factRow("Restzeit", remainingText),
          ...(payload.commitAt ? [factRow("Commit", new Date(payload.commitAt).toLocaleString("de-DE"))] : []),
          ...(payload.reason ? [factRow("Grund", payload.reason)] : []),
        ],
      },
    ],
    actions: [
      {
        type: "Action.Execute",
        title: "✅ Übernehmen",
        verb: ACTION_TYPES.TICKET_ACCEPT,
        data: {
          action: ACTION_TYPES.TICKET_ACCEPT,
          entityId: payload.ticketId,
          context: { ticketType: payload.ticketType, systemName: payload.systemName },
        },
        style: "positive",
      },
      {
        type: "Action.Execute",
        title: "❌ Nicht möglich",
        verb: ACTION_TYPES.TICKET_REJECT,
        data: {
          action: ACTION_TYPES.TICKET_REJECT,
          entityId: payload.ticketId,
          context: { ticketType: payload.ticketType, systemName: payload.systemName },
        },
        style: "destructive",
      },
      {
        type: "Action.Execute",
        title: "❓ Rückfrage",
        verb: ACTION_TYPES.TICKET_QUESTION,
        data: {
          action: ACTION_TYPES.TICKET_QUESTION,
          entityId: payload.ticketId,
          context: { ticketType: payload.ticketType, systemName: payload.systemName },
        },
      },
    ],
  };
}

// ── Helpers ──

function factRow(label: string, value: string, color?: string): Record<string, unknown> {
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
          {
            type: "TextBlock",
            text: value,
            weight: "Bolder",
            size: "Small",
            wrap: true,
            ...(color ? { color } : {}),
          },
        ],
      },
    ],
  };
}

function getPriorityColor(priority: string): string | undefined {
  const p = priority.toLowerCase();
  if (p === "high" || p === "critical" || p === "1") return "Attention";
  if (p === "medium" || p === "2") return "Warning";
  return undefined;
}
