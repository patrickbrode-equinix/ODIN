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

  const got = String(req.header("X-OES-INGEST-KEY") || "").trim();
  if (!got || got !== expected) {
    console.warn(`[SEC] Invalid ingest key from ${req.ip}`);
    res.status(401).json({ ok: false, error: "Unauthorized ingest" });
    return false;
  }
  return true;
}

/* ------------------------------------------------ */
/* POST /snapshot                                   */
/* ------------------------------------------------ */

router.post("/snapshot", async (req, res) => {
  if (!requireIngestKey(req, res)) return;

  const body  = req.body || {};
  const nowIso = String(body.jarvisSeenAt || new Date().toISOString());

  console.log(`\n[CRAWLER INGEST] Received payload. Keys:`, Object.keys(body));

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
