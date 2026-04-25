/**
 * TanStack Mutations
 *
 * Export all mutation-related functionality from a single entry point.
 */

// Chat mutations
export {
  useCreateChat,
  useUpdateChat,
  useDeleteChat,
  useRenameChat,
  useUpdateChatRepo,
} from "./chats"

// Settings mutations
export { useUpdateSettings } from "./settings"

// Message mutations
export { useSendMessage, generateChatName } from "./messages"
