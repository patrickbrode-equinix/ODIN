/**
 * Structured logger for the ODIN Teams Bot.
 * Wraps console with level filtering and consistent formatting.
 */

import { getConfig } from "../config/index";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LEVELS;

function shouldLog(level: LogLevel): boolean {
  const configured = getConfig().logLevel;
  return LEVELS[level] >= LEVELS[configured];
}

function ts(): string {
  return new Date().toISOString();
}

/** Sanitize objects before logging — strip sensitive fields */
function sanitize(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const o = obj as Record<string, unknown>;
  const redacted = { ...o };
  const sensitive = ["password", "secret", "token", "apiKey", "api_key", "authorization"];
  for (const key of Object.keys(redacted)) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      redacted[key] = "[REDACTED]";
    }
  }
  return redacted;
}

export const logger = {
  debug(msg: string, data?: unknown) {
    if (shouldLog("debug")) console.debug(`[${ts()}] DEBUG ${msg}`, data !== undefined ? sanitize(data) : "");
  },
  info(msg: string, data?: unknown) {
    if (shouldLog("info")) console.log(`[${ts()}] INFO  ${msg}`, data !== undefined ? sanitize(data) : "");
  },
  warn(msg: string, data?: unknown) {
    if (shouldLog("warn")) console.warn(`[${ts()}] WARN  ${msg}`, data !== undefined ? sanitize(data) : "");
  },
  error(msg: string, data?: unknown) {
    if (shouldLog("error")) console.error(`[${ts()}] ERROR ${msg}`, data !== undefined ? sanitize(data) : "");
  },
};
