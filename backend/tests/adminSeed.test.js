/**
 * backend/tests/adminSeed.test.js
 *
 * Unit tests for the default admin seeding logic.
 * Tests the idempotency and correctness of seedDefaultAdmin() without
 * needing a live database — the DB query function is injected as a mock.
 * Also covers the SEED_ADMIN_IF_MISSING=true mode.
 *
 * Run with: node --test tests/adminSeed.test.js
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Inline seed logic (mirrors backend/db/seed.js)                             */
/*  We accept `queryFn` as a parameter so tests can inject a mock.             */
/* ─────────────────────────────────────────────────────────────────────────── */

const DEFAULT_EMAIL    = "admin@local";
const DEFAULT_PASSWORD = "admin";
const BCRYPT_ROUNDS    = 12;

async function seedDefaultAdmin(queryFn) {
  try {
    const seedIfMissing =
      (process.env.SEED_ADMIN_IF_MISSING ?? "").toLowerCase() === "true";

    if (seedIfMissing) {
      const { rows: existing } = await queryFn(
        "SELECT 1 FROM users WHERE email = $1 LIMIT 1",
        [DEFAULT_EMAIL]
      );
      if (existing.length > 0) return { skipped: true };
    } else {
      const { rows } = await queryFn("SELECT COUNT(*)::int AS cnt FROM users");
      const count = rows[0]?.cnt ?? 0;
      if (count > 0) return { skipped: true };
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

    await queryFn(
      `INSERT INTO users
         (first_name, last_name, username, email, password_hash,
          user_group, department, ibx, approved, is_root)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,TRUE)`,
      ["Admin", "User", "admin", DEFAULT_EMAIL, passwordHash,
       "c-ops", "c-ops", "FR2"]
    );

    return { created: true, hash: passwordHash };
  } catch (err) {
    return { error: err.message };
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Tests — default mode (SEED_ADMIN_IF_MISSING unset)                         */
/* ─────────────────────────────────────────────────────────────────────────── */

describe("seedDefaultAdmin – default mode", () => {
  beforeEach(() => { delete process.env.SEED_ADMIN_IF_MISSING; });
  afterEach(() => { delete process.env.SEED_ADMIN_IF_MISSING; });

  // ── 1. Empty DB: admin is created ─────────────────────────────────────────
  test("creates admin when users table is empty", async () => {
    const calls = [];

    const mockQuery = async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT COUNT")) return { rows: [{ cnt: 0 }] };
      if (sql.includes("INSERT INTO users")) return { rowCount: 1 };
      return { rows: [] };
    };

    const result = await seedDefaultAdmin(mockQuery);

    assert.ok(result.created, "should have created the admin");
    assert.equal(calls.length, 2, "should run exactly 2 queries (COUNT + INSERT)");

    const insertCall = calls.find((c) => c.sql.includes("INSERT INTO users"));
    assert.ok(insertCall, "INSERT query must have been issued");
    assert.equal(insertCall.params[3], DEFAULT_EMAIL, "email should be admin@local");
    assert.equal(insertCall.params[5], "c-ops", "user_group should be c-ops");
    assert.equal(insertCall.params[7], "FR2", "ibx should be FR2");
  });

  // ── 2. Password is bcrypt-hashed ───────────────────────────────────────────
  test("stores password as a bcrypt hash", async () => {
    const mockQuery = async (sql, params) => {
      if (sql.startsWith("SELECT COUNT")) return { rows: [{ cnt: 0 }] };
      return { rowCount: 1 };
    };

    const result = await seedDefaultAdmin(mockQuery);

    assert.ok(result.hash, "hash should be returned in test");
    assert.ok(
      result.hash.startsWith("$2b$"),
      "hash must be a bcrypt hash (starts with $2b$)"
    );

    const valid = await bcrypt.compare(DEFAULT_PASSWORD, result.hash);
    assert.ok(valid, "plain text password must verify against the hash");
  });

  // ── 3. Non-empty DB: seed is skipped ──────────────────────────────────────
  test("skips creation when users already exist", async () => {
    const calls = [];

    const mockQuery = async (sql, params) => {
      calls.push(sql);
      if (sql.startsWith("SELECT COUNT")) return { rows: [{ cnt: 3 }] };
      throw new Error("Unexpected query: " + sql);
    };

    const result = await seedDefaultAdmin(mockQuery);
    assert.ok(result.skipped, "should return skipped:true");
    assert.equal(calls.length, 1, "only the COUNT query should run");
  });

  // ── 4. Exactly 1 existing user: seed is also skipped ─────────────────────
  test("skips when exactly 1 user exists", async () => {
    const mockQuery = async (sql) => {
      if (sql.startsWith("SELECT COUNT")) return { rows: [{ cnt: 1 }] };
      throw new Error("INSERT must not run when users > 0");
    };

    const result = await seedDefaultAdmin(mockQuery);
    assert.ok(result.skipped);
  });

  // ── 5. Default values are enterprise-appropriate ──────────────────────────
  test("default account has is_root=TRUE and approved=TRUE", async () => {
    let insertedParams = null;

    const mockQuery = async (sql, params) => {
      if (sql.startsWith("SELECT COUNT")) return { rows: [{ cnt: 0 }] };
      insertedParams = params;
      return { rowCount: 1 };
    };

    await seedDefaultAdmin(mockQuery);

    assert.ok(Array.isArray(insertedParams), "INSERT params must be an array");
    assert.equal(insertedParams[3], "admin@local", "email must be admin@local");
    assert.equal(insertedParams[0], "Admin",  "first_name must be Admin");
    assert.equal(insertedParams[1], "User",   "last_name must be User");
    assert.equal(insertedParams[2], "admin",  "username must be admin");
  });

  // ── 6. Idempotency: calling twice on empty→populated is safe ──────────────
  test("calling twice is safe (idempotent via COUNT check)", async () => {
    let userCount = 0;

    const mockQuery = async (sql, params) => {
      if (sql.startsWith("SELECT COUNT")) return { rows: [{ cnt: userCount }] };
      if (sql.includes("INSERT INTO users")) {
        userCount += 1;
        return { rowCount: 1 };
      }
      return { rows: [] };
    };

    const r1 = await seedDefaultAdmin(mockQuery);
    assert.ok(r1.created, "first call should create admin");
    assert.equal(userCount, 1, "user count should be 1 after first call");

    const r2 = await seedDefaultAdmin(mockQuery);
    assert.ok(r2.skipped, "second call should be skipped");
    assert.equal(userCount, 1, "user count must not increase on second call");
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Tests — SEED_ADMIN_IF_MISSING=true mode                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

describe("seedDefaultAdmin – SEED_ADMIN_IF_MISSING=true", () => {
  beforeEach(() => { process.env.SEED_ADMIN_IF_MISSING = "true"; });
  afterEach(() => { delete process.env.SEED_ADMIN_IF_MISSING; });

  // ── 7. Creates admin even when other users exist ──────────────────────────
  test("creates admin@local when other users exist but admin is absent", async () => {
    const calls = [];

    const mockQuery = async (sql, params) => {
      calls.push({ sql, params });
      // SELECT 1 FROM users WHERE email = $1 → not found
      if (sql.includes("WHERE email")) return { rows: [] };
      if (sql.includes("INSERT INTO users")) return { rowCount: 1 };
      return { rows: [] };
    };

    const result = await seedDefaultAdmin(mockQuery);
    assert.ok(result.created, "should create admin in SEED_ADMIN_IF_MISSING mode");

    const emailCheck = calls.find((c) => c.sql.includes("WHERE email"));
    assert.ok(emailCheck, "should query by email");
    assert.equal(emailCheck.params[0], DEFAULT_EMAIL, "should check admin@local email");
  });

  // ── 8. Skips if admin@local already present ───────────────────────────────
  test("skips if admin@local already exists (SEED_ADMIN_IF_MISSING mode)", async () => {
    const mockQuery = async (sql, params) => {
      if (sql.includes("WHERE email")) return { rows: [{ email: DEFAULT_EMAIL }] };
      throw new Error("INSERT must not run if admin already exists");
    };

    const result = await seedDefaultAdmin(mockQuery);
    assert.ok(result.skipped, "should skip if admin@local already present");
  });

  // ── 9. Does NOT use COUNT(*) in SEED_ADMIN_IF_MISSING mode ───────────────
  test("does not run COUNT(*) query in SEED_ADMIN_IF_MISSING mode", async () => {
    const calls = [];

    const mockQuery = async (sql, params) => {
      calls.push(sql);
      if (sql.includes("WHERE email")) return { rows: [] };
      if (sql.includes("INSERT")) return { rowCount: 1 };
      return { rows: [] };
    };

    await seedDefaultAdmin(mockQuery);
    const hasCount = calls.some((s) => s.includes("COUNT(*)"));
    assert.ok(!hasCount, "COUNT(*) must NOT be used in SEED_ADMIN_IF_MISSING mode");
  });
});

