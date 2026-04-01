/**
 * Microsoft Graph Service — proactive messaging via Client Credentials.
 *
 * Handles: user lookup, app installation, 1:1 chat creation, message sending.
 * Uses native fetch (Node 18+), no additional dependencies.
 */

import { logger } from "../utils/logger";

// ── Types ──

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
}

export interface GraphChat {
  id: string;
  chatType: string;
}

export interface GraphMessageAttachment {
  id: string;
  contentType: string;
  content: string;
  contentUrl?: string | null;
  name?: string | null;
  thumbnailUrl?: string | null;
}

export interface GraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  botAppId: string;
}

// ── Service ──

export class GraphService {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private cfg: GraphConfig) {}

  // ── A. User per UPN / E-Mail holen ──

  async getUserByEmail(email: string): Promise<GraphUser> {
    logger.info(`[GRAPH] Resolving user by email: ${email}`);
    const token = await this.getToken();

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=id,displayName,mail,userPrincipalName`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 404) {
        throw new GraphError(`User not found: ${email}`, "USER_NOT_FOUND", res.status, body);
      }
      throw new GraphError(`Failed to resolve user: ${email}`, "USER_RESOLVE_FAILED", res.status, body);
    }

    const user = (await res.json()) as GraphUser;
    logger.info(`[GRAPH] User resolved: ${user.displayName} (${user.id})`);
    return user;
  }

  // ── B. App Installation sicherstellen ──

  async ensureAppInstalled(userId: string): Promise<void> {
    logger.info(`[GRAPH] Ensuring app installed for user ${userId}`);
    const token = await this.getToken();

    // Check if already installed
    const listRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/teamwork/installedApps?$expand=teamsAppDefinition&$filter=teamsAppDefinition/teamsAppId eq '${this.cfg.botAppId}'`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (listRes.ok) {
      const data = (await listRes.json()) as { value: unknown[] };
      if (data.value && data.value.length > 0) {
        logger.info(`[GRAPH] App already installed for user ${userId}`);
        return;
      }
    }

    // Install the app
    const installRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/teamwork/installedApps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          "teamsApp@odata.bind": `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/${this.cfg.botAppId}`,
        }),
      }
    );

    if (!installRes.ok) {
      const body = await installRes.text();
      // 409 Conflict = already installed (race condition)
      if (installRes.status === 409) {
        logger.info(`[GRAPH] App already installed (409) for user ${userId}`);
        return;
      }
      throw new GraphError(`App installation failed for user ${userId}`, "APP_INSTALL_FAILED", installRes.status, body);
    }

    logger.info(`[GRAPH] App installed for user ${userId}`);
  }

  // ── C. 1:1 Chat über App-Installation abrufen ──

  async createOrGetChat(userId: string): Promise<GraphChat> {
    logger.info(`[GRAPH] Getting 1:1 chat for user ${userId} via app installation`);
    const token = await this.getToken();

    // 1. Find the bot's app installation for this user
    const listRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/teamwork/installedApps?$expand=teamsAppDefinition&$filter=teamsAppDefinition/teamsAppId eq '${this.cfg.botAppId}'`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listRes.ok) {
      const body = await listRes.text();
      throw new GraphError(`Failed to list app installations for user ${userId}`, "APP_LIST_FAILED", listRes.status, body);
    }

    const listData = (await listRes.json()) as { value: Array<{ id: string }> };
    if (!listData.value || listData.value.length === 0) {
      throw new GraphError(
        `Bot app not found in installed apps for user ${userId}. Ensure ensureAppInstalled() was called first.`,
        "APP_NOT_INSTALLED",
        404,
        "No installation found"
      );
    }

    const installationId = listData.value[0].id;

    // 2. Get the chat associated with this app installation
    const chatRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/teamwork/installedApps/${installationId}/chat`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!chatRes.ok) {
      const body = await chatRes.text();
      throw new GraphError(`Failed to get chat for user ${userId} via installation ${installationId}`, "CHAT_GET_FAILED", chatRes.status, body);
    }

    const chat = (await chatRes.json()) as GraphChat;
    logger.info(`[GRAPH] Chat retrieved via installation: ${chat.id}`);
    return chat;
  }

  // ── D. Nachricht senden (mit optionalen Attachments für Adaptive Cards) ──

  async sendMessage(chatId: string, content: string, attachments?: GraphMessageAttachment[]): Promise<void> {
    logger.info(`[GRAPH] Sending message to chat ${chatId}`);
    const token = await this.getToken();

    const messageBody: Record<string, unknown> = {
      body: {
        contentType: "html",
        content,
      },
    };

    if (attachments && attachments.length > 0) {
      messageBody.attachments = attachments;
    }

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/chats/${chatId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageBody),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new GraphError(`Message send failed to chat ${chatId}`, "MESSAGE_SEND_FAILED", res.status, body);
    }

    logger.info(`[GRAPH] Message sent to chat ${chatId}`);
  }

  // ── Token Handling (Client Credentials) ──

  private async getToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 300_000) {
      return this.tokenCache.token;
    }

    const url = `https://login.microsoftonline.com/${this.cfg.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new GraphError("Token acquisition failed", "TOKEN_FAILED", res.status, body);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    logger.info("[GRAPH] Access token acquired");
    return this.tokenCache.token;
  }
}

// ── Error Class ──

export class GraphError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly responseBody: string
  ) {
    super(message);
    this.name = "GraphError";
  }
}
