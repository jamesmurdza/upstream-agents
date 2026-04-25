/**
 * Local State Helpers for Query Data
 *
 * These utilities splice device-local fields (previewItem, queuedMessages, etc.)
 * into query-cached data. Local fields don't belong in the query cache because
 * they're device-specific and never sent to/from the server.
 */

import type { Chat } from "@/lib/types"
import type { ChatListItem, ChatDetail } from "./chats"
import {
  loadLocalState,
  type LocalState,
} from "@/lib/storage"

/**
 * Local-only fields that are spliced into chat data at read time
 */
export interface LocalChatFields {
  previewItem: Chat["previewItem"]
  queuedMessages: Chat["queuedMessages"]
  queuePaused: boolean
}

/**
 * Get local fields for a specific chat
 */
export function getLocalFieldsForChat(
  chatId: string,
  localState?: LocalState
): LocalChatFields {
  const state = localState ?? loadLocalState()
  return {
    previewItem: state.previewItems[chatId],
    queuedMessages: state.queuedMessages[chatId],
    queuePaused: state.queuePaused[chatId] ?? false,
  }
}

/**
 * Merge a ChatListItem with its local fields
 */
export function withLocalFields<T extends ChatListItem | ChatDetail>(
  chat: T,
  localState?: LocalState
): T & LocalChatFields {
  const localFields = getLocalFieldsForChat(chat.id, localState)
  return {
    ...chat,
    ...localFields,
  }
}

/**
 * Merge an array of chats with their local fields
 */
export function withLocalFieldsArray<T extends ChatListItem | ChatDetail>(
  chats: T[],
  localState?: LocalState
): Array<T & LocalChatFields> {
  const state = localState ?? loadLocalState()
  return chats.map((chat) => withLocalFields(chat, state))
}

/**
 * Full Chat type with local fields
 */
export type ChatWithLocalFields = ChatListItem & LocalChatFields

/**
 * Full ChatDetail type with local fields
 */
export type ChatDetailWithLocalFields = ChatDetail & LocalChatFields
