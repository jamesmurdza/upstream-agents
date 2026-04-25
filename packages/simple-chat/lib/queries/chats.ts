"use client"

/**
 * TanStack Query hooks for chat data
 *
 * These hooks wrap the existing API functions and provide cached,
 * deduplicated data fetching with automatic background updates.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { chatKeys } from "./keys"
import {
  fetchChats,
  fetchChat,
  toChatType,
  toMessageType,
  type ChatResponse,
  type ChatWithMessagesResponse,
} from "@/lib/sync/api"
import type { Chat, Message } from "@/lib/types"
import { useStreamStore } from "@/lib/stores/stream-store"

/**
 * Chat list item without messages (for list display)
 */
export interface ChatListItem extends Omit<Chat, "messages"> {
  messageCount: number
}

/**
 * Full chat detail with messages
 */
export interface ChatDetail extends Chat {
  messages: Message[]
}

/**
 * Transform server response to ChatListItem
 */
function toChatListItem(serverChat: ChatResponse): ChatListItem {
  return {
    ...toChatType(serverChat),
    messageCount: serverChat.messageCount ?? 0,
  }
}

/**
 * Transform server response to ChatDetail
 */
function toChatDetail(serverChat: ChatWithMessagesResponse): ChatDetail {
  return {
    ...toChatType(serverChat),
    messages: serverChat.messages.map(toMessageType),
  }
}

/**
 * Hook to fetch the list of all chats (without messages)
 *
 * Returns chats sorted by lastActiveAt (most recent first).
 * Enabled only when authenticated.
 */
export function useChatsQuery() {
  const { data: session, status } = useSession()

  return useQuery({
    queryKey: chatKeys.all,
    queryFn: async (): Promise<ChatListItem[]> => {
      const serverChats = await fetchChats()
      const chats = serverChats.map(toChatListItem)
      // Sort by lastActiveAt (most recent first)
      return chats.sort((a, b) =>
        (b.lastActiveAt ?? b.updatedAt) - (a.lastActiveAt ?? a.updatedAt)
      )
    },
    enabled: status === "authenticated" && !!session?.user?.id,
    // Use staleTime from provider defaults (30s)
  })
}

/**
 * Hook to fetch a single chat with its messages
 *
 * @param chatId - The chat ID to fetch
 * @param options.enabled - Additional enable condition (default: true)
 *
 * When streaming is active for this chat, the query is disabled
 * to prevent race conditions between SSE updates and refetches.
 */
export function useChatQuery(
  chatId: string | null | undefined,
  options?: { enabled?: boolean }
) {
  const { data: session, status } = useSession()
  const isStreaming = useStreamStore((state) =>
    chatId ? state.isStreaming(chatId) : false
  )

  return useQuery({
    queryKey: chatKeys.detail(chatId ?? ""),
    queryFn: async (): Promise<ChatDetail> => {
      if (!chatId) throw new Error("No chat ID provided")
      const serverChat = await fetchChat(chatId)
      return toChatDetail(serverChat)
    },
    enabled:
      status === "authenticated" &&
      !!session?.user?.id &&
      !!chatId &&
      !isStreaming && // Don't refetch while streaming
      (options?.enabled ?? true),
  })
}

/**
 * Hook to get a chat from the list cache (without messages)
 *
 * This is useful when you need chat metadata but don't want to
 * trigger a full detail fetch.
 */
export function useChatFromList(chatId: string | null | undefined) {
  const { data: chats } = useChatsQuery()
  return chats?.find((c) => c.id === chatId) ?? null
}

/**
 * Get the query client for direct cache manipulation
 *
 * Use this in mutations and SSE handlers to update the cache directly.
 */
export function useChatQueryClient() {
  return useQueryClient()
}
