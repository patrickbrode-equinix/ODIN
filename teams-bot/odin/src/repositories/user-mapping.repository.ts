/**
 * User Mapping Repository — Interface + InMemory implementation.
 *
 * Maps ODIN employee IDs to Teams identities.
 * Initial version uses in-memory seed data.
 * Designed for easy replacement with PostgreSQL.
 */

import type { UserMapping } from "../models/index";
import { logger } from "../utils/logger";

// ── Repository Interface ──

export interface IUserMappingRepository {
  /** Get mapping by ODIN employee ID */
  getByEmployeeId(employeeId: string): Promise<UserMapping | undefined>;
  /** Get mapping by AAD Object ID */
  getByAadObjectId(aadObjectId: string): Promise<UserMapping | undefined>;
  /** Get mapping by email */
  getByEmail(email: string): Promise<UserMapping | undefined>;
  /** Get all mappings */
  getAll(): Promise<UserMapping[]>;
  /** Create or update a mapping */
  upsert(mapping: UserMapping): Promise<void>;
  /** Update Teams identity fields when a user interacts with the bot */
  updateTeamsIdentity(
    employeeId: string,
    fields: { teamsUserId?: string; aadObjectId?: string; upn?: string }
  ): Promise<void>;
}

// ── InMemory Implementation with seed data ──

export class InMemoryUserMappingRepository implements IUserMappingRepository {
  private store = new Map<string, UserMapping>();

  constructor(seedData?: UserMapping[]) {
    if (seedData) {
      for (const m of seedData) {
        this.store.set(m.employeeId, m);
      }
      logger.info(`UserMapping repository initialized with ${seedData.length} seed entries`);
    }
  }

  async getByEmployeeId(employeeId: string): Promise<UserMapping | undefined> {
    return this.store.get(employeeId);
  }

  async getByAadObjectId(aadObjectId: string): Promise<UserMapping | undefined> {
    for (const m of this.store.values()) {
      if (m.aadObjectId === aadObjectId) return m;
    }
    return undefined;
  }

  async getByEmail(email: string): Promise<UserMapping | undefined> {
    const lower = email.toLowerCase();
    for (const m of this.store.values()) {
      if (m.email.toLowerCase() === lower) return m;
    }
    return undefined;
  }

  async getAll(): Promise<UserMapping[]> {
    return Array.from(this.store.values());
  }

  async upsert(mapping: UserMapping): Promise<void> {
    this.store.set(mapping.employeeId, mapping);
    logger.debug(`UserMapping upserted: ${mapping.employeeId} → ${mapping.displayName}`);
  }

  async updateTeamsIdentity(
    employeeId: string,
    fields: { teamsUserId?: string; aadObjectId?: string; upn?: string }
  ): Promise<void> {
    const existing = this.store.get(employeeId);
    if (!existing) {
      logger.warn(`UserMapping updateTeamsIdentity: unknown employeeId=${employeeId}`);
      return;
    }
    if (fields.teamsUserId) existing.teamsUserId = fields.teamsUserId;
    if (fields.aadObjectId) existing.aadObjectId = fields.aadObjectId;
    if (fields.upn) existing.upn = fields.upn;
    this.store.set(employeeId, existing);
    logger.debug(`UserMapping Teams identity updated: ${employeeId}`);
  }
}

// ── Seed data for development / playground testing ──
//
// HOW TO MAP YOUR PLAYGROUND USER:
//
// 1. Start the bot, send "hi" in the Playground
// 2. Check the logs for [DEBUG:INCOMING] — note the fromId and fromAadObjectId
// 3. Call GET /api/internal/debug/conversation-references to see stored refs
// 4. Option A (automatic): Set these in .env and restart:
//      DEBUG_FALLBACK_EMPLOYEE_ID=emp-123
//    The bot will auto-link the first personal conversation to this employee.
// 5. Option B (manual): Update the seed entry below with your real aadObjectId
//    and restart.
// 6. Call POST /api/internal/notify/ticket with employeeId=emp-123

export const SEED_USER_MAPPINGS: UserMapping[] = [
  {
    // ── Local test user ── use this for Playground testing
    employeeId: "emp-123",
    displayName: "Local Testuser",
    email: "testuser@localhost",
    enabled: true,
    // Fill in after first Playground interaction (see logs or debug endpoints):
    // aadObjectId: "your-aad-object-id-here",
    // teamsUserId: "your-teams-user-id-here",
  },
  {
    employeeId: "emp-001",
    displayName: "Mustermann, Max",
    email: "max.mustermann@example.com",
    enabled: true,
  },
  {
    employeeId: "emp-002",
    displayName: "Schmidt, Anna",
    email: "anna.schmidt@example.com",
    enabled: true,
  },
  {
    employeeId: "emp-003",
    displayName: "Weber, Tom",
    email: "tom.weber@example.com",
    enabled: true,
  },
];
