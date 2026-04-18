/* ------------------------------------------------ */
/* MARKET DATA ROUTES                               */
/* ------------------------------------------------ */

import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

const CACHE_TTL_MS = 5 * 60 * 1000;
const QUOTE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/EQIX?interval=1d&range=5d&includePrePost=false";

let cachedEqixQuote = null;

function parseEqixQuote(payload) {
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta || {};
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = Array.isArray(quote?.close)
    ? quote.close.filter((value) => Number.isFinite(value))
    : [];

  const price = Number.isFinite(meta?.regularMarketPrice)
    ? Number(meta.regularMarketPrice)
    : closes.length > 0
      ? Number(closes[closes.length - 1])
      : null;

  const previousClose = Number.isFinite(meta?.previousClose)
    ? Number(meta.previousClose)
    : closes.length > 1
      ? Number(closes[closes.length - 2])
      : null;

  if (!Number.isFinite(price)) {
    throw new Error("Quote price unavailable");
  }

  const change = Number.isFinite(previousClose) ? Number(price) - Number(previousClose) : null;
  const changePercent = Number.isFinite(previousClose) && previousClose !== 0
    ? (Number(price) - Number(previousClose)) / Number(previousClose) * 100
    : null;

  return {
    symbol: "EQIX",
    available: true,
    currency: typeof meta?.currency === "string" ? meta.currency : "USD",
    marketState: typeof meta?.marketState === "string" ? meta.marketState : null,
    price: Number(price),
    change: Number.isFinite(change) ? Number(change) : null,
    changePercent: Number.isFinite(changePercent) ? Number(changePercent) : null,
    asOf: Number.isFinite(meta?.regularMarketTime)
      ? new Date(Number(meta.regularMarketTime) * 1000).toISOString()
      : new Date().toISOString(),
    source: "yahoo-finance",
  };
}

async function fetchEqixQuote() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(QUOTE_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ODIN/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Quote request failed with status ${response.status}`);
    }

    return parseEqixQuote(await response.json());
  } finally {
    clearTimeout(timeoutId);
  }
}

router.get("/eqix", requireAuth, async (_req, res) => {
  if (cachedEqixQuote && Date.now() - cachedEqixQuote.fetchedAt < CACHE_TTL_MS) {
    return res.json({
      ...cachedEqixQuote.data,
      cached: true,
      stale: false,
    });
  }

  try {
    const data = await fetchEqixQuote();
    cachedEqixQuote = {
      data,
      fetchedAt: Date.now(),
    };

    return res.json({
      ...data,
      cached: false,
      stale: false,
    });
  } catch (error) {
    console.warn("[market] EQIX quote unavailable", error);

    if (cachedEqixQuote) {
      return res.json({
        ...cachedEqixQuote.data,
        cached: true,
        stale: true,
      });
    }

    return res.json({
      symbol: "EQIX",
      available: false,
      currency: "USD",
      marketState: null,
      price: null,
      change: null,
      changePercent: null,
      asOf: null,
      source: "yahoo-finance",
      cached: false,
      stale: false,
    });
  }
});

export default router;