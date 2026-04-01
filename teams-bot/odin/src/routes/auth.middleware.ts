/**
 * Internal API authentication middleware.
 * Validates x-bot-internal-api-key header against BOT_INTERNAL_API_KEY.
 */

import type { Request, Response, NextFunction } from "express";
import { getConfig } from "../config/index";
import { logger } from "../utils/logger";

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-bot-internal-api-key"] as string | undefined;
  const expected = getConfig().botInternalApiKey;

  if (!apiKey || apiKey !== expected) {
    logger.warn(`API key rejected: path=${req.path} ip=${req.ip}`);
    res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
    return;
  }

  logger.info(`[INTERNAL API] Authorized request: ${req.path}`);
  next();
}
