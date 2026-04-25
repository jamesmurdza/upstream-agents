"use client"

/**
 * TanStack Mutations for Chat Operations
 *
 * These mutations handle create, update, and delete operations for chats.
 * Each mutation updates the query cache optimistically and handles rollback on error.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { chatKeys } from "@/lib/queries/keys"
import {
  createChat as apiCreateChat,
  updateChat as apiUpdateChat,
  deleteChat as apiDeleteChat,
  toChatType,
} from "@/lib/sync/api"
import type { ChatListItem, ChatDetail } from "@/lib/queries/chats"
import type { Chat } from "@/lib/types"
import { useStreamStore } from "@/lib/stores/stream-store"
import { collectDescendantIds } from "@/lib/storage"

// =============================================================================
// Create Chat Mutation
// =============================================================================

interface CreateChatParams {
  repo: string
  baseBranch?: string
  parentChatId?: string
  agent?: string
  model?: string
  status?: string
}

/**
 * Mutation to create a new chat
 *
 * On success, adds the new chat to the beginning of the chat list cache.
 */
export function useCreateChat() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: CreateChatParams) => {
      const serverChat = await apiCreateChat(params)
      return toChatType(serverChat)
    },
    onSuccess: (newChat) => {
      // Add to chat list cache
      queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (old) => {
        if (!old) return [{ ...newChat, messageCount: 0 }]
        return [{ ...newChat, messageCount: 0 }, ...old]
      })
    },
  })
}

// =============================================================================
// Update Chat Mutation
// =============================================================================

type UpdateChatData = Partial<{
  displayName: string
  status: string
  agent: string
  model: string
  repo: string
  baseBranch: string
  branch: string
  sandboxId: string
  sessionId: string
  previewUrlPattern: string
  backgroundSessionId: string | null
  needsSync: boolean
  lastActiveAt: number
}>

interface UpdateChatParams {
  chatId: string
  data: UpdateChatData
}

interface UpdateChatContext {
  previousChat?: ChatListItem
  previousDetail?: ChatDetail
}

/**
 * Mutation to update a chat
 *
 * Performs optimistic updates to both the chat list and detail caches.
 * Rolls back on error.
 */
export function useUpdateChat() {
  const queryClient = useQueryClient()

  return useMutation<Chat, Error, UpdateChatParams, UpdateChatContext>({
    mutationFn: async ({ chatId, data }) => {
      const serverChat = await apiUpdateChat(chatId, data)
      return toChatType(serverChat)
    },
    onMutate: async ({ chatId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: chatKeys.all })
      await queryClient.cancelQueries({ queryKey: chatKeys.detail(chatId) })

      // Snapshot previous values
      const previousChats = queryClient.getQueryData<ChatListItem[]>(chatKeys.all)
      const previousChat = previousChats?.find((c) => c.id === chatId)
      const previousDetail = queryClient.getQueryData<ChatDetail>(chatKeys.detail(chatId))

      // Optimistically update chat list
      if (previousChats) {
        queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (old) => {
          if (!old) return old
          return old.map((chat) =>
            chat.id === chatId ? { ...chat, ...data } as ChatListItem : chat
          )
        })
      }

      // Optimistically update chat detail
      if (previousDetail) {
        queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (old) => {
          if (!old) return old
          return { ...old, ...data } as ChatDetail
        })
      }

      return { previousChat, previousDetail }
    },
    onError: (_error, { chatId }, context) => {
      // Rollback on error
      if (context?.previousChat) {
        queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (old) =>
          old?.map((chat) =>
            chat.id === chatId ? context.previousChat! : chat
          )
        )
      }
      if (context?.previousDetail) {
        queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), context.previousDetail)
      }
    },
    onSettled: (_data, _error, { chatId }) => {
      // Invalidate to ensure consistency (but don't refetch immediately)
      // The cache is already up-to-date from onMutate/onSuccess
      queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId), refetchType: "none" })
    },
  })
}

// =============================================================================
// Delete Chat Mutation
// =============================================================================

interface DeleteChatParams {
  chatId: string
  /** Current chats for collecting descendants */
  chats: Array<{ id: string; parentChatId?: string }>
}

interface DeleteChatResult {
  deletedChatIds: string[]
  sandboxIdsToCleanup: string[]
}

interface DeleteChatContext {
  previousChats?: ChatListItem[]
  deletedIds: string[]
}

/**
 * Mutation to delete a chat and all its descendants
 *
 * Stops SSE streams for deleted chats and cleans up sandboxes.
 * Optimistically removes chats from the list.
 */
export function useDeleteChat() {
  const queryClient = useQueryClient()

  return useMutation<DeleteChatResult, Error, DeleteChatParams, DeleteChatContext>({
    mutationFn: async ({ chatId }) => {
      const result = await apiDeleteChat(chatId)

      // Clean up sandboxes (fire-and-forget)
      for (const sandboxId of result.sandboxIdsToCleanup) {
        fetch("/api/sandbox/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId }),
        }).catch((err) => console.error("Failed to delete sandbox:", err))
      }

      return result
    },
    onMutate: async ({ chatId, chats }) => {
      // Collect all descendant IDs
      const deletedIds = collectDescendantIds(
        chats.map((c) => ({
          id: c.id,
          parentChatId: c.parentChatId,
          // Provide minimal Chat-like objects for collectDescendantIds
          repo: "",
          baseBranch: "",
          branch: null,
          sandboxId: null,
          sessionId: null,
          messages: [],
          createdAt: 0,
          updatedAt: 0,
          status: "pending" as const,
          displayName: null,
        })),
        chatId
      )

      // Stop SSE streams for all deleted chats
      const streamStore = useStreamStore.getState()
      for (const id of deletedIds) {
        streamStore.stopStream(id)
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: chatKeys.all })

      // Snapshot previous values
      const previousChats = queryClient.getQueryData<ChatListItem[]>(chatKeys.all)

      // Optimistically remove from chat list
      const deletedSet = new Set(deletedIds)
      queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (old) =>
        old?.filter((chat) => !deletedSet.has(chat.id))
      )

      // Remove detail queries
      for (const id of deletedIds) {
        queryClient.removeQueries({ queryKey: chatKeys.detail(id) })
      }

      return { previousChats, deletedIds }
    },
    onError: (_error, _params, context) => {
      // Rollback on error
      if (context?.previousChats) {
        queryClient.setQueryData<ChatListItem[]>(chatKeys.all, context.previousChats)
      }
    },
    onSuccess: (result) => {
      // Server may have deleted more chats than we predicted (cascading deletes)
      // Ensure they're removed from cache
      const deletedSet = new Set(result.deletedChatIds)
      queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (old) =>
        old?.filter((chat) => !deletedSet.has(chat.id))
      )
    },
  })
}

// =============================================================================
// Rename Chat Mutation (convenience wrapper)
// =============================================================================

/**
 * Convenience mutation to rename a chat
 */
export function useRenameChat() {
  const updateChat = useUpdateChat()

  return useMutation({
    mutationFn: async ({ chatId, displayName }: { chatId: string; displayName: string }) => {
      return updateChat.mutateAsync({ chatId, data: { displayName } })
    },
  })
}

// =============================================================================
// Update Chat Repo Mutation (convenience wrapper)
// =============================================================================

/**
 * Convenience mutation to update a chat's repository
 */
export function useUpdateChatRepo() {
  const updateChat = useUpdateChat()

  return useMutation({
    mutationFn: async ({
      chatId,
      repo,
      baseBranch,
    }: {
      chatId: string
      repo: string
      baseBranch: string
    }) => {
      return updateChat.mutateAsync({ chatId, data: { repo, baseBranch } })
    },
  })
}
