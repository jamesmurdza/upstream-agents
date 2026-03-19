import { useState, useEffect, useRef, useMemo } from "react"
import type { Repo } from "@/lib/types"

interface RepoFromUrl {
  owner: string
  name: string
}

interface UseBranchSelectionOptions {
  repos: Repo[]
  loaded: boolean
  repoFromUrl?: RepoFromUrl | null
}

/**
 * Manages active repo/branch selection state with auto-selection on load
 * Supports URL-based repo selection via repoFromUrl parameter
 */
export function useBranchSelection({ repos, loaded, repoFromUrl }: UseBranchSelectionOptions) {
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null)
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)

  // Track if we've done the initial URL-based selection
  const initialSelectionDoneRef = useRef(false)

  // Keep a ref for accessing current value in callbacks without dependency
  const activeBranchIdRef = useRef(activeBranchId)
  activeBranchIdRef.current = activeBranchId

  // Handle URL-based repo selection on initial load
  useEffect(() => {
    if (!loaded || repos.length === 0) return

    // If URL specifies a repo, try to select it
    if (repoFromUrl && !initialSelectionDoneRef.current) {
      const matchingRepo = repos.find(
        (r) =>
          r.owner.toLowerCase() === repoFromUrl.owner.toLowerCase() &&
          r.name.toLowerCase() === repoFromUrl.name.toLowerCase()
      )

      if (matchingRepo) {
        setActiveRepoId(matchingRepo.id)
        setActiveBranchId(matchingRepo.branches[0]?.id ?? null)
        initialSelectionDoneRef.current = true
        return
      }
      // If URL repo not found, we'll fall through to default selection
      // The parent component should handle redirecting to /
    }

    // Auto-select first repo/branch on load if nothing selected
    const currentRepo = activeRepoId ? repos.find((r) => r.id === activeRepoId) : null
    const currentBranch =
      currentRepo && activeBranchId
        ? currentRepo.branches.find((b) => b.id === activeBranchId)
        : null

    if (currentRepo && currentBranch) {
      initialSelectionDoneRef.current = true
      return
    }

    // Valid repo selected but no branch (e.g. just added repo) — only fix branch, don't change repo
    if (currentRepo) {
      setActiveBranchId(currentRepo.branches[0]?.id ?? null)
      initialSelectionDoneRef.current = true
      return
    }

    // No valid selection, select first repo
    setActiveRepoId(repos[0].id)
    if (repos[0].branches.length > 0) {
      setActiveBranchId(repos[0].branches[0].id)
    } else {
      setActiveBranchId(null)
    }
    initialSelectionDoneRef.current = true
  }, [loaded, repos, activeRepoId, activeBranchId, repoFromUrl])

  // Sync selection when URL changes (for browser back/forward)
  useEffect(() => {
    if (!loaded || repos.length === 0 || !initialSelectionDoneRef.current) return
    if (!repoFromUrl) return // URL is at root, don't change selection

    const matchingRepo = repos.find(
      (r) =>
        r.owner.toLowerCase() === repoFromUrl.owner.toLowerCase() &&
        r.name.toLowerCase() === repoFromUrl.name.toLowerCase()
    )

    if (matchingRepo && matchingRepo.id !== activeRepoId) {
      setActiveRepoId(matchingRepo.id)
      setActiveBranchId(matchingRepo.branches[0]?.id ?? null)
    }
  }, [repoFromUrl, repos, loaded, activeRepoId])

  // Computed values
  const activeRepo = useMemo(
    () => repos.find((r) => r.id === activeRepoId) ?? null,
    [repos, activeRepoId]
  )

  const activeBranch = useMemo(
    () => (activeBranchId && activeRepo
      ? activeRepo.branches.find((b) => b.id === activeBranchId) ?? null
      : null),
    [activeBranchId, activeRepo]
  )

  // Selection handlers
  function selectRepo(repoId: string) {
    setActiveRepoId(repoId)
    const repo = repos.find((r) => r.id === repoId)
    setActiveBranchId(repo?.branches[0]?.id ?? null)
  }

  function selectBranch(branchId: string) {
    setActiveBranchId(branchId)
  }

  // Update activeBranchId when the branch ID changes (e.g., during branch creation)
  function updateActiveBranchId(oldId: string, newId: string) {
    if (activeBranchIdRef.current === oldId) {
      setActiveBranchId(newId)
    }
  }

  return {
    // State
    activeRepoId,
    activeBranchId,
    activeBranchIdRef,

    // Computed
    activeRepo,
    activeBranch,

    // Setters
    setActiveRepoId,
    setActiveBranchId,

    // Actions
    selectRepo,
    selectBranch,
    updateActiveBranchId,
  }
}

export type BranchSelection = ReturnType<typeof useBranchSelection>
