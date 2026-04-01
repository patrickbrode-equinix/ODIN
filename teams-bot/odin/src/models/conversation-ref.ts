/**
 * Stored conversation reference — enriched with metadata for lookup.
 */

import type { ConversationReference } from "@microsoft/teams.api";

/** The scope/type of a stored conversation */
export type ConversationScope = "personal" | "groupChat" | "channel";

/**
 * A stored conversation reference entry.
 * Contains the raw Teams SDK ConversationReference plus ODIN-relevant metadata.
 */
export interface StoredConversationRef {
  /** Internal unique key (e.g. "<aadObjectId>" for personal, "<conversationId>" for others) */
  key: string;
  /** AAD Object ID of the user (for personal chats) */
  aadObjectId?: string;
  /** User Principal Name (e.g. user@tenant.com) */
  upn?: string;
  /** Display name of the user or channel */
  displayName?: string;
  /** Scope of this conversation */
  scope: ConversationScope;
  /** The raw SDK conversation reference (must be serializable) */
  reference: ConversationReference;
  /** When this entry was first created */
  createdAt: string;
  /** When this entry was last updated */
  updatedAt: string;
}
