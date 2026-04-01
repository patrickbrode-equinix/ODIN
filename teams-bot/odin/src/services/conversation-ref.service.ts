/**
 * Conversation Reference Service — captures and updates references from bot activities.
 */

import type { ConversationReference } from "@microsoft/teams.api";
import type { IConversationRefRepository } from "../repositories/index";
import type { StoredConversationRef, ConversationScope } from "../models/index";
import { logger } from "../utils/logger";

export class ConversationRefService {
  constructor(private repo: IConversationRefRepository) {}

  /**
   * Capture a conversation reference from an inbound activity context.
   * Call this on every message to keep references up to date.
   */
  async capture(ref: ConversationReference): Promise<void> {
    const scope = this.detectScope(ref);
    const key = this.deriveKey(ref, scope);
    if (!key) {
      logger.debug("ConversationRefService: could not derive key, skipping capture");
      return;
    }

    const entry: StoredConversationRef = {
      key,
      aadObjectId: ref.user?.aadObjectId,
      upn: undefined, // UPN not directly in ConversationReference; enriched later if available
      displayName: ref.user?.name || ref.conversation?.name || undefined,
      scope,
      reference: ref,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.repo.upsert(entry);

    // ── [DEBUG] Log stored conversation reference for local testing ──
    logger.info("[DEBUG:CONVREF] Conversation reference stored", {
      key,
      scope,
      userId: ref.user?.id,
      userName: ref.user?.name,
      aadObjectId: ref.user?.aadObjectId,
      conversationId: ref.conversation?.id,
    });
 }

  /** Get a personal chat reference for a given AAD Object ID */
  async getPersonalRef(aadObjectId: string) {
    return this.repo.getByAadObjectId(aadObjectId);
  }

  /** Get a reference by direct key */
  async getByKey(key: string) {
    return this.repo.getByKey(key);
  }

  /** List all stored references */
  async listAll() {
    return this.repo.getAll();
  }

  /** Detect conversation scope from the reference */
  private detectScope(ref: ConversationReference): ConversationScope {
    const convId = ref.conversation?.id || "";
    if (ref.conversation?.isGroup) return "groupChat";
    // Channel conversations typically contain a thread ID with "19:" prefix and "@thread"
    if (convId.includes("@thread")) return "channel";
    // If not group and not channel, it's personal
    return "personal";
  }

  /** Derive a unique key for this reference */
  private deriveKey(ref: ConversationReference, scope: ConversationScope): string | null {
    if (scope === "personal" && ref.user?.aadObjectId) {
      return ref.user.aadObjectId;
    }
    if (ref.conversation?.id) {
      return ref.conversation.id;
    }
    return null;
  }
}
