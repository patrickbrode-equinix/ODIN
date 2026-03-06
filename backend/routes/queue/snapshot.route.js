/* ------------------------------------------------ */
/* routes/queue/snapshot.route.js                   */
/* Thin HTTP handler for POST /api/queue/snapshot   */
/* All business logic delegated to queueIngest.service.js */
/* ------------------------------------------------ */

import express from "express";
import { config } from "../../config/index.js";
import { normalizePayload, persistSnapshot } from "../../services/queueIngest.service.js";

const router = express.Router();

/* ------------------------------------------------ */
/* INGEST KEY GUARD                                 */
/* ------------------------------------------------ */

function requireIngestKey(req, res) {
  const expected = config.QUEUE_INGEST_KEY ? String(config.QUEUE_INGEST_KEY).trim() : "";

  if (!expected) {
    if (config.isProd) {
      console.error("[SEC] QUEUE_INGEST_KEY not set in production — rejecting ingest");
      res.status(401).json({ ok: false, error: "Ingest key not configured on server" });
      return false;
    }
    if (process.env.ALLOW_INSECURE_INGEST !== "true") {
      console.warn("[SEC] No QUEUE_INGEST_KEY set. Add ALLOW_INSECURE_INGEST=true to permit keyless ingest in dev.");
      res.status(401).json({ ok: false, error: "Ingest key required. Set ALLOW_INSECURE_INGEST=true in dev to bypass." });
      return false;
    }
    console.warn("[SEC] ALLOW_INSECURE_INGEST=true — accepting keyless ingest (dev only)");
    return true;
  }

  const rawHeader = req.header("X-OES-INGEST-KEY");
  const got = String(rawHeader || "").trim();
  const missingHeader = rawHeader === undefined || rawHeader === null || String(rawHeader).trim() === "";
  if (!got || got !== expected) {
    console.warn(
      `[SEC] Ingest key rejected — ip=${req.ip} missingHeader=${missingHeader} receivedLen=${got.length} expectedLen=${expected.length}`
    );
    res.status(401).json({
      ok: false,
      error: "Unauthorized ingest",
      missingHeader,
      headerKeyLength: got.length,
      expectedKeySet: !!expected,
    });
    return false;
  }
  return true;
}

/* ------------------------------------------------ */
/* POST /snapshot                                   */
/* ------------------------------------------------ */

// Quick connectivity test — no auth needed, no DB access.
// Usage: POST /api/queue/snapshot with body { "ping": true }
router.post("/snapshot", async (req, res) => {
  const body = req.body || {};

  if (body.ping === true) {
    return res.json({ ok: true, pong: true, ts: new Date().toISOString() });
  }

  if (!requireIngestKey(req, res)) return;

  const nowIso = String(body.jarvisSeenAt || body.generatedAt || new Date().toISOString());
  const keys   = Object.keys(body);

  console.log(`\n[CRAWLER INGEST] Received payload. Keys: ${JSON.stringify(keys)} ContentType: ${req.headers["content-type"] || "(none)"}`);

  // Validate: body.queues must be present (object or array)
  if (!body.queues || typeof body.queues !== "object") {
    console.warn(`[CRAWLER INGEST] 400: 'queues' key missing or not an object. gotKeys=${JSON.stringify(keys)}`);
    return res.status(400).json({
      ok: false,
      error: "invalid_payload",
      gotKeys: keys,
      expected: "body.queues must be an object {smartHands,troubleTickets,ccInstalls} or an array of {queueType,items}",
    });
  }

  try {
    const { itemsToUpsert, completeTypes } = normalizePayload(body);
    const result = await persistSnapshot(itemsToUpsert, completeTypes, nowIso);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("QUEUE SNAPSHOT ERROR:", err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

export default router;
