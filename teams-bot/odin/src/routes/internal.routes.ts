/**
 * Internal API routes for ODIN → Bot proactive notifications.
 *
 * All endpoints under /api/internal/* are protected by API key.
 */

import { Router, json } from "express";
import type { Request, Response } from "express";
import { requireApiKey } from "./auth.middleware";
import type { NotificationService } from "../services/notification.service";
import type { IConversationRefRepository, IUserMappingRepository } from "../repositories/index";
import type {
  TicketNotifyPayload,
  ShiftOpenNotifyPayload,
  SupervisorApprovalPayload,
} from "../models/index";
import { getConfig, isGraphEnabled } from "../config/index";
import { GraphService, GraphError } from "../services/graph.service";
import { logger } from "../utils/logger";

export interface InternalRouteDeps {
  notificationService: NotificationService;
  convRefRepo: IConversationRefRepository;
  userMappingRepo: IUserMappingRepository;
  graphService?: GraphService;
}

export function createInternalRoutes(deps: InternalRouteDeps): Router {
  const { notificationService, convRefRepo, userMappingRepo, graphService } = deps;
  const router = Router();
  router.use(json({ limit: "100kb" }));
  router.use(requireApiKey);

  // ── Health Check ──
  router.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "odin-teams-bot",
      timestamp: new Date().toISOString(),
      features: {
        directNotifications: getConfig().enableDirectNotifications,
        groupNotifications: getConfig().enableGroupNotifications,
        supervisorApproval: getConfig().enableSupervisorApproval,
      },
    });
  });

  // ── POST /api/internal/notify/ticket ──
  router.post("/notify/ticket", async (req: Request, res: Response) => {
    const payload = req.body as TicketNotifyPayload;

    if ((!payload.employeeId && !payload.email) || !payload.ticketId || !payload.ticketType || !payload.priority || !payload.systemName) {
      res.status(400).json({ error: "Missing required fields: (employeeId or email), ticketId, ticketType, priority, systemName" });
      return;
    }

    if (!getConfig().enableDirectNotifications) {
      logger.info("Ticket notification skipped: ENABLE_DIRECT_NOTIFICATIONS=false");
      res.status(200).json({ success: false, reason: "Direct notifications disabled" });
      return;
    }

    logger.info(`Notify ticket: ticketId=${payload.ticketId} → employeeId=${payload.employeeId}`);
    const result = await notificationService.sendTicketNotification(payload);
    res.status(result.success ? 200 : 422).json(result);
  });

  // ── POST /api/internal/notify/shift-open ──
  router.post("/notify/shift-open", async (req: Request, res: Response) => {
    const payload = req.body as ShiftOpenNotifyPayload;

    if (!payload.shiftId || !payload.title || !payload.startAt || !payload.endAt) {
      res.status(400).json({ error: "Missing required fields: shiftId, title, startAt, endAt" });
      return;
    }

    if (!getConfig().enableGroupNotifications) {
      logger.info("Shift-open notification skipped: ENABLE_GROUP_NOTIFICATIONS=false");
      res.status(200).json({ success: false, reason: "Group notifications disabled" });
      return;
    }

    logger.info(`Notify shift-open: shiftId=${payload.shiftId}`);
    const result = await notificationService.sendShiftOpenNotification(payload);
    res.status(result.success ? 200 : 422).json(result);
  });

  // ── POST /api/internal/notify/supervisor-approval ──
  router.post("/notify/supervisor-approval", async (req: Request, res: Response) => {
    const payload = req.body as SupervisorApprovalPayload;

    if (!payload.entityId || !payload.entityType || !payload.employeeName || !payload.supervisorEmployeeId) {
      res.status(400).json({ error: "Missing required fields: entityId, entityType, employeeName, supervisorEmployeeId" });
      return;
    }

    if (!getConfig().enableSupervisorApproval) {
      logger.info("Supervisor approval notification skipped: ENABLE_SUPERVISOR_APPROVAL=false");
      res.status(200).json({ success: false, reason: "Supervisor approval disabled" });
      return;
    }

    logger.info(`Notify supervisor-approval: entityId=${payload.entityId}`);
    const result = await notificationService.sendSupervisorApproval(payload);
    res.status(result.success ? 200 : 422).json(result);
  });

  // ── DEBUG: Graph Test ──
  router.get("/debug/graph-test", async (req: Request, res: Response) => {
    const email = (req.query.email as string) || "";
    if (!isGraphEnabled()) {
      res.status(503).json({ error: "Graph not enabled", missing: getGraphMissing() });
      return;
    }
    if (!graphService) {
      res.status(503).json({ error: "Graph service instance not available" });
      return;
    }
    const steps: Record<string, unknown> = {
      tokenAcquired: false,
      userResolved: false,
      appInstalled: false,
      chatResolved: false,
      messageSent: false,
      permissionHints: getGraphPermissionHints(),
    };
    try {
      // Step 1: Token
      const token = await (graphService as any).getToken();
      steps.tokenAcquired = true;
      steps.tokenDetails = summarizeGraphToken(token);

      if (!email) {
        res.status(200).json({ success: true, steps });
        return;
      }
      // Step 2: Resolve user
      const user = await graphService.getUserByEmail(email);
      steps.userResolved = { id: user.id, displayName: user.displayName, upn: user.userPrincipalName };
      // Step 3: Ensure app installed
      try {
        await graphService.ensureAppInstalled(user.id);
        steps.appInstalled = true;
      } catch (e: unknown) {
        steps.appInstalled = e instanceof GraphError ? { error: e.code, status: e.statusCode, body: e.responseBody } : String(e);
      }
      // Step 4: Get chat
      try {
        const chat = await graphService.createOrGetChat(user.id);
        steps.chatResolved = { chatId: chat.id };
      } catch (e: unknown) {
        steps.chatResolved = e instanceof GraphError ? { error: e.code, status: e.statusCode, body: e.responseBody } : String(e);
      }
      res.status(200).json({ success: true, steps });
    } catch (err: unknown) {
      if (err instanceof GraphError) {
        steps.error = { code: err.code, status: err.statusCode, body: err.responseBody };
      } else {
        steps.error = err instanceof Error ? err.message : String(err);
      }
      res.status(422).json({ success: false, steps });
    }
  });

  // ── DEBUG: Conversation References ──
  router.get("/debug/conversation-references", async (_req: Request, res: Response) => {
    const all = await convRefRepo.getAll();
    const summary = all.map((entry) => ({
      key: entry.key,
      scope: entry.scope,
      displayName: entry.displayName,
      aadObjectId: entry.aadObjectId,
      userId: entry.reference?.user?.id,
      conversationId: entry.reference?.conversation?.id,
      updatedAt: entry.updatedAt,
    }));
    logger.info(`[DEBUG] Listing ${summary.length} conversation references`);
    res.status(200).json({ count: summary.length, references: summary });
  });

  // ── DEBUG: User Mappings ──
  router.get("/debug/user-mappings", async (_req: Request, res: Response) => {
    const all = await userMappingRepo.getAll();
    const summary = all.map((m) => ({
      employeeId: m.employeeId,
      displayName: m.displayName,
      email: m.email,
      teamsUserId: m.teamsUserId || null,
      aadObjectId: m.aadObjectId || null,
      upn: m.upn || null,
      enabled: m.enabled,
    }));
    logger.info(`[DEBUG] Listing ${summary.length} user mappings`);
    res.status(200).json({ count: summary.length, mappings: summary });
  });

  return router;
}

function getGraphMissing(): string[] {
  const cfg = getConfig();
  const missing: string[] = [];
  if (!cfg.graphClientId) missing.push("GRAPH_CLIENT_ID");
  if (!cfg.graphClientSecret) missing.push("GRAPH_CLIENT_SECRET");
  if (!cfg.graphTenantId) missing.push("GRAPH_TENANT_ID");
  if (!cfg.botAppId) missing.push("BOT_APP_ID");
  return missing;
}

function summarizeGraphToken(token: string): Record<string, unknown> | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter((role): role is string => typeof role === "string")
    : [];

  return {
    appId: typeof payload.appid === "string" ? payload.appid : null,
    tenantId: typeof payload.tid === "string" ? payload.tid : null,
    audience: typeof payload.aud === "string" ? payload.aud : null,
    roles,
    hasRoles: roles.length > 0,
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getGraphPermissionHints(): Record<string, unknown> {
  return {
    userResolve: ["User.Read.All"],
    appInstallAndLookup: ["TeamsAppInstallation.ReadWriteForUser.All"],
    appOnlyMessageSend: ["Teamwork.Migrate.All"],
    notes: [
      "Chat.Create is not used by the current GraphService flow.",
      "ChatMessage.Send is delegated-only and does not satisfy app-only POST /chats/{chat-id}/messages.",
    ],
  };
}
