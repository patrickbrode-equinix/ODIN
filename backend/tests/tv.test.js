/**
 * backend/tests/tv.test.js
 *
 * Integration tests for public TV endpoints: /api/tv/*
 * No database connection required — query function is injected as a mock.
 * No auth token required — endpoints must be publicly accessible.
 *
 * Run with: node --test tests/tv.test.js
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";

/* ------------------------------------------------------------------ */
/* Inline TV router factory (mirrors routes/tv.js without DB import)   */
/* ------------------------------------------------------------------ */
function createTvRouter(mockQuery) {
  const router = express.Router();

  // No TV_KEY in tests
  router.get("/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  router.get("/tickets", async (req, res) => {
    try {
      const { queueType, limit } = req.query;
      let sql = `SELECT * FROM queue_items WHERE active = TRUE`;
      const params = [];

      if (queueType) {
        params.push(queueType);
        sql += ` AND queue_type = $${params.length}`;
      }
      sql += ` ORDER BY group_key ASC, id ASC`;
      if (limit) {
        const lim = parseInt(limit, 10);
        if (!isNaN(lim) && lim > 0 && lim <= 500) {
          params.push(lim);
          sql += ` LIMIT $${params.length}`;
        }
      }

      const result = await mockQuery(sql, params);
      res.json(result.rows);
    } catch (err) {
      res.json([]); // never 500 for TV
    }
  });

  router.get("/info-entries", async (_req, res) => {
    try {
      const result = await mockQuery(
        `SELECT * FROM dashboard_info_entries WHERE delete_at IS NULL OR delete_at > NOW() ORDER BY created_at DESC`
      );
      res.json({ data: result.rows });
    } catch (err) {
      res.json({ data: [] });
    }
  });

  return router;
}

/* ------------------------------------------------------------------ */
/* Test harness                                                        */
/* ------------------------------------------------------------------ */

describe("GET /api/tv/* — public kiosk endpoints", () => {
  let server;
  let baseUrl;
  let mockQuery;

  before(async () => {
    // Default mock: returns empty rows
    mockQuery = async () => ({ rows: [] });

    const app = express();
    app.use("/api/tv", createTvRouter((...args) => mockQuery(...args)));

    await new Promise((resolve) => {
      server = createServer(app);
      server.listen(0, "127.0.0.1", resolve);
    });

    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  /* ---------------------------------------------------------------- */
  /* /api/tv/health                                                    */
  /* ---------------------------------------------------------------- */
  test("GET /api/tv/health → 200 + { status: ok }", async () => {
    const res = await fetch(`${baseUrl}/api/tv/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, "ok");
    assert.ok(typeof body.ts === "string", "ts should be a string timestamp");
  });

  test("GET /api/tv/health requires NO auth token", async () => {
    // Explicitly no Authorization header
    const res = await fetch(`${baseUrl}/api/tv/health`, {
      headers: {},
    });
    assert.strictEqual(res.status, 200);
  });

  /* ---------------------------------------------------------------- */
  /* /api/tv/tickets                                                   */
  /* ---------------------------------------------------------------- */
  test("GET /api/tv/tickets → 200 + array (empty DB)", async () => {
    mockQuery = async () => ({ rows: [] });
    const res = await fetch(`${baseUrl}/api/tv/tickets`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body), "response should be an array");
    assert.strictEqual(body.length, 0);
  });

  test("GET /api/tv/tickets → 200 + array with rows", async () => {
    const fakeTickets = [
      { id: 1, group_key: "Alpha", queue_type: "SmartHands", active: true },
      { id: 2, group_key: "Beta",  queue_type: "SmartHands", active: true },
    ];
    mockQuery = async () => ({ rows: fakeTickets });

    const res = await fetch(`${baseUrl}/api/tv/tickets`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.strictEqual(body.length, 2);
    assert.strictEqual(body[0].group_key, "Alpha");
  });

  test("GET /api/tv/tickets → 200 (not 500) when DB throws", async () => {
    mockQuery = async () => { throw new Error("DB connection lost"); };
    const res = await fetch(`${baseUrl}/api/tv/tickets`);
    assert.strictEqual(res.status, 200, "should return 200 even on DB error");
    const body = await res.json();
    assert.ok(Array.isArray(body), "should return empty array on error");
  });

  test("GET /api/tv/tickets requires NO auth token", async () => {
    mockQuery = async () => ({ rows: [] });
    const res = await fetch(`${baseUrl}/api/tv/tickets`, { headers: {} });
    assert.strictEqual(res.status, 200);
  });

  /* ---------------------------------------------------------------- */
  /* /api/tv/info-entries                                              */
  /* ---------------------------------------------------------------- */
  test("GET /api/tv/info-entries → 200 + { data: [] } (empty DB)", async () => {
    mockQuery = async () => ({ rows: [] });
    const res = await fetch(`${baseUrl}/api/tv/info-entries`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok("data" in body, "response should have .data key");
    assert.ok(Array.isArray(body.data));
    assert.strictEqual(body.data.length, 0);
  });

  test("GET /api/tv/info-entries → 200 + data with entries", async () => {
    const fakeEntries = [
      { id: 1, content: "System OK", type: "info", created_at: new Date().toISOString() },
    ];
    mockQuery = async () => ({ rows: fakeEntries });

    const res = await fetch(`${baseUrl}/api/tv/info-entries`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data));
    assert.strictEqual(body.data[0].content, "System OK");
  });

  test("GET /api/tv/info-entries → 200 (not 500) when DB throws", async () => {
    mockQuery = async () => { throw new Error("DB connection lost"); };
    const res = await fetch(`${baseUrl}/api/tv/info-entries`);
    assert.strictEqual(res.status, 200, "should return 200 even on DB error");
    const body = await res.json();
    assert.deepStrictEqual(body.data, []);
  });
});

/* ------------------------------------------------------------------ */
/* TV_KEY guard tests                                                  */
/* ------------------------------------------------------------------ */

describe("TV_KEY guard (when TV_KEY env var is set)", () => {
  let server;
  let baseUrl;
  const TEST_KEY = "secret-tv-key-1234";

  before(async () => {
    process.env.TV_KEY = TEST_KEY;

    // Recreate a router that respects TV_KEY env
    const router = express.Router();
    const tvKey = process.env.TV_KEY || null;
    function tvKeyGuard(req, res, next) {
      if (!tvKey) return next();
      const provided = req.headers["x-tv-key"] || req.query["tv_key"];
      if (provided === tvKey) return next();
      return res.status(403).json({ error: "TV_KEY required" });
    }
    router.use(tvKeyGuard);
    router.get("/health", (_req, res) => res.json({ status: "ok" }));

    const app = express();
    app.use("/api/tv", router);

    await new Promise((resolve) => {
      server = createServer(app);
      server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    delete process.env.TV_KEY;
    await new Promise((resolve) => server.close(resolve));
  });

  test("request without TV_KEY → 403", async () => {
    const res = await fetch(`${baseUrl}/api/tv/health`);
    assert.strictEqual(res.status, 403);
  });

  test("request with correct X-TV-KEY header → 200", async () => {
    const res = await fetch(`${baseUrl}/api/tv/health`, {
      headers: { "X-TV-KEY": TEST_KEY },
    });
    assert.strictEqual(res.status, 200);
  });

  test("request with tv_key query param → 200", async () => {
    const res = await fetch(`${baseUrl}/api/tv/health?tv_key=${TEST_KEY}`);
    assert.strictEqual(res.status, 200);
  });

  test("request with wrong key → 403", async () => {
    const res = await fetch(`${baseUrl}/api/tv/health`, {
      headers: { "X-TV-KEY": "wrong-key" },
    });
    assert.strictEqual(res.status, 403);
  });
});
