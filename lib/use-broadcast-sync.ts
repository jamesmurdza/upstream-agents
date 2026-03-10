"use client"

import { useEffect, useRef, useCallback } from "react"
import type { Branch, Message, Repo } from "./types"

// Channel name for cross-window communication
const CHANNEL_NAME = "agenthub:sync"

// Message types for different sync events
export type SyncMessageType =
  | "branch-added"
  | "branch-removed"
  | "branch-updated"
  | "message-added"
  | "message-updated"
  | "repo-added"
  | "repo-removed"
  | "execution-started"
  | "execution-completed"
  | "quota-updated"

export interface SyncMessage {
  type: SyncMessageType
  timestamp: number
  senderId: string
  payload: unknown
}

// Payload types for each message type
export interface BranchAddedPayload {
  repoId: string
  branch: Branch
}

export interface BranchRemovedPayload {
  repoId: string
  branchId: string
}

export interface BranchUpdatedPayload {
  repoId: string
  branchId: string
  updates: Partial<Branch>
  // If the branch ID changed (e.g., from client-side to server-side ID)
  newBranchId?: string
}

export interface MessageAddedPayload {
  repoId: string
  branchId: string
  message: Message
}

export interface MessageUpdatedPayload {
  repoId: string
  branchId: string
  messageId: string
  updates: Partial<Message>
}

export interface RepoAddedPayload {
  repo: Repo
}

export interface RepoRemovedPayload {
  repoId: string
}

export interface ExecutionStartedPayload {
  repoId: string
  branchId: string
  messageId: string
  executionId: string
}

export interface ExecutionCompletedPayload {
  repoId: string
  branchId: string
  status: "completed" | "error"
}

export interface QuotaUpdatedPayload {
  current: number
  max: number
  remaining: number
}

// Generate a unique sender ID for this window/tab
function generateSenderId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

interface UseBroadcastSyncOptions {
  onBranchAdded?: (payload: BranchAddedPayload) => void
  onBranchRemoved?: (payload: BranchRemovedPayload) => void
  onBranchUpdated?: (payload: BranchUpdatedPayload) => void
  onMessageAdded?: (payload: MessageAddedPayload) => void
  onMessageUpdated?: (payload: MessageUpdatedPayload) => void
  onRepoAdded?: (payload: RepoAddedPayload) => void
  onRepoRemoved?: (payload: RepoRemovedPayload) => void
  onExecutionStarted?: (payload: ExecutionStartedPayload) => void
  onExecutionCompleted?: (payload: ExecutionCompletedPayload) => void
  onQuotaUpdated?: (payload: QuotaUpdatedPayload) => void
}

export function useBroadcastSync(options: UseBroadcastSyncOptions = {}) {
  const channelRef = useRef<BroadcastChannel | null>(null)
  const senderIdRef = useRef<string>(generateSenderId())

  // Initialize BroadcastChannel on mount
  useEffect(() => {
    // BroadcastChannel is not available in SSR
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return
    }

    const channel = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = channel

    // Handle incoming messages
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const { type, senderId, payload } = event.data

      // Ignore messages from self
      if (senderId === senderIdRef.current) {
        return
      }

      switch (type) {
        case "branch-added":
          options.onBranchAdded?.(payload as BranchAddedPayload)
          break
        case "branch-removed":
          options.onBranchRemoved?.(payload as BranchRemovedPayload)
          break
        case "branch-updated":
          options.onBranchUpdated?.(payload as BranchUpdatedPayload)
          break
        case "message-added":
          options.onMessageAdded?.(payload as MessageAddedPayload)
          break
        case "message-updated":
          options.onMessageUpdated?.(payload as MessageUpdatedPayload)
          break
        case "repo-added":
          options.onRepoAdded?.(payload as RepoAddedPayload)
          break
        case "repo-removed":
          options.onRepoRemoved?.(payload as RepoRemovedPayload)
          break
        case "execution-started":
          options.onExecutionStarted?.(payload as ExecutionStartedPayload)
          break
        case "execution-completed":
          options.onExecutionCompleted?.(payload as ExecutionCompletedPayload)
          break
        case "quota-updated":
          options.onQuotaUpdated?.(payload as QuotaUpdatedPayload)
          break
      }
    }

    // Cleanup on unmount
    return () => {
      channel.close()
      channelRef.current = null
    }
  }, [
    options.onBranchAdded,
    options.onBranchRemoved,
    options.onBranchUpdated,
    options.onMessageAdded,
    options.onMessageUpdated,
    options.onRepoAdded,
    options.onRepoRemoved,
    options.onExecutionStarted,
    options.onExecutionCompleted,
    options.onQuotaUpdated,
  ])

  // Generic broadcast function
  const broadcast = useCallback((type: SyncMessageType, payload: unknown) => {
    if (!channelRef.current) return

    const message: SyncMessage = {
      type,
      timestamp: Date.now(),
      senderId: senderIdRef.current,
      payload,
    }

    channelRef.current.postMessage(message)
  }, [])

  // Typed broadcast functions for each message type
  const broadcastBranchAdded = useCallback(
    (payload: BranchAddedPayload) => broadcast("branch-added", payload),
    [broadcast]
  )

  const broadcastBranchRemoved = useCallback(
    (payload: BranchRemovedPayload) => broadcast("branch-removed", payload),
    [broadcast]
  )

  const broadcastBranchUpdated = useCallback(
    (payload: BranchUpdatedPayload) => broadcast("branch-updated", payload),
    [broadcast]
  )

  const broadcastMessageAdded = useCallback(
    (payload: MessageAddedPayload) => broadcast("message-added", payload),
    [broadcast]
  )

  const broadcastMessageUpdated = useCallback(
    (payload: MessageUpdatedPayload) => broadcast("message-updated", payload),
    [broadcast]
  )

  const broadcastRepoAdded = useCallback(
    (payload: RepoAddedPayload) => broadcast("repo-added", payload),
    [broadcast]
  )

  const broadcastRepoRemoved = useCallback(
    (payload: RepoRemovedPayload) => broadcast("repo-removed", payload),
    [broadcast]
  )

  const broadcastExecutionStarted = useCallback(
    (payload: ExecutionStartedPayload) => broadcast("execution-started", payload),
    [broadcast]
  )

  const broadcastExecutionCompleted = useCallback(
    (payload: ExecutionCompletedPayload) => broadcast("execution-completed", payload),
    [broadcast]
  )

  const broadcastQuotaUpdated = useCallback(
    (payload: QuotaUpdatedPayload) => broadcast("quota-updated", payload),
    [broadcast]
  )

  return {
    broadcastBranchAdded,
    broadcastBranchRemoved,
    broadcastBranchUpdated,
    broadcastMessageAdded,
    broadcastMessageUpdated,
    broadcastRepoAdded,
    broadcastRepoRemoved,
    broadcastExecutionStarted,
    broadcastExecutionCompleted,
    broadcastQuotaUpdated,
  }
}
