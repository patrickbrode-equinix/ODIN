/**
 * ODIN Teams Bot — Bootstrap
 *
 * Wires all services, repositories, routes, and handlers,
 * then starts the bot on the configured port.
 */

import dotenv from "dotenv";
dotenv.config();

import { loadConfig, getConfig, logGraphConfig } from "./src/config/index";
import { logger } from "./src/utils/logger";
import { createApp } from "./app";

// Repositories
import {
  InMemoryConversationRefRepository,
  InMemoryUserMappingRepository,
  SEED_USER_MAPPINGS,
} from "./src/repositories/index";

// Services
import { ConversationRefService } from "./src/services/conversation-ref.service";
import { NotificationService } from "./src/services/notification.service";
import { CallbackService } from "./src/services/callback.service";
import { GraphService } from "./src/services/graph.service";

// Bot action handler
import { registerActionHandler } from "./src/bot/index";

// Internal HTTP routes
import { createInternalRoutes } from "./src/routes/index";

(async () => {
  // 1. Load and validate configuration
  try {
    loadConfig();
  } catch (err: unknown) {
    // Non-fatal: config may be incomplete in dev/playground mode
    logger.warn("Config load warning (continuing with defaults)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Create repositories
  const convRefRepo = new InMemoryConversationRefRepository();
  const userMappingRepo = new InMemoryUserMappingRepository(SEED_USER_MAPPINGS);

  // 2b. Log Graph configuration status
  logGraphConfig();
  const cfg = getConfig();
  if (!cfg.botAppId) {
    logger.warn("BOT_APP_ID could not be auto-resolved — please provide manually or via TEAMS_APP_ID");
  }

  // 3. Create services
  const convRefService = new ConversationRefService(convRefRepo);

  // 4. Create the bot app (with conversation reference capture wired into message handler)
  const app = createApp({ convRefService, userMappingRepo });

  // 5. Create services that depend on the app instance
  // Graph service (optional — only if credentials are configured)
  let graphService: GraphService | undefined;
  if (cfg.graphClientId && cfg.graphClientSecret && cfg.graphTenantId && cfg.botAppId) {
    graphService = new GraphService({
      clientId: cfg.graphClientId,
      clientSecret: cfg.graphClientSecret,
      tenantId: cfg.graphTenantId,
      botAppId: cfg.botAppId,
    });
    logger.info("Graph service initialized (proactive messaging via email enabled)");
  } else {
    logger.info("Graph service NOT configured — proactive messaging via email disabled. Set GRAPH_* or reuse CLIENT_ID/CLIENT_SECRET/TENANT_ID plus BOT_APP_ID/TEAMS_APP_ID to enable.");
  }

  const notificationService = new NotificationService(app, convRefRepo, userMappingRepo, graphService);
  const callbackService = new CallbackService();

  // 6. Register Adaptive Card action handler
  registerActionHandler(app, callbackService, userMappingRepo);

  // 7. Mount internal HTTP routes on the Express adapter
  const adapter = (app as unknown as { server: { adapter: { use: Function } } }).server?.adapter;
  if (adapter && typeof adapter.use === "function") {
    adapter.use("/api/internal", createInternalRoutes({
      notificationService,
      convRefRepo,
      userMappingRepo,
      graphService,
    }));
    logger.info("Internal API routes mounted on /api/internal/*");
  } else {
    logger.warn("Could not access Express adapter — internal API routes NOT mounted");
  }

  // 8. Start the bot
  const port = process.env.PORT || process.env.port || 3978;
  await app.start();
  logger.info(`ODIN Teams Bot started on port ${port}`);
  console.log(`\nBot started, app listening to`, port);
})();
