/**
 * Bot Action Handler — processes Adaptive Card Action.Execute responses.
 *
 * When a user clicks a button on an Adaptive Card, Teams sends an invoke activity
 * of type "adaptiveCard/action". The SDK routes this to the "card.action" event.
 *
 * This handler:
 *  1. Parses the action payload (verb + data)
 *  2. Resolves user identity via the user-mapping repository
 *  3. Routes the action to the CallbackService → ODIN backend
 *  4. Returns a confirmation message to the user
 */

import type { App } from "@microsoft/teams.apps";
import type { HttpError } from "@microsoft/teams.api";
import type { IUserMappingRepository } from "../repositories/index";
import { CallbackService } from "../services/callback.service";
import { ACTION_TYPES } from "../models/index";
import type {
  CardActionPayload,
  TicketActionCallback,
  ShiftActionCallback,
  SupervisorActionCallback,
  VerificationActionCallback,
} from "../models/index";
import { buildVerificationFollowUpCard, buildVerificationConfirmationCard } from "../cards/verification.card";
import { logger } from "../utils/logger";

// ── Human-readable labels for confirmation messages ──

const ACTION_LABELS: Record<string, string> = {
  [ACTION_TYPES.TICKET_ACCEPT]: "Ticket übernommen",
  [ACTION_TYPES.TICKET_REJECT]: "Ticket abgelehnt",
  [ACTION_TYPES.TICKET_QUESTION]: "Rückfrage gesendet",
  [ACTION_TYPES.SHIFT_ACCEPT]: "Schicht übernommen",
  [ACTION_TYPES.SHIFT_REJECT]: "Schicht abgelehnt",
  [ACTION_TYPES.SUPERVISOR_APPROVE]: "Freigabe erteilt",
  [ACTION_TYPES.SUPERVISOR_REJECT]: "Freigabe abgelehnt",
  [ACTION_TYPES.VERIFICATION_YES]: "Verfügbarkeit bestätigt",
  [ACTION_TYPES.VERIFICATION_NO]: "Nicht verfügbar",
  [ACTION_TYPES.VERIFICATION_SICK]: "Krankmeldung",
  [ACTION_TYPES.VERIFICATION_WRONG_SHIFT]: "Andere Schicht",
};

// ── Register the handler on the App ──

export function registerActionHandler(
  app: App,
  callbackService: CallbackService,
  userMappingRepo: IUserMappingRepository
): void {
  app.on("card.action", async (context) => {
    const invokeValue = context.activity.value;
    const action = invokeValue?.action;

    if (!action || action.type !== "Action.Execute") {
      logger.warn("card.action: received non-Execute action type", { type: action?.type });
      return {
        statusCode: 400 as const,
        type: "application/vnd.microsoft.error" as const,
        value: {
          code: "BadRequest",
          message: "Only Action.Execute is supported",
          innerHttpError: { statusCode: 400, body: null },
        } satisfies HttpError,
      };
    }

    const data = action.data as CardActionPayload | undefined;
    if (!data?.action || !data?.entityId) {
      logger.warn("card.action: missing action or entityId in payload", { data });
      return {
        statusCode: 400 as const,
        type: "application/vnd.microsoft.error" as const,
        value: {
          code: "BadRequest",
          message: "Missing action or entityId in card data",
          innerHttpError: { statusCode: 400, body: null },
        } satisfies HttpError,
      };
    }

    const from = context.activity.from;
    const teamsUserId = from?.id || "unknown";
    const aadObjectId = from?.aadObjectId;
    const displayName = from?.name || "Unknown User";
    const timestamp = new Date().toISOString();

    logger.info(`card.action: ${data.action} on ${data.entityId} by ${displayName}`, {
      verb: action.verb,
      teamsUserId,
      aadObjectId,
    });

    // Resolve ODIN employee ID from AAD identity
    let employeeId: string | undefined;
    if (aadObjectId) {
      const mapping = await userMappingRepo.getByAadObjectId(aadObjectId);
      employeeId = mapping?.employeeId;
    }

    // Route to ODIN via callback service
    let callbackOk = false;
    try {
      callbackOk = await routeAction(callbackService, data, {
        teamsUserId,
        aadObjectId,
        displayName,
        employeeId,
        timestamp,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`card.action: callback failed for ${data.action}`, { error: msg });
    }

    // ── Special handling for verification "Nein": send follow-up card ──
    if (data.action === ACTION_TYPES.VERIFICATION_NO) {
      const vCtx = data.context as Record<string, string> | undefined;
      const followUpCard = buildVerificationFollowUpCard({
        employeeName: vCtx?.employeeName || displayName,
        shiftCode: vCtx?.shiftCode || "",
        date: vCtx?.date || new Date().toISOString().slice(0, 10),
      });
      return {
        statusCode: 200 as const,
        type: "application/vnd.microsoft.card.adaptive" as const,
        value: followUpCard as any,
      };
    }

    // ── Verification confirmation cards for yes/sick/wrong_shift ──
    if (
      data.action === ACTION_TYPES.VERIFICATION_YES ||
      data.action === ACTION_TYPES.VERIFICATION_SICK ||
      data.action === ACTION_TYPES.VERIFICATION_WRONG_SHIFT
    ) {
      const vCtx = data.context as Record<string, string> | undefined;
      const statusMap: Record<string, string> = {
        [ACTION_TYPES.VERIFICATION_YES]: "verified",
        [ACTION_TYPES.VERIFICATION_SICK]: "sick",
        [ACTION_TYPES.VERIFICATION_WRONG_SHIFT]: "wrong_shift",
      };
      const confirmCard = buildVerificationConfirmationCard(
        {
          employeeName: vCtx?.employeeName || displayName,
          shiftCode: vCtx?.shiftCode || "",
          date: vCtx?.date || new Date().toISOString().slice(0, 10),
        },
        statusMap[data.action] || "verified"
      );
      return {
        statusCode: 200 as const,
        type: "application/vnd.microsoft.card.adaptive" as const,
        value: confirmCard as any,
      };
    }

    // Build confirmation response (for non-verification actions)
    const label = ACTION_LABELS[data.action] || data.action;
    const statusText = callbackOk
      ? `✅ ${label} — wurde an ODIN übermittelt.`
      : `⚠️ ${label} — Aktion registriert, aber Übermittlung an ODIN steht aus.`;

    return {
      statusCode: 200 as const,
      type: "application/vnd.microsoft.activity.message" as const,
      value: statusText,
    };
  });

  logger.info("Action handler registered for card.action events");
}

// ── Route action to the correct callback method ──

interface UserContext {
  teamsUserId: string;
  aadObjectId?: string;
  displayName: string;
  employeeId?: string;
  timestamp: string;
}

async function routeAction(
  callbackService: CallbackService,
  data: CardActionPayload,
  user: UserContext
): Promise<boolean> {
  const { action, entityId, context: ctx } = data;

  switch (action) {
    case ACTION_TYPES.TICKET_ACCEPT:
    case ACTION_TYPES.TICKET_REJECT:
    case ACTION_TYPES.TICKET_QUESTION: {
      const payload: TicketActionCallback = {
        action,
        ticketId: entityId,
        employeeId: user.employeeId,
        teamsUserId: user.teamsUserId,
        aadObjectId: user.aadObjectId,
        displayName: user.displayName,
        timestamp: user.timestamp,
        context: ctx,
      };
      return callbackService.sendTicketAction(payload);
    }

    case ACTION_TYPES.SHIFT_ACCEPT:
    case ACTION_TYPES.SHIFT_REJECT: {
      const payload: ShiftActionCallback = {
        action,
        shiftId: entityId,
        employeeId: user.employeeId,
        teamsUserId: user.teamsUserId,
        aadObjectId: user.aadObjectId,
        displayName: user.displayName,
        timestamp: user.timestamp,
        context: ctx,
      };
      return callbackService.sendShiftAction(payload);
    }

    case ACTION_TYPES.SUPERVISOR_APPROVE:
    case ACTION_TYPES.SUPERVISOR_REJECT: {
      const payload: SupervisorActionCallback = {
        action,
        entityId,
        supervisorTeamsUserId: user.teamsUserId,
        supervisorAadObjectId: user.aadObjectId,
        supervisorDisplayName: user.displayName,
        timestamp: user.timestamp,
        context: ctx,
      };
      return callbackService.sendSupervisorAction(payload);
    }

    // ── Verification: "Ja" → send callback directly ──
    case ACTION_TYPES.VERIFICATION_YES: {
      const vCtx = ctx as Record<string, string> | undefined;
      const payload: VerificationActionCallback = {
        action,
        employeeName: vCtx?.employeeName || user.displayName,
        date: vCtx?.date || new Date().toISOString().slice(0, 10),
        shiftCode: vCtx?.shiftCode || "",
        response: "yes",
        teamsUserId: user.teamsUserId,
        aadObjectId: user.aadObjectId,
        displayName: user.displayName,
        timestamp: user.timestamp,
      };
      return callbackService.sendVerificationAction(payload);
    }

    // ── Verification: "Nein" → NOT sent to ODIN yet; handled in the action handler above ──
    case ACTION_TYPES.VERIFICATION_NO: {
      // Follow-up card is sent inline by the action handler (see registerActionHandler)
      // This routeAction is a no-op for VERIFICATION_NO
      return true;
    }

    // ── Verification: "Krank" or "Andere Schicht" → send callback ──
    case ACTION_TYPES.VERIFICATION_SICK:
    case ACTION_TYPES.VERIFICATION_WRONG_SHIFT: {
      const vCtx2 = ctx as Record<string, string> | undefined;
      const responseMap: Record<string, string> = {
        [ACTION_TYPES.VERIFICATION_SICK]: "sick",
        [ACTION_TYPES.VERIFICATION_WRONG_SHIFT]: "wrong_shift",
      };
      const payload: VerificationActionCallback = {
        action,
        employeeName: vCtx2?.employeeName || user.displayName,
        date: vCtx2?.date || new Date().toISOString().slice(0, 10),
        shiftCode: vCtx2?.shiftCode || "",
        response: responseMap[action] || action,
        teamsUserId: user.teamsUserId,
        aadObjectId: user.aadObjectId,
        displayName: user.displayName,
        timestamp: user.timestamp,
      };
      return callbackService.sendVerificationAction(payload);
    }

    default:
      logger.warn(`card.action: unknown action type "${action}"`);
      return false;
  }
}
