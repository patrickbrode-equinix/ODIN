import { stripMentionsText, TokenCredentials } from "@microsoft/teams.api";
import { App } from "@microsoft/teams.apps";
import { LocalStorage } from "@microsoft/teams.common";
import { ManagedIdentityCredential } from "@azure/identity";
import type { ConversationRefService } from "./src/services/conversation-ref.service";
import type { IUserMappingRepository } from "./src/repositories/index";
import { getConfig } from "./src/config/index";
import { logger } from "./src/utils/logger";

// ── Credentials ──

const createTokenFactory = (clientId: string) => {
  return async (scope: string | string[], tenantId?: string): Promise<string> => {
    const managedIdentityCredential = new ManagedIdentityCredential({
      clientId,
    });
    const scopes = Array.isArray(scope) ? scope : [scope];
    const tokenResponse = await managedIdentityCredential.getToken(scopes, {
      tenantId: tenantId,
    });

    return tokenResponse.token;
  };
};

function createCredentialOptions(): TokenCredentials | undefined {
  const cfg = getConfig();

  if (cfg.botType !== "UserAssignedMsi") {
    return undefined;
  }

  if (!cfg.microsoftAppId) {
    logger.warn("UserAssignedMsi bot type configured without CLIENT_ID/BOT_ID");
    return undefined;
  }

  return {
    clientId: cfg.microsoftAppId,
    token: createTokenFactory(cfg.microsoftAppId),
  };
}

// ── App factory ──

export interface AppDeps {
  convRefService?: ConversationRefService;
  userMappingRepo?: IUserMappingRepository;
}

export function createApp(deps: AppDeps = {}): App {
  const storage = new LocalStorage();
  const credentialOptions = createCredentialOptions();

  const app = new App({
    ...(credentialOptions || {}),
    storage,
  });

  // Interface for conversation state
  interface ConversationState {
    count: number;
  }

  const getConversationState = (conversationId: string): ConversationState => {
    let state = storage.get(conversationId);
    if (!state) {
      state = { count: 0 };
      storage.set(conversationId, state);
    }
    return state;
  };

  app.on("message", async (context) => {
    const activity = context.activity;

    // ── [DEBUG] Log incoming user details for local testing ──
    logger.info("[DEBUG:INCOMING] Message received", {
      activityType: activity.type,
      conversationId: activity.conversation?.id,
      conversationType: activity.conversation?.conversationType,
      isGroup: activity.conversation?.isGroup,
      fromId: activity.from?.id,
      fromName: activity.from?.name,
      fromAadObjectId: activity.from?.aadObjectId,
      tenantId: (activity as unknown as Record<string, unknown>).channelData
        ? ((activity as unknown as Record<string, unknown>).channelData as Record<string, unknown>)?.tenant
        : undefined,
      channelId: activity.channelId,
    });

    // Capture conversation reference for proactive messaging
    if (deps.convRefService && context.ref) {
      try {
        await deps.convRefService.capture(context.ref);
      } catch (err: unknown) {
        logger.warn("Failed to capture conversation reference", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── [DEBUG] Auto-link: map first personal interaction to DEBUG_FALLBACK_EMPLOYEE_ID ──
    const fallbackEmpId = process.env.DEBUG_FALLBACK_EMPLOYEE_ID;
    if (
      fallbackEmpId &&
      deps.userMappingRepo &&
      activity.from?.aadObjectId &&
      !activity.conversation?.isGroup &&
      !(activity.conversation?.id || "").includes("@thread")
    ) {
      try {
        const existing = await deps.userMappingRepo.getByEmployeeId(fallbackEmpId);
        if (existing && !existing.aadObjectId) {
          await deps.userMappingRepo.updateTeamsIdentity(fallbackEmpId, {
            aadObjectId: activity.from.aadObjectId,
            teamsUserId: activity.from.id,
          });
          logger.info(`[DEBUG:AUTOLINK] Linked ${fallbackEmpId} → aadObjectId=${activity.from.aadObjectId} name=${activity.from.name}`);
        }
      } catch (err: unknown) {
        logger.warn("[DEBUG:AUTOLINK] Failed", { error: err instanceof Error ? err.message : String(err) });
      }
    }

    const text: string = stripMentionsText(activity);

    if (text === "/reset") {
      storage.delete(activity.conversation.id);
      await context.send("Ok I've deleted the current conversation state.");
      return;
    }

    if (text === "/count") {
      const state = getConversationState(activity.conversation.id);
      await context.send(`The count is ${state.count}`);
      return;
    }

    if (text === "/diag") {
      await context.send(JSON.stringify(activity));
      return;
    }

    if (text === "/state") {
      const state = getConversationState(activity.conversation.id);
      await context.send(JSON.stringify(state));
      return;
    }

    if (text === "/runtime") {
      const runtime = {
        nodeversion: process.version,
        sdkversion: "2.0.0", // Microsoft Teams SDK
      };
      await context.send(JSON.stringify(runtime));
      return;
    }

    // Default echo behavior
    const state = getConversationState(activity.conversation.id);
    state.count++;
    await context.send(`[${state.count}] you said: ${text}`);
  });

  return app;
}

// Default export for backward compatibility (no ODIN services wired)
const app = createApp();
export default app;
