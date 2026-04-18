/**
 * Notification Service — sends proactive messages via the bot.
 *
 * Resolves employee → conversation reference, builds the card, sends.
 * Works with the Teams SDK v2 App.send() for proactive delivery.
 */

import type { App } from "@microsoft/teams.apps";
import type { ConversationReference } from "@microsoft/teams.api";
import type { IConversationRefRepository, IUserMappingRepository } from "../repositories/index";
import type { TicketNotifyPayload, ShiftOpenNotifyPayload, SupervisorApprovalPayload, VerificationNotifyPayload, StoredConversationRef } from "../models/index";
import { buildTicketAssignmentCard } from "../cards/ticket-assignment.card";
import { buildShiftOpenCard } from "../cards/shift-open.card";
import { buildSupervisorApprovalCard } from "../cards/supervisor-approval.card";
import { buildVerificationCard } from "../cards/verification.card";
import { GraphService, GraphError } from "./graph.service";
import type { GraphMessageAttachment } from "./graph.service";
import { logger } from "../utils/logger";

export interface NotifyResult {
  success: boolean;
  error?: string;
  conversationId?: string;
  resolvedVia?: "cache" | "graph";
}

export class NotificationService {
  constructor(
    private app: App,
    private convRefRepo: IConversationRefRepository,
    private userMappingRepo: IUserMappingRepository,
    private graphService?: GraphService
  ) {}

  /**
   * Send a ticket assignment card to an individual employee (personal chat).
   *
   * Resolution order:
   * 1. employeeId → UserMapping → aadObjectId → ConversationRef (cached)
   * 2. email → Graph: resolve user → install app → create chat → build ConvRef → send
   */
  async sendTicketNotification(payload: TicketNotifyPayload): Promise<NotifyResult> {
    // ── Try cached path: employeeId → mapping → convRef ──
    if (payload.employeeId) {
      const mapping = await this.userMappingRepo.getByEmployeeId(payload.employeeId);
      if (mapping && mapping.enabled) {
        const convRef = await this.resolvePersonalConvRef(mapping.aadObjectId);
        if (convRef) {
          return this.sendCardViaConvRef(payload, convRef, mapping.displayName, "cache");
        }
        // If mapping exists but has email, try Graph with that email
        if (mapping.email && this.graphService) {
          logger.info(`Ticket notify: no convRef for ${payload.employeeId}, falling back to Graph with mapping email=${mapping.email}`);
          return this.sendTicketViaGraph(payload, mapping.email);
        }
        logger.warn(`Ticket notify: no conversation reference for employeeId=${payload.employeeId} and no Graph fallback available`);
        return { success: false, error: `No conversation reference found and no Graph fallback. employeeId: ${payload.employeeId}` };
      }
      if (mapping && !mapping.enabled) {
        return { success: false, error: `User mapping disabled for employeeId: ${payload.employeeId}` };
      }
      // No mapping found — fall through to email if provided
    }

    // ── Try email path via Graph ──
    if (payload.email && this.graphService) {
      return this.sendTicketViaGraph(payload, payload.email);
    }

    // ── No resolution possible ──
    const id = payload.employeeId || payload.email || "unknown";
    logger.warn(`Ticket notify: cannot resolve user. employeeId=${payload.employeeId}, email=${payload.email}`);
    return { success: false, error: `Cannot resolve user: ${id}. Provide employeeId (with mapping) or email (with Graph config).` };
  }

  /**
   * Graph fallback flow: email → user → install app → create chat → build convRef → send card.
   */
  private async sendTicketViaGraph(payload: TicketNotifyPayload, email: string): Promise<NotifyResult> {
    if (!this.graphService) {
      logger.warn("Graph user resolution is disabled because required Graph configuration is missing.");
      return { success: false, error: "Graph user resolution is disabled because required Graph configuration is missing." };
    }

    try {
      // 1. Resolve user
      const graphUser = await this.graphService.getUserByEmail(email);

      // 2. Install app
      await this.graphService.ensureAppInstalled(graphUser.id);

      // 3. Create or get 1:1 chat
      const chat = await this.graphService.createOrGetChat(graphUser.id);

      // 4. Build and store ConversationReference
      const convRef = this.buildConversationRef(graphUser.id, graphUser.displayName, chat.id, graphUser.userPrincipalName);
      await this.convRefRepo.upsert(convRef);
      logger.info(`[GRAPH] ConversationRef stored: key=${convRef.key} for ${graphUser.displayName}`);

      // 5. Update user mapping if employeeId provided
      if (payload.employeeId) {
        try {
          const existing = await this.userMappingRepo.getByEmployeeId(payload.employeeId);
          if (existing) {
            await this.userMappingRepo.updateTeamsIdentity(payload.employeeId, {
              aadObjectId: graphUser.id,
              upn: graphUser.userPrincipalName,
            });
          } else {
            // Auto-create mapping
            await this.userMappingRepo.upsert({
              employeeId: payload.employeeId,
              displayName: graphUser.displayName,
              email,
              aadObjectId: graphUser.id,
              upn: graphUser.userPrincipalName,
              enabled: true,
            });
          }
          logger.info(`[GRAPH] UserMapping updated for employeeId=${payload.employeeId}`);
        } catch (err: unknown) {
          logger.warn("[GRAPH] Failed to update user mapping (non-fatal)", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // 6. Send the card via Graph message (Adaptive Card attachment format)
      const card = buildTicketAssignmentCard(payload);
      const cardJson = JSON.stringify(card);
      const attachmentId = `card-${Date.now()}`;
      const attachments: GraphMessageAttachment[] = [
        {
          id: attachmentId,
          contentType: "application/vnd.microsoft.card.adaptive",
          content: cardJson,
        },
      ];

      await this.graphService.sendMessage(
        chat.id,
        `<attachment id="${attachmentId}"></attachment>`,
        attachments
      );
      logger.info(`[GRAPH] Ticket notification sent via Graph: ticketId=${payload.ticketId} → ${graphUser.displayName}`);
      return { success: true, conversationId: chat.id, resolvedVia: "graph" };
    } catch (err: unknown) {
      if (err instanceof GraphError) {
        if (err.code === "USER_NOT_FOUND") {
          logger.warn(`No Microsoft Graph user found for email: ${email}`);
        } else {
          logger.error(`[GRAPH] ${err.code}: ${err.message}`, { statusCode: err.statusCode, responseBody: err.responseBody });
        }
        return { success: false, error: `Graph: ${err.code} — ${err.message}` };
      }
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("[GRAPH] Unexpected error in ticket notification flow", { error: msg });
      return { success: false, error: `Graph flow failed: ${msg}` };
    }
  }

  /** Send card via cached ConversationReference (bot framework path) */
  private async sendCardViaConvRef(
    payload: TicketNotifyPayload,
    convRef: StoredConversationRef,
    displayName: string,
    via: "cache" | "graph"
  ): Promise<NotifyResult> {
    const card = buildTicketAssignmentCard(payload);
    try {
      await this.app.send(convRef.reference.conversation.id, {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card,
          },
        ],
      });
      logger.info(`Ticket notification sent: ticketId=${payload.ticketId} → ${displayName}`);
      return { success: true, conversationId: convRef.reference.conversation.id, resolvedVia: via };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Ticket notification failed: ticketId=${payload.ticketId}`, { error: msg });
      return { success: false, error: `Send failed: ${msg}` };
    }
  }

  /** Build a synthetic ConversationReference for Graph-created chats */
  private buildConversationRef(aadObjectId: string, displayName: string, chatId: string, upn?: string): StoredConversationRef {
    const now = new Date().toISOString();
    return {
      key: aadObjectId,
      aadObjectId,
      upn,
      displayName,
      scope: "personal",
      reference: {
        conversation: { id: chatId, conversationType: "personal" },
        user: { id: aadObjectId, name: displayName, aadObjectId },
        bot: { id: "", name: "ODIN Bot" },
        serviceUrl: "https://smba.trafficmanager.net/emea/",
      } as unknown as ConversationReference,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Send a shift-open / understaffing card to a channel or group chat.
   * Falls back to sending to all stored channel references if channelKey is not found.
   */
  async sendShiftOpenNotification(payload: ShiftOpenNotifyPayload): Promise<NotifyResult> {
    // Try to find a channel conversation reference by key
    let convRef = payload.channelKey
      ? await this.convRefRepo.getByKey(payload.channelKey)
      : undefined;

    if (!convRef) {
      // Fallback: try first channel reference
      const channels = await this.convRefRepo.getByScope("channel");
      const groups = await this.convRefRepo.getByScope("groupChat");
      const all = [...channels, ...groups];
      if (all.length === 0) {
        logger.warn(`Shift-open notify: no channel/group conversation references stored`);
        return { success: false, error: "No channel or group chat conversation references available" };
      }
      convRef = all[0];
      logger.info(`Shift-open notify: using fallback conversation ref key=${convRef.key}`);
    }

    const card = buildShiftOpenCard(payload);
    try {
      await this.app.send(convRef.reference.conversation.id, {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card,
          },
        ],
      });
      logger.info(`Shift-open notification sent: shiftId=${payload.shiftId}`);
      return { success: true, conversationId: convRef.reference.conversation.id };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Shift-open notification failed: shiftId=${payload.shiftId}`, { error: msg });
      return { success: false, error: `Send failed: ${msg}` };
    }
  }

  /**
   * Send a supervisor approval card to a specific supervisor (personal chat).
   */
  async sendSupervisorApproval(payload: SupervisorApprovalPayload): Promise<NotifyResult> {
    const mapping = await this.userMappingRepo.getByEmployeeId(payload.supervisorEmployeeId);
    if (!mapping) {
      logger.warn(`Supervisor approval: no user mapping for supervisorEmployeeId=${payload.supervisorEmployeeId}`);
      return { success: false, error: `No user mapping found for supervisorEmployeeId: ${payload.supervisorEmployeeId}` };
    }

    const convRef = await this.resolvePersonalConvRef(mapping.aadObjectId);
    if (!convRef) {
      logger.warn(`Supervisor approval: no conversation reference for supervisor ${mapping.displayName}`);
      return { success: false, error: `No conversation reference for supervisor. They must message the bot first.` };
    }

    const card = buildSupervisorApprovalCard(payload);
    try {
      await this.app.send(convRef.reference.conversation.id, {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card,
          },
        ],
      });
      logger.info(`Supervisor approval sent: entityId=${payload.entityId} → ${mapping.displayName}`);
      return { success: true, conversationId: convRef.reference.conversation.id };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Supervisor approval send failed: entityId=${payload.entityId}`, { error: msg });
      return { success: false, error: `Send failed: ${msg}` };
    }
  }

  /**
   * Send a shift verification card to an employee (personal chat).
   * Uses the same resolution logic as ticket notifications:
   * 1. employeeName → UserMapping → ConvRef (cached)
   * 2. email → Graph fallback
   */
  async sendVerificationNotification(payload: VerificationNotifyPayload): Promise<NotifyResult> {
    // Try cached path: employeeId → mapping → convRef
    const lookupId = payload.employeeId || payload.employeeName;
    const mapping = await this.userMappingRepo.getByEmployeeId(lookupId);

    if (mapping && mapping.enabled) {
      const convRef = await this.resolvePersonalConvRef(mapping.aadObjectId);
      if (convRef) {
        const card = buildVerificationCard({
          employeeName: payload.employeeName,
          shiftCode: payload.shiftCode,
          date: payload.date,
        });
        try {
          await this.app.send(convRef.reference.conversation.id, {
            type: "message",
            attachments: [
              { contentType: "application/vnd.microsoft.card.adaptive", content: card },
            ],
          });
          logger.info(`Verification sent: ${payload.employeeName} (${payload.shiftCode}) via cache`);
          return { success: true, conversationId: convRef.reference.conversation.id, resolvedVia: "cache" };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`Verification send failed: ${payload.employeeName}`, { error: msg });
          return { success: false, error: `Send failed: ${msg}` };
        }
      }
      // Fall through to Graph if email available
      if (mapping.email && this.graphService) {
        return this.sendVerificationViaGraph(payload, mapping.email);
      }
      return { success: false, error: `No conversation reference for ${lookupId} and no Graph fallback` };
    }

    // Try email path via Graph
    if (payload.email && this.graphService) {
      return this.sendVerificationViaGraph(payload, payload.email);
    }

    logger.warn(`Verification notify: cannot resolve user ${payload.employeeName}`);
    return { success: false, error: `Cannot resolve user: ${payload.employeeName}` };
  }

  /** Send verification card via Graph (email-based fallback) */
  private async sendVerificationViaGraph(payload: VerificationNotifyPayload, email: string): Promise<NotifyResult> {
    if (!this.graphService) {
      return { success: false, error: "Graph not available" };
    }
    try {
      const graphUser = await this.graphService.getUserByEmail(email);
      await this.graphService.ensureAppInstalled(graphUser.id);
      const chat = await this.graphService.createOrGetChat(graphUser.id);

      const convRef = this.buildConversationRef(graphUser.id, graphUser.displayName, chat.id, graphUser.userPrincipalName);
      await this.convRefRepo.upsert(convRef);

      const card = buildVerificationCard({
        employeeName: payload.employeeName,
        shiftCode: payload.shiftCode,
        date: payload.date,
      });
      const cardJson = JSON.stringify(card);
      const attachmentId = `verify-${Date.now()}`;
      const attachments: GraphMessageAttachment[] = [
        { id: attachmentId, contentType: "application/vnd.microsoft.card.adaptive", content: cardJson },
      ];
      await this.graphService.sendMessage(
        chat.id,
        `<attachment id="${attachmentId}"></attachment>`,
        attachments
      );
      logger.info(`Verification sent via Graph: ${payload.employeeName} (${payload.shiftCode})`);
      return { success: true, conversationId: chat.id, resolvedVia: "graph" };
    } catch (err: unknown) {
      if (err instanceof GraphError) {
        return { success: false, error: `Graph: ${err.code} — ${err.message}` };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Graph flow failed: ${msg}` };
    }
  }

  /** Resolve AAD Object ID → personal conversation reference */
  private async resolvePersonalConvRef(aadObjectId?: string) {
    if (!aadObjectId) return undefined;
    return this.convRefRepo.getByAadObjectId(aadObjectId);
  }
}

/** Minimal HTML escaping for embedding JSON inside HTML content */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
