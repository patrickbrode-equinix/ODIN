/**
 * Centralized configuration for the ODIN Teams Bot.
 * All runtime settings live here — loaded from environment variables.
 */

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function boolEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw === "true" || raw === "1";
}

export interface BotConfig {
  /** HTTP port the bot listens on */
  port: number;
  /** Runtime environment */
  nodeEnv: string;

  /** Microsoft App ID (from Azure Bot registration) */
  microsoftAppId: string;
  /** Microsoft App Password / Client Secret */
  microsoftAppPassword: string;
  /** Azure AD Tenant ID */
  tenantId: string;
  /** Bot type (e.g. MultiTenant, SingleTenant, UserAssignedMsi) */
  botType: string;

  /** Shared secret for internal API endpoints (ODIN → Bot) */
  botInternalApiKey: string;
  /** Base URL of the ODIN backend for callbacks */
  odinCallbackBaseUrl: string;
  /** Shared secret added to callbacks (Bot → ODIN) */
  odinSharedSecret: string;

  /** Feature flags */
  enableSupervisorApproval: boolean;
  enableGroupNotifications: boolean;
  enableDirectNotifications: boolean;

  /** Logging level */
  logLevel: "debug" | "info" | "warn" | "error";

  /** Microsoft Graph — Client Credentials for proactive messaging */
  graphClientId: string;
  graphClientSecret: string;
  graphTenantId: string;
  /** Teams App ID in the tenant app catalog (for app installation) */
  botAppId: string;
}

let _config: BotConfig | null = null;

export function loadConfig(): BotConfig {
  if (_config) return _config;

  _config = {
    port: parseInt(optionalEnv("PORT", "3978"), 10),
    nodeEnv: optionalEnv("NODE_ENV", "development"),

    microsoftAppId: optionalEnv("CLIENT_ID", ""),
    microsoftAppPassword: optionalEnv("CLIENT_PASSWORD", ""),
    tenantId: optionalEnv("TENANT_ID", ""),
    botType: optionalEnv("BOT_TYPE", "MultiTenant"),

    botInternalApiKey: requireEnv("BOT_INTERNAL_API_KEY", "dev-api-key-change-me"),
    odinCallbackBaseUrl: optionalEnv("ODIN_CALLBACK_BASE_URL", "http://localhost:5055"),
    odinSharedSecret: requireEnv("ODIN_SHARED_SECRET", "dev-shared-secret-change-me"),

    enableSupervisorApproval: boolEnv("ENABLE_SUPERVISOR_APPROVAL", false),
    enableGroupNotifications: boolEnv("ENABLE_GROUP_NOTIFICATIONS", true),
    enableDirectNotifications: boolEnv("ENABLE_DIRECT_NOTIFICATIONS", true),

    logLevel: optionalEnv("LOG_LEVEL", "info") as BotConfig["logLevel"],

    graphClientId: optionalEnv("GRAPH_CLIENT_ID", ""),
    graphClientSecret: optionalEnv("GRAPH_CLIENT_SECRET", ""),
    graphTenantId: optionalEnv("GRAPH_TENANT_ID", ""),
    botAppId: optionalEnv("BOT_APP_ID", ""),
  };

  // Auto-resolve BOT_APP_ID from TEAMS_APP_ID (set by Teams Toolkit)
  if (!_config.botAppId && process.env.TEAMS_APP_ID) {
    _config.botAppId = process.env.TEAMS_APP_ID;
  }

  return _config;
}

export function getConfig(): BotConfig {
  if (!_config) return loadConfig();
  return _config;
}

/** Whether all Graph credentials are present */
export function isGraphEnabled(): boolean {
  const cfg = getConfig();
  return !!(cfg.graphClientId && cfg.graphClientSecret && cfg.graphTenantId && cfg.botAppId);
}

/** Log Graph config status at startup — NEVER logs secrets */
export function logGraphConfig(): void {
  const cfg = getConfig();
  const enabled = isGraphEnabled();

  if (enabled) {
    console.log(
      `[GRAPH CONFIG] enabled=true clientId=${cfg.graphClientId} tenantId=${cfg.graphTenantId} hasSecret=true botAppId=${cfg.botAppId}`
    );
  } else {
    const missing: string[] = [];
    if (!cfg.graphClientId) missing.push("GRAPH_CLIENT_ID");
    if (!cfg.graphClientSecret) missing.push("GRAPH_CLIENT_SECRET");
    if (!cfg.graphTenantId) missing.push("GRAPH_TENANT_ID");
    if (!cfg.botAppId) missing.push("BOT_APP_ID");
    console.log(`[GRAPH CONFIG] enabled=false missing=${missing.join(", ")}`);
  }
}
