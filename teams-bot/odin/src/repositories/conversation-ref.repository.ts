/**
 * Conversation Reference Repository — Interface + InMemory implementation.
 *
 * Stores Teams conversation references so the bot can send proactive messages.
 * The interface is designed for easy replacement with a PostgreSQL implementation later.
 */

import type { StoredConversationRef, ConversationScope } from "../models/index";
import { logger } from "../utils/logger";

// ── Repository Interface ──

export interface IConversationRefRepository {
  /** Store or update a conversation reference */
  upsert(entry: StoredConversationRef): Promise<void>;
  /** Get a reference by its key (e.g. aadObjectId for personal chat) */
  getByKey(key: string): Promise<StoredConversationRef | undefined>;
  /** Get personal chat reference by AAD Object ID */
  getByAadObjectId(aadObjectId: string): Promise<StoredConversationRef | undefined>;
  /** Get all references for a given scope */
  getByScope(scope: ConversationScope): Promise<StoredConversationRef[]>;
  /** Get all stored references */
  getAll(): Promise<StoredConversationRef[]>;
  /** Delete a reference by key */
  delete(key: string): Promise<boolean>;
}

// ── InMemory Implementation ──

export class InMemoryConversationRefRepository implements IConversationRefRepository {
  private store = new Map<string, StoredConversationRef>();

  async upsert(entry: StoredConversationRef): Promise<void> {
    const existing = this.store.get(entry.key);
    if (existing) {
      entry = { ...entry, createdAt: existing.createdAt, updatedAt: new Date().toISOString() };
    }
    this.store.set(entry.key, entry);
    logger.debug(`ConvRef upserted: key=${entry.key} scope=${entry.scope}`);
  }

  async getByKey(key: string): Promise<StoredConversationRef | undefined> {
    return this.store.get(key);
  }

  async getByAadObjectId(aadObjectId: string): Promise<StoredConversationRef | undefined> {
    for (const entry of this.store.values()) {
      if (entry.aadObjectId === aadObjectId && entry.scope === "personal") {
        return entry;
      }
    }
    return undefined;
  }

  async getByScope(scope: ConversationScope): Promise<StoredConversationRef[]> {
    const results: StoredConversationRef[] = [];
    for (const entry of this.store.values()) {
      if (entry.scope === scope) results.push(entry);
    }
    return results;
  }

  async getAll(): Promise<StoredConversationRef[]> {
    return Array.from(this.store.values());
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
}
