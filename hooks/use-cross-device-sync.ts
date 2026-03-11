"use client"

import { useEffect, useRef, useCallback } from "react"

interface SyncBranch {
  id: string
  name: string
  status: string
  prUrl: string | null
  sandboxStatus: string | null
  lastMessageId: string | null
  lastMessageAt: number | null
}

interface SyncData {
  repoId: string
  timestamp: number
  branches: SyncBranch[]
}

interface UseCrossDeviceSyncOptions {
  repoId: string | null
  enabled?: boolean
  interval?: number // polling interval in ms
  onBranchStatusChange?: (branchId: string, status: string) => void
  onBranchPrUrlChange?: (branchId: string, prUrl: string) => void
  onNewMessage?: (branchId: string, messageId: string) => void
  onBranchAdded?: (branch: SyncBranch) => void
  onBranchRemoved?: (branchId: string) => void
}

export function useCrossDeviceSync({
  repoId,
  enabled = true,
  interval = 5000, // 5 seconds default
  onBranchStatusChange,
  onBranchPrUrlChange,
  onNewMessage,
  onBranchAdded,
  onBranchRemoved,
}: UseCrossDeviceSyncOptions) {
  const lastSyncRef = useRef<SyncData | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const isVisibleRef = useRef(true)

  const sync = useCallback(async () => {
    if (!repoId || !enabled || !isVisibleRef.current) return

    try {
      const res = await fetch(`/api/sync?repoId=${encodeURIComponent(repoId)}`)
      if (!res.ok) return

      const data: SyncData = await res.json()
      const lastSync = lastSyncRef.current

      // Skip first sync (just populate baseline)
      if (!lastSync) {
        lastSyncRef.current = data
        return
      }

      // Compare with last sync to detect changes
      const lastBranchMap = new Map(lastSync.branches.map((b) => [b.id, b]))
      const currentBranchMap = new Map(data.branches.map((b) => [b.id, b]))

      // Check for status changes, PR URL changes, and new messages
      for (const branch of data.branches) {
        const lastBranch = lastBranchMap.get(branch.id)

        if (!lastBranch) {
          // New branch added
          onBranchAdded?.(branch)
          continue
        }

        // Status change
        if (lastBranch.status !== branch.status) {
          onBranchStatusChange?.(branch.id, branch.status)
        }

        // PR URL change
        if (!lastBranch.prUrl && branch.prUrl) {
          onBranchPrUrlChange?.(branch.id, branch.prUrl)
        }

        // New message (different message ID or newer timestamp)
        if (
          branch.lastMessageId &&
          branch.lastMessageId !== lastBranch.lastMessageId
        ) {
          onNewMessage?.(branch.id, branch.lastMessageId)
        }
      }

      // Check for removed branches
      for (const lastBranch of lastSync.branches) {
        if (!currentBranchMap.has(lastBranch.id)) {
          onBranchRemoved?.(lastBranch.id)
        }
      }

      lastSyncRef.current = data
    } catch {
      // Silently fail - network issues are expected
    }
  }, [repoId, enabled, onBranchStatusChange, onBranchPrUrlChange, onNewMessage, onBranchAdded, onBranchRemoved])

  // Handle visibility changes - pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible"

      // If becoming visible, sync immediately
      if (isVisibleRef.current) {
        sync()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [sync])

  // Start/stop polling
  useEffect(() => {
    if (!repoId || !enabled) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      lastSyncRef.current = null
      return
    }

    // Initial sync
    sync()

    // Start polling
    pollingRef.current = setInterval(sync, interval)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [repoId, enabled, interval, sync])

  // Reset baseline when repo changes
  useEffect(() => {
    lastSyncRef.current = null
  }, [repoId])

  return { sync }
}
