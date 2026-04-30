"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { PATHS } from "@/lib/constants"
import { EMPTY_CONFLICT_STATE } from "@upstream/common"
import type {
  UseGitDialogsOptions,
  UseGitDialogsResult,
  PRDescriptionType,
  RebaseConflictState,
} from "./types"

export function useGitDialogs({
  chat,
  onAddMessageToBranch,
  resolveChatName,
  getTargetSandboxId,
  getTargetChatStatus,
  onMarkBranchNeedsSync,
  onSetBaseBranch,
  refetchMessages,
}: UseGitDialogsOptions): UseGitDialogsResult {
  const chatId = chat?.id ?? ""
  const branchName = chat?.branch ?? ""
  const baseBranch = chat?.baseBranch ?? ""
  const sandboxId = chat?.sandboxId ?? ""
  const repo = chat?.repo ?? ""

  // Parse owner/repo from repo string
  const [repoOwner, repoApiName] = repo.includes("/") ? repo.split("/") : ["", ""]

  // Dialog open states
  const [mergeOpen, setMergeOpen] = useState(false)
  const [rebaseOpen, setRebaseOpen] = useState(false)
  const [prOpen, setPROpen] = useState(false)
  const [squashOpen, setSquashOpen] = useState(false)
  const [forcePushOpen, setForcePushOpen] = useState(false)

  // Shared state for branch picker
  const [remoteBranches, setRemoteBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranchState] = useState("")
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Track pre-selected branch from drag-and-drop
  const pendingSelectedBranchRef = useRef<string | null>(null)
  const setSelectedBranch = useCallback(
    (branch: string) => {
      if (mergeOpen || rebaseOpen || prOpen) {
        setSelectedBranchState(branch)
      } else {
        pendingSelectedBranchRef.current = branch
        setSelectedBranchState(branch)
      }
    },
    [mergeOpen, rebaseOpen, prOpen]
  )

  // Merge-specific state
  const [squashMerge, setSquashMerge] = useState(false)

  // Squash-specific state
  const [commitsAhead, setCommitsAhead] = useState(0)
  const [commitsLoading, setCommitsLoading] = useState(false)

  // Conflict state
  const [rebaseConflict, setRebaseConflict] = useState<RebaseConflictState>(
    EMPTY_CONFLICT_STATE
  )

  // Always use "project" as the directory name
  const repoName = "project"

  // Fetch branches when dialog opens
  const fetchBranches = useCallback(async () => {
    if (!repoOwner || !repoApiName) {
      setRemoteBranches([])
      setSelectedBranchState("")
      return
    }

    setBranchesLoading(true)
    try {
      const res = await fetch(
        `/api/github/branches?owner=${encodeURIComponent(repoOwner)}&repo=${encodeURIComponent(repoApiName)}`
      )
      const data = await res.json()
      const branches = (data.branches || [])
        .map((b: { name: string }) => b.name)
        .filter((name: string) => name !== branchName)
      setRemoteBranches(branches)

      const pendingBranch = pendingSelectedBranchRef.current
      pendingSelectedBranchRef.current = null
      const defaultBranch =
        pendingBranch && branches.includes(pendingBranch)
          ? pendingBranch
          : branches.includes(baseBranch)
            ? baseBranch
            : branches[0] || ""
      setSelectedBranchState(defaultBranch)
    } catch {
      setRemoteBranches([])
    } finally {
      setBranchesLoading(false)
    }
  }, [repoOwner, repoApiName, branchName, baseBranch])

  // Fetch branches when dialogs open
  useEffect(() => {
    if (mergeOpen || rebaseOpen || prOpen) {
      setSquashMerge(false)
      fetchBranches()
    }
  }, [mergeOpen, rebaseOpen, prOpen, fetchBranches])

  // Handle merge
  const handleMerge = useCallback(async () => {
    if (!selectedBranch || !branchName || !sandboxId || !chatId) return

    const targetStatus = getTargetChatStatus?.(selectedBranch)
    if (targetStatus === "running") {
      setMergeOpen(false)
      return
    }

    setActionLoading(true)

    const targetSandboxId = getTargetSandboxId?.(selectedBranch) ?? null
    const sourceName = chat?.displayName || branchName
    const targetName = resolveChatName?.(selectedBranch) || selectedBranch

    try {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          repoPath: `${PATHS.SANDBOX_HOME}/${repoName}`,
          action: "merge",
          targetBranch: selectedBranch,
          currentBranch: branchName,
          squash: squashMerge,
          repoOwner,
          repoApiName,
          targetSandboxId,
          chatId,
          sourceName,
          targetName,
        }),
      })

      const data = await res.json()

      if (res.status === 409 && data.conflict && data.inMerge) {
        setRebaseConflict({
          inRebase: false,
          inMerge: true,
          conflictedFiles: data.conflictedFiles || [],
        })
        await refetchMessages?.(chatId)
        setMergeOpen(false)
        return
      }

      if (!res.ok) {
        await refetchMessages?.(chatId)
        setMergeOpen(false)
        return
      }

      if (data.needsSync && onMarkBranchNeedsSync) {
        onMarkBranchNeedsSync(selectedBranch)
      }

      if (!chat?.parentChatId && onSetBaseBranch) {
        onSetBaseBranch(selectedBranch)
      }

      await refetchMessages?.(chatId)
      setMergeOpen(false)
    } catch {
      await refetchMessages?.(chatId)
      setMergeOpen(false)
    } finally {
      setActionLoading(false)
    }
  }, [
    selectedBranch,
    branchName,
    sandboxId,
    chatId,
    repoName,
    repoOwner,
    repoApiName,
    squashMerge,
    getTargetSandboxId,
    getTargetChatStatus,
    onMarkBranchNeedsSync,
    chat?.parentChatId,
    chat?.displayName,
    onSetBaseBranch,
    resolveChatName,
    refetchMessages,
  ])

  // Handle rebase
  const handleRebase = useCallback(async () => {
    if (!selectedBranch || !branchName || !sandboxId || !chatId) return
    setActionLoading(true)

    try {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          repoPath: `${PATHS.SANDBOX_HOME}/${repoName}`,
          action: "rebase",
          targetBranch: selectedBranch,
          currentBranch: branchName,
          repoOwner,
          repoApiName,
          chatId,
        }),
      })

      const data = await res.json()

      if (res.status === 409 && data.conflict) {
        setRebaseConflict({
          inRebase: true,
          inMerge: false,
          conflictedFiles: data.conflictedFiles || [],
        })
        await refetchMessages?.(chatId)
        setRebaseOpen(false)
        return
      }

      if (!res.ok) {
        await refetchMessages?.(chatId)
        setRebaseOpen(false)
        return
      }

      await refetchMessages?.(chatId)
      setRebaseOpen(false)
    } catch {
      await refetchMessages?.(chatId)
      setRebaseOpen(false)
    } finally {
      setActionLoading(false)
    }
  }, [
    selectedBranch,
    branchName,
    sandboxId,
    chatId,
    repoName,
    repoOwner,
    repoApiName,
    refetchMessages,
  ])

  // Handle create PR
  const handleCreatePR = useCallback(
    async (descriptionType: PRDescriptionType = "short") => {
      if (!selectedBranch || !branchName || !repoOwner || !repoApiName || !chatId)
        return
      setActionLoading(true)

      try {
        await fetch("/api/github/pr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner: repoOwner,
            repo: repoApiName,
            head: branchName,
            base: selectedBranch,
            descriptionType,
            chatId,
          }),
        })

        await refetchMessages?.(chatId)
        setPROpen(false)
      } catch {
        await refetchMessages?.(chatId)
        setPROpen(false)
      } finally {
        setActionLoading(false)
      }
    },
    [selectedBranch, branchName, repoOwner, repoApiName, chatId, refetchMessages]
  )

  // Handle force push
  const handleForcePush = useCallback(async () => {
    if (!branchName || !sandboxId || !repoOwner || !repoApiName || !chatId) return
    setActionLoading(true)

    try {
      await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          repoPath: `${PATHS.SANDBOX_HOME}/${repoName}`,
          action: "force-push",
          currentBranch: branchName,
          repoOwner,
          repoApiName,
          chatId,
        }),
      })

      await refetchMessages?.(chatId)
      setForcePushOpen(false)
    } catch {
      await refetchMessages?.(chatId)
      setForcePushOpen(false)
    } finally {
      setActionLoading(false)
    }
  }, [branchName, sandboxId, chatId, repoName, repoOwner, repoApiName, refetchMessages])

  // Handle abort conflict
  const handleAbortConflict = useCallback(async () => {
    if (!sandboxId || !chatId) return
    const isMerge = rebaseConflict.inMerge
    setActionLoading(true)

    try {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          repoPath: `${PATHS.SANDBOX_HOME}/${repoName}`,
          action: isMerge ? "abort-merge" : "abort-rebase",
          chatId,
        }),
      })

      if (!res.ok) {
        await refetchMessages?.(chatId)
        return
      }

      setRebaseConflict(EMPTY_CONFLICT_STATE)
      await refetchMessages?.(chatId)
    } catch {
      await refetchMessages?.(chatId)
    } finally {
      setActionLoading(false)
    }
  }, [sandboxId, chatId, repoName, rebaseConflict.inMerge, refetchMessages])

  // Fetch commits ahead when squash dialog opens
  const fetchCommitsAhead = useCallback(async () => {
    if (!repoOwner || !repoApiName || !baseBranch || !branchName) {
      setCommitsAhead(0)
      return
    }
    setCommitsLoading(true)
    try {
      const res = await fetch("/api/github/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repoOwner,
          repo: repoApiName,
          base: baseBranch,
          head: branchName,
        }),
      })
      const data = await res.json()
      if (res.ok && typeof data.ahead_by === "number") {
        setCommitsAhead(data.ahead_by)
      } else {
        setCommitsAhead(0)
      }
    } catch {
      setCommitsAhead(0)
    } finally {
      setCommitsLoading(false)
    }
  }, [repoOwner, repoApiName, baseBranch, branchName])

  useEffect(() => {
    if (squashOpen) {
      fetchCommitsAhead()
    }
  }, [squashOpen, fetchCommitsAhead])

  // Handle squash
  const handleSquash = useCallback(async () => {
    if (!branchName || !sandboxId || !chatId || commitsAhead < 2) return
    setActionLoading(true)

    try {
      await fetch("/api/github/squash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repoOwner,
          repo: repoApiName,
          head: branchName,
          base: baseBranch,
          sandboxId,
          chatId,
        }),
      })

      await refetchMessages?.(chatId)
      setSquashOpen(false)
    } catch {
      await refetchMessages?.(chatId)
      setSquashOpen(false)
    } finally {
      setActionLoading(false)
    }
  }, [
    branchName,
    sandboxId,
    chatId,
    commitsAhead,
    baseBranch,
    repoOwner,
    repoApiName,
    refetchMessages,
  ])

  // Check rebase status
  const checkRebaseStatus = useCallback(async () => {
    if (!sandboxId) return

    try {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          repoPath: `${PATHS.SANDBOX_HOME}/${repoName}`,
          action: "check-rebase-status",
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setRebaseConflict({
          inRebase: data.inRebase || false,
          inMerge: data.inMerge || false,
          conflictedFiles: data.conflictedFiles || [],
        })
      }
    } catch {
      // Best-effort
    }
  }, [sandboxId, repoName])

  // Check status on mount/sandbox change
  useEffect(() => {
    if (sandboxId) {
      checkRebaseStatus()
    }
  }, [sandboxId, checkRebaseStatus])

  return {
    mergeOpen,
    setMergeOpen,
    rebaseOpen,
    setRebaseOpen,
    prOpen,
    setPROpen,
    squashOpen,
    setSquashOpen,
    forcePushOpen,
    setForcePushOpen,
    remoteBranches,
    selectedBranch,
    setSelectedBranch,
    branchesLoading,
    actionLoading,
    squashMerge,
    setSquashMerge,
    commitsAhead,
    commitsLoading,
    baseBranch,
    branchName,
    branchLabel: (branch: string) => resolveChatName?.(branch) || branch,
    handleMerge,
    handleRebase,
    handleCreatePR,
    handleSquash,
    handleForcePush,
    handleAbortConflict,
    rebaseConflict,
    checkRebaseStatus,
  }
}
