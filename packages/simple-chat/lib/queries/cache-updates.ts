/**
 * Query Cache Update Helpers
 *
 * These functions write directly to the TanStack Query cache from SSE handlers.
 * They're designed to be called outside of React components (e.g., from
 * EventSource listeners in the stream store).
 */

import { chatKeys } from "./keys"
import { getQueryClient } from "./provider"
import type { ChatDetail, ChatListItem } from "./chats"
import type { Chat, Message, SSEUpdateEvent, SSECompleteEvent } from "@/lib/types"

// =============================================================================
// Message Update (from SSE "update" event)
// =============================================================================

/**
 * Update a message in the cache with streaming content
 *
 * The server sends a cumulative snapshot in every "update" frame.
 * This applies it directly to the assistant message — does NOT append.
 *
 * @param chatId - The chat to update
 * @param assistantMessageId - The ID of the assistant message to update
 * @param data - The SSE update event data
 */
export function updateMessageInCache(
  chatId: string,
  assistantMessageId: string,
  data: Pick<SSEUpdateEvent, "content" | "toolCalls" | "contentBlocks">
) {
  const queryClient = getQueryClient()

  // Update chat detail cache
  queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (cur) => {
    if (!cur) return cur

    const messages = cur.messages.map((m) =>
      m.id === assistantMessageId
        ? {
            ...m,
            content: data.content,
            toolCalls: data.toolCalls,
            contentBlocks: data.contentBlocks,
          }
        : m
    )

    return {
      ...cur,
      messages,
      lastActiveAt: Date.now(),
    }
  })

  // Also update lastActiveAt in the chat list
  queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (cur) =>
    cur?.map((c) =>
      c.id === chatId
        ? { ...c, lastActiveAt: Date.now() }
        : c
    )
  )
}

// =============================================================================
// Stream Complete (from SSE "complete" event)
// =============================================================================

/**
 * Mark a chat as complete after streaming finishes
 *
 * @param chatId - The chat that completed
 * @param data - The SSE complete event data
 */
export function markStreamComplete(
  chatId: string,
  data: SSECompleteEvent
) {
  const queryClient = getQueryClient()

  const updates: Partial<Chat> = {
    status: data.status === "error" ? "error" : "ready",
    backgroundSessionId: undefined,
    lastActiveAt: Date.now(),
    errorMessage:
      data.status === "error"
        ? data.error || "Agent failed without an error message"
        : undefined,
  }
  if (data.sessionId) {
    updates.sessionId = data.sessionId
  }

  // Update chat detail cache
  queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (cur) => {
    if (!cur) return cur
    return { ...cur, ...updates } as ChatDetail
  })

  // Update chat list cache
  queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (cur) =>
    cur?.map((c) =>
      c.id === chatId
        ? { ...c, ...updates } as ChatListItem
        : c
    )
  )
}

// =============================================================================
// Stream Error (from SSE "error" event or connection failure)
// =============================================================================

/**
 * Mark a chat as errored when streaming fails
 *
 * @param chatId - The chat that failed
 * @param errorMessage - The error message to display
 */
export function markStreamError(chatId: string, errorMessage: string) {
  const queryClient = getQueryClient()

  const updates: Partial<Chat> = {
    status: "error",
    backgroundSessionId: undefined,
    errorMessage,
  }

  // Update chat detail cache
  queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (cur) => {
    if (!cur) return cur
    return { ...cur, ...updates } as ChatDetail
  })

  // Update chat list cache
  queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (cur) =>
    cur?.map((c) =>
      c.id === chatId
        ? { ...c, ...updates } as ChatListItem
        : c
    )
  )
}

// =============================================================================
// Start Streaming (called before SSE connection)
// =============================================================================

/**
 * Update cache when starting a stream
 *
 * Sets status to "running" and stores connection identifiers.
 *
 * @param chatId - The chat starting to stream
 * @param params - Stream parameters
 */
export function markStreamStarted(
  chatId: string,
  params: {
    sandboxId: string
    backgroundSessionId: string
    branch?: string | null
    previewUrlPattern?: string
  }
) {
  const queryClient = getQueryClient()

  const updates: Partial<Chat> = {
    status: "running",
    sandboxId: params.sandboxId,
    backgroundSessionId: params.backgroundSessionId,
    branch: params.branch ?? undefined,
    previewUrlPattern: params.previewUrlPattern,
  }

  // Update chat detail cache
  queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (cur) => {
    if (!cur) return cur
    return { ...cur, ...updates } as ChatDetail
  })

  // Update chat list cache
  queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (cur) =>
    cur?.map((c) =>
      c.id === chatId
        ? { ...c, ...updates } as ChatListItem
        : c
    )
  )
}

// =============================================================================
// Add Messages (optimistic insert before stream)
// =============================================================================

/**
 * Add optimistic messages to a chat
 *
 * Used when sending a message before the SSE stream starts.
 *
 * @param chatId - The chat to add messages to
 * @param userMessage - The user's message
 * @param assistantMessage - The placeholder assistant message
 */
export function addOptimisticMessages(
  chatId: string,
  userMessage: Message,
  assistantMessage: Message
) {
  const queryClient = getQueryClient()

  // Update chat detail cache
  queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (cur) => {
    if (!cur) return cur
    return {
      ...cur,
      messages: [...cur.messages, userMessage, assistantMessage],
      lastActiveAt: Date.now(),
    }
  })

  // Update message count in chat list
  queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (cur) =>
    cur?.map((c) =>
      c.id === chatId
        ? {
            ...c,
            messageCount: (c.messageCount ?? 0) + 2,
            lastActiveAt: Date.now(),
          }
        : c
    )
  )
}

// =============================================================================
// Update Chat Fields
// =============================================================================

/**
 * Update arbitrary fields on a chat in the cache
 *
 * Useful for agent/model changes, name updates, etc.
 *
 * @param chatId - The chat to update
 * @param updates - The fields to update
 */
export function updateChatInCache(
  chatId: string,
  updates: Partial<Chat>
) {
  const queryClient = getQueryClient()

  // Update chat detail cache
  queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (cur) => {
    if (!cur) return cur
    return { ...cur, ...updates } as ChatDetail
  })

  // Update chat list cache
  queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (cur) =>
    cur?.map((c) =>
      c.id === chatId
        ? { ...c, ...updates } as ChatListItem
        : c
    )
  )
}

// =============================================================================
// Update User Message (for uploaded files)
// =============================================================================

/**
 * Update a user message with uploaded file info
 *
 * @param chatId - The chat containing the message
 * @param messageId - The message to update
 * @param uploadedFiles - Array of uploaded file paths
 */
export function updateUserMessageFiles(
  chatId: string,
  messageId: string,
  uploadedFiles: string[]
) {
  const queryClient = getQueryClient()

  queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (cur) => {
    if (!cur) return cur
    return {
      ...cur,
      messages: cur.messages.map((m) =>
        m.id === messageId
          ? { ...m, uploadedFiles }
          : m
      ),
    }
  })
}
