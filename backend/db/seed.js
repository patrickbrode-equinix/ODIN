/* ------------------------------------------------ */
/* DB SEED – DEFAULT ADMIN USER                     */
/* ------------------------------------------------ */
/**
 * seedDefaultAdmin()
 *
 * Creates the built-in admin account on a fresh install.
 *
 * Modes:
 * 1. Default (SEED_ADMIN_IF_MISSING unset / false):
 *    - Only seeds when the users table is completely empty.
 *    - Idempotent: safe to call on every restart.
 *
 * 2. SEED_ADMIN_IF_MISSING=true:
 *    - Seeds Admin@Odin whenever that specific login name is absent,
 *      even if other users already exist.
 *    - Use this to recover from lockouts on reused volumes.
 *
 * Password is bcrypt-hashed (rounds = 12) — never stored plain.
 *
 * Default credentials:
 *   login    : Admin@Odin
 *   password : admin          (change immediately in production!)
 */

import bcrypt from "bcrypt";
import { query } from "../db.js";

const DEFAULT_LOGIN_NAME = "Admin@Odin";
const DEFAULT_EMAIL    = "admin@odin.local";
const DEFAULT_PASSWORD = "admin";
const BCRYPT_ROUNDS    = 12;

export async function seedDefaultAdmin(queryFn = query) {
  try {
    const seedIfMissing =
      (process.env.SEED_ADMIN_IF_MISSING ?? "").toLowerCase() === "true";

    if (seedIfMissing) {
      // Mode 2: ensure Admin@Odin exists regardless of other users
      const { rows: existing } = await queryFn(
        "SELECT 1 FROM users WHERE LOWER(login_name) = LOWER($1) LIMIT 1",
        [DEFAULT_LOGIN_NAME]
      );
      if (existing.length > 0) {
        console.log("[SEED] Admin@Odin already present – skipping (SEED_ADMIN_IF_MISSING mode).");
        return { skipped: true };
      }
      console.log("[SEED] SEED_ADMIN_IF_MISSING=true – creating Admin@Odin...");
    } else {
      // Mode 1 (default): only seed on completely empty users table
      const { rows } = await queryFn("SELECT COUNT(*)::int AS cnt FROM users");
      const count = rows[0]?.cnt ?? 0;
      if (count > 0) {
        console.log("[SEED] Users already exist – skipping default admin creation.");
        return { skipped: true };
      }
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

    await queryFn(
      `INSERT INTO users
         (first_name, last_name, username, login_name, email, password_hash,
          user_group, department, ibx, approved, is_root)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, TRUE)`,
      [
        "Admin",
        "User",
        "admin",
        DEFAULT_LOGIN_NAME,
        DEFAULT_EMAIL,
        passwordHash,
        "c-ops",   // default group
        "c-ops",
        "FR2",
      ]
    );

    console.log(`[SEED] ✅ Default admin created → ${DEFAULT_LOGIN_NAME}`);
    console.log("[SEED]    Change this password immediately in production!");
    return { created: true };
  } catch (err) {
    // Non-fatal: log and continue.  The server must not crash here.
    console.error("[SEED] ❌ Failed to seed default admin:", err.message);
    return { error: err.message };
  }
}
