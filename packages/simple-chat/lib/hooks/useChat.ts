"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { nanoid } from "nanoid"
import { useSession } from "next-auth/react"
import type { AppState, Chat, Message, Settings, SSEUpdateEvent, SSECompleteEvent } from "@/lib/types"
import { NEW_REPOSITORY } from "@/lib/types"
import {
  loadState,
  saveState,
  createChat,
  updateChat,
  deleteChat as deleteStoredChat,
  setCurrentChat,
  addMessage,
  updateLastMessage,
  updateMessage,
  updateSettings as updateStoredSettings,
} from "@/lib/storage"
import { generateBranchName } from "@/lib/utils"

// SSE reconnection settings
const SSE_RECONNECT_DELAY = 1000 // 1 second delay before reconnecting
const SSE_MAX_RECONNECT_ATTEMPTS = 10

// Default empty state for SSR
const DEFAULT_STATE: AppState = {
  currentChatId: null,
  chats: [],
  settings: {
    anthropicApiKey: "",
    openaiApiKey: "",
    opencodeApiKey: "",
    geminiApiKey: "",
    defaultAgent: "opencode",
    defaultModel: "opencode/big-pickle",
    theme: "system",
  },
}

export function useChat() {
  const { data: session } = useSession()

  // Start with empty state to avoid hydration mismatch
  const [state, setState] = useState<AppState>(DEFAULT_STATE)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from localStorage after mount (client-side only)
  useEffect(() => {
    setState(loadState())
    setIsHydrated(true)
  }, [])

  // SSE connection ref
  const eventSourceRef = useRef<EventSource | null>(null)
  const isStreamingRef = useRef(false)
  // Track cursor for reconnection
  const cursorRef = useRef(0)
  // Track reconnection attempts
  const reconnectAttemptsRef = useRef(0)
  // Store connection params for reconnection
  const connectionParamsRef = useRef<{
    chatId: string
    sandboxId: string
    repoName: string
    backgroundSessionId: string
    previewUrlPattern?: string
  } | null>(null)
  // Accumulated content for current streaming session (resets when new agent run starts)
  const accumulatedContentRef = useRef<{
    content: string
    toolCalls: Message["toolCalls"]
    contentBlocks: Message["contentBlocks"]
  }>({ content: "", toolCalls: [], contentBlocks: [] })

  // Sync state to localStorage (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      saveState(state)
    }
  }, [state, isHydrated])

  // Get current chat
  const currentChat = state.chats.find((c) => c.id === state.currentChatId) ?? null

  // =============================================================================
  // Chat Operations
  // =============================================================================

  const startNewChat = useCallback((repo: string = NEW_REPOSITORY, baseBranch: string = "main") => {
    const chat: Chat = {
      id: nanoid(),
      repo,
      baseBranch,
      branch: null,
      sandboxId: null,
      sessionId: null,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      displayName: null,
      status: "pending",
    }

    const newState = createChat(chat)
    setState(newState)

    return chat.id
  }, [])

  const selectChat = useCallback((chatId: string) => {
    const newState = setCurrentChat(chatId)
    setState(newState)
  }, [])

  // Track which chats are being deleted (for fade animation)
  const [deletingChatIds, setDeletingChatIds] = useState<Set<string>>(new Set())

  const removeChat = useCallback(async (chatId: string) => {
    // Get the chat before deleting to access sandboxId
    const chat = state.chats.find((c) => c.id === chatId)

    // Stop SSE stream if this is the current chat
    if (eventSourceRef.current && state.currentChatId === chatId) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      isStreamingRef.current = false
      connectionParamsRef.current = null
    }

    // Mark as deleting (grays out the item)
    setDeletingChatIds((prev) => new Set([...prev, chatId]))

    // Delete sandbox if it exists
    if (chat?.sandboxId) {
      try {
        await fetch("/api/sandbox/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId: chat.sandboxId }),
        })
      } catch (error) {
        console.error("Failed to delete sandbox:", error)
        // Continue with chat deletion even if sandbox deletion fails
      }
    }

    // Delete the chat immediately after sandbox deletion completes
    const newState = deleteStoredChat(chatId)
    setState(newState)
    setDeletingChatIds((prev) => {
      const next = new Set(prev)
      next.delete(chatId)
      return next
    })
  }, [state.chats, state.currentChatId])

  // Update repo for a chat (only allowed before first message)
  const updateChatRepo = useCallback((chatId: string, repo: string, baseBranch: string) => {
    const chat = state.chats.find((c) => c.id === chatId)
    if (!chat) return

    // Can select/change existing repo only before first message and sandbox creation
    const canSelectRepo = chat.messages.length === 0 && !chat.sandboxId
    // Can assign a new repo (after creating it) if chat was started without a repo
    const canAssignNewRepo = chat.repo === NEW_REPOSITORY && repo !== NEW_REPOSITORY

    if (!canSelectRepo && !canAssignNewRepo) {
      // Can't change repo in other cases
      return
    }

    const newState = updateChat(chatId, { repo, baseBranch })
    setState(newState)
  }, [state.chats])

  // =============================================================================
  // Settings
  // =============================================================================

  const updateSettings = useCallback((settings: Partial<Settings>) => {
    const newState = updateStoredSettings(settings)
    setState(newState)
  }, [])

  // Update the current chat
  const updateCurrentChat = useCallback((updates: Partial<Chat>) => {
    if (!state.currentChatId) return
    const newState = updateChat(state.currentChatId, updates)
    setState(newState)
  }, [state.currentChatId])

  // Rename a chat
  const renameChat = useCallback((chatId: string, newName: string) => {
    const newState = updateChat(chatId, { displayName: newName })
    setState(newState)
  }, [])

  // =============================================================================
  // Messaging
  // =============================================================================

  const sendMessage = useCallback(async (content: string, agent?: string, model?: string, files?: File[]) => {
    if (!currentChat) return

    // For GitHub repos, we need auth. For NEW_REPOSITORY, we don't.
    const isNewRepo = currentChat.repo === NEW_REPOSITORY
    if (!isNewRepo && !session?.accessToken) return

    const chat = currentChat
    // Check if this is the first message (for auto-naming)
    const isFirstMessage = chat.messages.length === 0

    // Get API keys from settings
    const { anthropicApiKey, openaiApiKey, opencodeApiKey, geminiApiKey } = state.settings

    // Use provided agent/model or fall back to chat/settings defaults
    const selectedAgent = agent || chat.agent || state.settings.defaultAgent
    const selectedModel = model || chat.model || state.settings.defaultModel

    // 1. Add user message
    const userMessage: Message = {
      id: nanoid(),
      role: "user",
      content,
      timestamp: Date.now(),
    }

    let newState = addMessage(chat.id, userMessage)
    setState(newState)

    // 2. If no sandbox, create one (first message)
    let sandboxId = chat.sandboxId
    let branch = chat.branch
    let previewUrlPattern: string | undefined

    if (!sandboxId) {
      // Generate branch name
      branch = generateBranchName()

      // Update chat status
      newState = updateChat(chat.id, { status: "creating", branch })
      setState(newState)

      try {
        const response = await fetch("/api/sandbox/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo: chat.repo,
            baseBranch: chat.baseBranch || "main",
            newBranch: branch,
            // Pass API key if configured (optional for OpenCode)
            ...(anthropicApiKey && { anthropicApiKey }),
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create sandbox")
        }

        const data = await response.json()
        sandboxId = data.sandboxId
        previewUrlPattern = data.previewUrlPattern

        newState = updateChat(chat.id, {
          sandboxId,
          branch,
          previewUrlPattern,
          status: "ready",
        })
        setState(newState)
      } catch (error) {
        console.error("Failed to create sandbox:", error)

        // Add error message
        const errorMessage: Message = {
          id: nanoid(),
          role: "assistant",
          content: `Failed to create sandbox: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: Date.now(),
        }
        newState = addMessage(chat.id, errorMessage)
        newState = updateChat(chat.id, { status: "error" })
        setState(newState)
        return
      }
    }

    // Always use "project" as the directory name - sandbox/create always uses this
    const repoName = "project"

    // 3. Upload files if any (now that sandbox exists)
    let uploadedFilePaths: string[] | undefined
    if (files && files.length > 0) {
      try {
        const formData = new FormData()
        formData.append("sandboxId", sandboxId!)
        formData.append("repoPath", `/home/daytona/${repoName}`)

        files.forEach((file, index) => {
          formData.append(`file-${index}`, file)
        })

        const uploadResponse = await fetch("/api/sandbox/upload", {
          method: "POST",
          body: formData,
        })

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json().catch(() => ({ error: "Upload failed" }))
          throw new Error(error.message || error.error || "Failed to upload files")
        }

        const uploadResult = await uploadResponse.json()
        uploadedFilePaths = uploadResult.uploadedFiles.map((f: { path: string }) => f.path)

        // Update user message with uploaded file paths
        newState = updateMessage(chat.id, userMessage.id, { uploadedFiles: uploadedFilePaths })
        setState(newState)
      } catch (error) {
        console.error("Failed to upload files:", error)
        // Continue without files - add warning to message
        const errorMessage: Message = {
          id: nanoid(),
          role: "assistant",
          content: `Warning: Failed to upload files: ${error instanceof Error ? error.message : "Unknown error"}. Continuing without files.`,
          timestamp: Date.now(),
        }
        newState = addMessage(chat.id, errorMessage)
        setState(newState)
      }
    }

    // 4. Execute agent
    newState = updateChat(chat.id, { status: "running" })
    setState(newState)

    // Add placeholder assistant message
    const assistantMessage: Message = {
      id: nanoid(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      toolCalls: [],
    }
    newState = addMessage(chat.id, assistantMessage)
    setState(newState)

    // Build prompt with uploaded files info if any
    let agentPrompt = content
    if (uploadedFilePaths && uploadedFilePaths.length > 0) {
      agentPrompt += "\n\n---\nUploaded files:\n" + uploadedFilePaths.map(p => `- ${p}`).join("\n")
    }

    try {
      const response = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          sessionId: chat.sessionId,  // Pass existing session ID for conversation continuity
          prompt: agentPrompt,
          repoName,
          previewUrlPattern: previewUrlPattern || chat.previewUrlPattern,
          agent: selectedAgent,
          model: selectedModel,
          // Pass API keys
          ...(anthropicApiKey && { anthropicApiKey }),
          ...(openaiApiKey && { openaiApiKey }),
          ...(opencodeApiKey && { opencodeApiKey }),
          ...(geminiApiKey && { geminiApiKey }),
        }),
      })

      if (!response.ok) {
        const error = await response.json()

        // Handle sandbox not found - need to recreate
        if (error.error === "SANDBOX_NOT_FOUND") {
          newState = updateChat(chat.id, { sandboxId: null, status: "pending" })
          setState(newState)
          // Retry by calling sendMessage again
          return sendMessage(content)
        }

        throw new Error(error.error || "Failed to execute agent")
      }

      // Get the backgroundSessionId from the response
      const executeData = await response.json()
      const { backgroundSessionId } = executeData

      // 4. Start SSE streaming for status
      startStreaming(chat.id, sandboxId!, repoName, backgroundSessionId, previewUrlPattern || chat.previewUrlPattern)

      // 5. Generate chat name from first message (fire-and-forget)
      if (isFirstMessage) {
        fetch("/api/chat/suggest-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: content }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.name) {
              const updated = updateChat(chat.id, { displayName: data.name })
              setState(updated)
            }
          })
          .catch((err) => {
            console.error("Failed to generate chat name:", err)
          })
      }
    } catch (error) {
      console.error("Failed to execute agent:", error)

      newState = updateLastMessage(chat.id, {
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      })
      newState = updateChat(chat.id, { status: "error" })
      setState(newState)
    }
  }, [currentChat, session?.accessToken, state.settings])

  // =============================================================================
  // SSE Streaming
  // =============================================================================

  const startStreaming = useCallback((
    chatId: string,
    sandboxId: string,
    repoName: string,
    backgroundSessionId: string,
    previewUrlPattern?: string
  ) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    isStreamingRef.current = true
    // Reset for new streaming session
    cursorRef.current = 0
    reconnectAttemptsRef.current = 0
    accumulatedContentRef.current = { content: "", toolCalls: [], contentBlocks: [] }

    // Store params for reconnection
    connectionParamsRef.current = {
      chatId,
      sandboxId,
      repoName,
      backgroundSessionId,
      previewUrlPattern,
    }

    const connect = (cursor: number = 0) => {
      if (!isStreamingRef.current) return

      const params = new URLSearchParams({
        sandboxId,
        repoName,
        backgroundSessionId,
      })
      if (previewUrlPattern) {
        params.set("previewUrlPattern", previewUrlPattern)
      }
      if (cursor > 0) {
        params.set("cursor", cursor.toString())
      }

      const eventSource = new EventSource(`/api/agent/stream?${params}`)
      eventSourceRef.current = eventSource

      eventSource.addEventListener("update", (event) => {
        try {
          const data: SSEUpdateEvent = JSON.parse(event.data)

          // Update cursor for reconnection
          cursorRef.current = data.cursor
          // Reset reconnect attempts on successful message
          reconnectAttemptsRef.current = 0

          // Accumulate content (server sends incremental updates)
          const acc = accumulatedContentRef.current
          acc.content += data.content
          acc.toolCalls = [...(acc.toolCalls || []), ...(data.toolCalls || [])]
          acc.contentBlocks = [...(acc.contentBlocks || []), ...(data.contentBlocks || [])]

          // Update message with accumulated content
          const newState = updateLastMessage(chatId, {
            content: acc.content,
            toolCalls: acc.toolCalls,
            contentBlocks: acc.contentBlocks,
          })
          setState(newState)
        } catch (err) {
          console.error("Failed to parse SSE update event:", err)
        }
      })

      eventSource.addEventListener("complete", async (event) => {
        try {
          const data: SSECompleteEvent = JSON.parse(event.data)

          // Clean up
          isStreamingRef.current = false
          eventSource.close()
          eventSourceRef.current = null
          connectionParamsRef.current = null

          // Store sessionId for conversation continuity
          const updates: Partial<Chat> = { status: data.status === "error" ? "error" : "ready" }
          if (data.sessionId) {
            updates.sessionId = data.sessionId
          }
          const newState = updateChat(chatId, updates)
          setState(newState)

          // Auto-push on completion (only for GitHub repos, not NEW_REPOSITORY)
          if (data.status === "completed") {
            const chat = loadState().chats.find((c) => c.id === chatId)
            if (chat?.branch && chat.repo !== NEW_REPOSITORY) {
              try {
                await fetch("/api/git/push", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sandboxId,
                    repoName,
                    branch: chat.branch,
                  }),
                })
              } catch (error) {
                console.error("Failed to auto-push:", error)
              }
            }
          }
        } catch (err) {
          console.error("Failed to parse SSE complete event:", err)
        }
      })

      eventSource.addEventListener("heartbeat", (event) => {
        try {
          const data = JSON.parse(event.data)
          // Update cursor from heartbeat
          cursorRef.current = data.cursor
          // Reset reconnect attempts on heartbeat
          reconnectAttemptsRef.current = 0
        } catch (err) {
          console.error("Failed to parse SSE heartbeat:", err)
        }
      })

      eventSource.addEventListener("error", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data)
          console.error("SSE error event:", data.error)

          // Clean up and update status
          isStreamingRef.current = false
          eventSource.close()
          eventSourceRef.current = null
          connectionParamsRef.current = null

          const newState = updateChat(chatId, { status: "error" })
          setState(newState)
        } catch {
          // This is a connection error, not a server-sent error event
          // Attempt reconnection
        }
      })

      eventSource.onerror = () => {
        // Connection error - attempt reconnection
        eventSource.close()
        eventSourceRef.current = null

        if (!isStreamingRef.current) return

        reconnectAttemptsRef.current += 1

        if (reconnectAttemptsRef.current <= SSE_MAX_RECONNECT_ATTEMPTS) {
          console.log(`SSE connection lost, reconnecting (attempt ${reconnectAttemptsRef.current})...`)
          setTimeout(() => {
            if (isStreamingRef.current && connectionParamsRef.current) {
              connect(cursorRef.current)
            }
          }, SSE_RECONNECT_DELAY)
        } else {
          console.error("SSE max reconnection attempts reached")
          isStreamingRef.current = false
          connectionParamsRef.current = null

          // Update chat status
          const currentState = loadState()
          const existingChat = currentState.chats.find((c) => c.id === chatId)
          if (existingChat && existingChat.status === "running") {
            const newState = updateChat(chatId, { status: "ready" })
            setState(newState)
          }
        }
      }
    }

    // Start initial connection
    connect()
  }, [])

  const stopAgent = useCallback(() => {
    // Close SSE connection - the agent will continue in background but we won't show updates
    isStreamingRef.current = false
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    connectionParamsRef.current = null

    if (currentChat) {
      const newState = updateChat(currentChat.id, { status: "ready" })
      setState(newState)
    }
  }, [currentChat])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  // Add a message to a specific chat (used by git dialogs for system messages)
  const addMessageToChat = useCallback((chatId: string, message: Message) => {
    const newState = addMessage(chatId, message)
    setState(newState)
  }, [])

  return {
    // State
    chats: state.chats,
    currentChat,
    currentChatId: state.currentChatId,
    settings: state.settings,
    isHydrated,
    deletingChatIds,

    // Actions
    startNewChat,
    selectChat,
    removeChat,
    renameChat,
    updateChatRepo,
    updateCurrentChat,
    sendMessage,
    stopAgent,
    updateSettings,
    addMessage: addMessageToChat,
  }
}
