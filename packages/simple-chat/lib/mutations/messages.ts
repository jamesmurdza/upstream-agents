"use client"

/**
 * TanStack Mutation for Sending Messages
 *
 * This is the most complex mutation - it handles:
 * - Optimistic message insertion (user + assistant placeholder)
 * - Sandbox creation (first message)
 * - File upload
 * - Stream initiation
 * - Error recovery
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { nanoid } from "nanoid"
import { chatKeys } from "@/lib/queries/keys"
import { updateChat as apiUpdateChat } from "@/lib/sync/api"
import type { ChatDetail, ChatListItem } from "@/lib/queries/chats"
import type { Chat, Message } from "@/lib/types"
import { generateBranchName } from "@/lib/utils"

// =============================================================================
// Types
// =============================================================================

interface SendMessageParams {
  chatId: string
  content: string
  agent: string
  model: string
  files?: File[]
  /** Current chat data for status checks */
  chat: {
    messages: Message[]
    sandboxId: string | null
    status: Chat["status"]
  }
}

interface SendMessageResult {
  sandboxId: string
  branch: string | null
  previewUrlPattern: string | null
  backgroundSessionId: string
  uploadedFiles: string[]
  userMessageId: string
  assistantMessageId: string
}

interface SendMessageContext {
  previousDetail?: ChatDetail
  previousList?: ChatListItem[]
  userMessage: Message
  assistantMessage: Message
}

// =============================================================================
// Send Message Mutation
// =============================================================================

/**
 * Mutation to send a message to a chat
 *
 * This handles:
 * 1. Optimistic UI: adds user + assistant messages immediately
 * 2. Server call: orchestrates sandbox-create + file-upload + message-persist + agent-start
 * 3. On success: returns identifiers for stream connection
 * 4. On error: marks assistant message as error
 *
 * The caller is responsible for:
 * - Starting the SSE stream after success (using returned identifiers)
 * - Calling the name suggestion API for first messages
 */
export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation<SendMessageResult, Error, SendMessageParams, SendMessageContext>({
    mutationFn: async ({ chatId, content, agent, model, files, chat }) => {
      // Create message IDs upfront for optimistic update
      const userMessageId = nanoid()
      const assistantMessageId = nanoid()

      const payload = {
        message: content,
        agent,
        model,
        userMessageId,
        assistantMessageId,
        newBranch: chat.sandboxId ? undefined : `agent/${generateBranchName()}`,
      }

      let response: Response
      if (files && files.length > 0) {
        const formData = new FormData()
        formData.append("payload", JSON.stringify(payload))
        files.forEach((file, i) => formData.append(`file-${i}`, file))
        response = await fetch(`/api/chats/${chatId}/messages`, {
          method: "POST",
          body: formData,
        })
      } else {
        response = await fetch(`/api/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || "Failed to send message")
      }

      const data = await response.json()
      return {
        ...data,
        userMessageId,
        assistantMessageId,
      }
    },
    onMutate: async ({ chatId, content, chat }) => {
      // Create optimistic messages
      const userMessage: Message = {
        id: nanoid(),
        role: "user",
        content,
        timestamp: Date.now(),
      }
      const assistantMessage: Message = {
        id: nanoid(),
        role: "assistant",
        content: "",
        timestamp: Date.now() + 1,
        toolCalls: [],
        contentBlocks: [],
      }

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: chatKeys.all })
      await queryClient.cancelQueries({ queryKey: chatKeys.detail(chatId) })

      // Snapshot previous values
      const previousDetail = queryClient.getQueryData<ChatDetail>(chatKeys.detail(chatId))
      const previousList = queryClient.getQueryData<ChatListItem[]>(chatKeys.all)

      // Optimistically update chat detail
      queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (old) => {
        if (!old) return old
        return {
          ...old,
          messages: [...old.messages, userMessage, assistantMessage],
          status: chat.sandboxId ? "running" : "creating",
          lastActiveAt: Date.now(),
        }
      })

      // Optimistically update chat list (status, lastActiveAt)
      queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (old) =>
        old?.map((c) =>
          c.id === chatId
            ? {
                ...c,
                status: chat.sandboxId ? "running" : "creating",
                lastActiveAt: Date.now(),
                messageCount: (c.messageCount ?? 0) + 2,
              }
            : c
        )
      )

      return { previousDetail, previousList, userMessage, assistantMessage }
    },
    onError: (error, { chatId }, context) => {
      // Mark the assistant message as error instead of rolling back completely
      // This gives the user visual feedback about what went wrong
      const errorMessage = error.message || "Unknown error"

      queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (old) => {
        if (!old || !context) return old
        return {
          ...old,
          status: "error",
          errorMessage,
          messages: old.messages.map((m) =>
            m.id === context.assistantMessage.id
              ? { ...m, content: `Error: ${errorMessage}`, isError: true }
              : m
          ),
        }
      })

      queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (old) =>
        old?.map((c) =>
          c.id === chatId
            ? { ...c, status: "error" }
            : c
        )
      )
    },
    onSuccess: (result, { chatId, agent, model }, context) => {
      // Update cache with server-confirmed data
      queryClient.setQueryData<ChatDetail>(chatKeys.detail(chatId), (old) => {
        if (!old || !context) return old
        return {
          ...old,
          sandboxId: result.sandboxId,
          branch: result.branch,
          previewUrlPattern: result.previewUrlPattern ?? undefined,
          backgroundSessionId: result.backgroundSessionId,
          agent,
          model,
          status: "running",
          messages: old.messages.map((m) => {
            // Update user message with uploaded files if present
            if (m.id === context.userMessage.id && result.uploadedFiles.length > 0) {
              return { ...m, uploadedFiles: result.uploadedFiles }
            }
            return m
          }),
        }
      })

      // Update chat list
      queryClient.setQueryData<ChatListItem[]>(chatKeys.all, (old) =>
        old?.map((c) =>
          c.id === chatId
            ? {
                ...c,
                sandboxId: result.sandboxId,
                branch: result.branch,
                agent,
                model,
                status: "running",
              }
            : c
        )
      )
    },
  })
}

// =============================================================================
// Generate Chat Name (Fire-and-Forget)
// =============================================================================

/**
 * Generate and set a chat name based on the first message
 *
 * This is a fire-and-forget operation - errors are logged but not surfaced.
 */
export async function generateChatName(chatId: string, prompt: string) {
  try {
    const res = await fetch("/api/chat/suggest-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json()
    if (data.name) {
      // Update via API
      await apiUpdateChat(chatId, { displayName: data.name })
      // Note: Cache will be updated via the update mutation or SSE
    }
  } catch (err) {
    console.error("Failed to generate chat name:", err)
  }
}
