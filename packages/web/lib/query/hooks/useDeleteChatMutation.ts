"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "../keys"
import { deleteChat as apiDeleteChat } from "@/lib/sync/api"
import type { Chat } from "@/lib/types"

/**
 * Deletes a chat and all its descendants.
 * Returns sandbox IDs that need cleanup.
 */
export function useDeleteChatMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (chatId: string) => {
      return apiDeleteChat(chatId)
    },
    onMutate: async (chatId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.chats.list() })

      // Snapshot previous values
      const previousChats = queryClient.getQueryData<Chat[]>(queryKeys.chats.list())

      // Collect all descendant IDs for optimistic removal
      const deletedIds = new Set<string>()
      if (previousChats) {
        const collectDescendants = (id: string) => {
          deletedIds.add(id)
          for (const chat of previousChats) {
            if (chat.parentChatId === id) {
              collectDescendants(chat.id)
            }
          }
        }
        collectDescendants(chatId)

        // Optimistically remove from list
        queryClient.setQueryData<Chat[]>(
          queryKeys.chats.list(),
          previousChats.filter((chat) => !deletedIds.has(chat.id))
        )
      }

      return { previousChats, deletedIds }
    },
    onSuccess: (result) => {
      // Remove individual chat caches
      for (const deletedId of result.deletedChatIds) {
        queryClient.removeQueries({ queryKey: queryKeys.chats.detail(deletedId) })
      }

      // Note: Sandbox cleanup is handled separately by useSandboxDeleteMutation
      // The caller should iterate over result.sandboxIdsToCleanup
    },
    onError: (err, chatId, context) => {
      // Rollback on error
      if (context?.previousChats) {
        queryClient.setQueryData(queryKeys.chats.list(), context.previousChats)
      }
      console.error("Failed to delete chat:", err)
    },
    onSettled: () => {
      // Refetch the list to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.list() })
    },
  })
}
