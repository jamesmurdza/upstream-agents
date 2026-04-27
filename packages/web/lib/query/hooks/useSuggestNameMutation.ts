"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "../keys"
import { updateChat as apiUpdateChat } from "@/lib/sync/api"
import type { Chat } from "@/lib/types"

interface SuggestNameParams {
  chatId: string
  prompt: string
}

/**
 * Generates a suggested name for a chat based on the first message.
 * This is a "nice-to-have" feature - errors are silently ignored.
 */
export function useSuggestNameMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ chatId, prompt }: SuggestNameParams): Promise<string | null> => {
      const res = await fetch("/api/chat/suggest-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })

      if (!res.ok) {
        // Don't throw - this is non-critical
        return null
      }

      const data = await res.json()
      const name = data.name as string | null

      // If we got a name, persist it to the server
      if (name) {
        await apiUpdateChat(chatId, { displayName: name }).catch(() => {
          // Ignore persistence errors
        })
      }

      return name
    },
    onSuccess: (name, { chatId }) => {
      if (!name) return

      // Update the chat detail cache
      queryClient.setQueryData<Chat>(queryKeys.chats.detail(chatId), (old) =>
        old ? { ...old, displayName: name } : old
      )

      // Update the chats list cache
      queryClient.setQueryData<Chat[]>(queryKeys.chats.list(), (old = []) =>
        old.map((chat) =>
          chat.id === chatId ? { ...chat, displayName: name } : chat
        )
      )
    },
    // No error handling - this is a nice-to-have feature
    retry: 1,
  })
}
