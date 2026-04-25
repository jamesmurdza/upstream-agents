/**
 * TanStack Query hooks and utilities
 *
 * Export all query-related functionality from a single entry point.
 */

// Query keys
export { chatKeys, settingsKeys } from "./keys"

// Chat queries
export {
  useChatsQuery,
  useChatQuery,
  useChatFromList,
  useChatQueryClient,
  type ChatListItem,
  type ChatDetail,
} from "./chats"

// Settings queries
export {
  useSettingsQuery,
  useSettings,
  useCredentialFlags,
  type SettingsData,
} from "./settings"

// Local state helpers
export {
  getLocalFieldsForChat,
  withLocalFields,
  withLocalFieldsArray,
  type LocalChatFields,
  type ChatWithLocalFields,
  type ChatDetailWithLocalFields,
} from "./local-state"

// Provider
export { QueryProvider, getQueryClient } from "./provider"
