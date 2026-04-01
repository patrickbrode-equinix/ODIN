/**
 * Callback Service — sends action results back to ODIN.
 *
 * When a user clicks a button on an Adaptive Card, the bot processes the action
 * and forwards a structured callback to ODIN's backend API.
 */

import { getConfig } from "../config/index";
import { logger } from "../utils/logger";
import type {
  TicketActionCallback,
  ShiftActionCallback,
  SupervisorActionCallback,
} from "../models/index";

type CallbackPayload = TicketActionCallback | ShiftActionCallback | SupervisorActionCallback;

export class CallbackService {
  private baseUrl: string;
  private secret: string;
  private timeoutMs = 10_000;

  constructor() {
    const cfg = getConfig();
    this.baseUrl = cfg.odinCallbackBaseUrl.replace(/\/+$/, "");
    this.secret = cfg.odinSharedSecret;
  }

  /**
   * Forward a ticket action (accept / reject / question) to ODIN.
   */
  async sendTicketAction(payload: TicketActionCallback): Promise<boolean> {
    return this.post("/api/teams/callback/ticket-action", payload);
  }

  /**
   * Forward a shift action (accept / reject) to ODIN.
   */
  async sendShiftAction(payload: ShiftActionCallback): Promise<boolean> {
    return this.post("/api/teams/callback/shift-action", payload);
  }

  /**
   * Forward a supervisor action (approve / reject) to ODIN.
   */
  async sendSupervisorAction(payload: SupervisorActionCallback): Promise<boolean> {
    return this.post("/api/teams/callback/supervisor-action", payload);
  }

  /** Generic POST to ODIN with shared secret and timeout */
  private async post(path: string, body: CallbackPayload): Promise<boolean> {
    const url = `${this.baseUrl}${path}`;
    logger.info(`Callback → ODIN: ${path}`, { action: body.action });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ODIN-Bot-Secret": this.secret,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        logger.error(`Callback to ODIN failed: ${response.status} ${response.statusText}`, { url, responseBody: text.substring(0, 500) });
        return false;
      }

      logger.info(`Callback to ODIN succeeded: ${path}`);
      return true;
    } catch (err: unknown) {
      clearTimeout(timeout);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("abort")) {
        logger.error(`Callback to ODIN timed out after ${this.timeoutMs}ms: ${path}`);
      } else {
        logger.error(`Callback to ODIN error: ${path}`, { error: msg });
      }
      return false;
    }
  }
}
