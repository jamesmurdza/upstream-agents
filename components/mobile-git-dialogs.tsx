"use client"

import { useState, useCallback, useEffect } from "react"
import type { Branch, Message } from "@/lib/types"
import { Loader2, ArrowUpDown } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { generateId } from "@/lib/store"
import { PATHS } from "@/lib/constants"

interface MobileGitDialogsProps {
  branch: Branch
  repoOwner: string
  repoName: string
  // Dialog open states
  mergeOpen: boolean
  rebaseOpen: boolean
  tagOpen: boolean
  resetOpen: boolean
  // Close handlers
  onMergeClose: () => void
  onRebaseClose: () => void
  onTagClose: () => void
  onResetClose: () => void
  // Message callback
  onAddMessage: (branchId: string, message: Message) => Promise<string>
}

export function MobileGitDialogs({
  branch,
  repoOwner,
  repoName,
  mergeOpen,
  rebaseOpen,
  tagOpen,
  resetOpen,
  onMergeClose,
  onRebaseClose,
  onTagClose,
  onResetClose,
  onAddMessage,
}: MobileGitDialogsProps) {
  // Shared state
  const [remoteBranches, setRemoteBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [branchesLoading, setBranchesLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Merge-specific state
  const [mergeDirection, setMergeDirection] = useState<"into-current" | "from-current">("from-current")

  // Tag-specific state
  const [tagNameInput, setTagNameInput] = useState("")

  // Reset-specific state
  const [resetConfirmText, setResetConfirmText] = useState("")

  const addSystemMessage = useCallback((content: string) => {
    onAddMessage(branch.id, {
      id: generateId(),
      role: "assistant",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    })
  }, [branch.id, onAddMessage])

  const fetchBranches = useCallback(async () => {
    setBranchesLoading(true)
    try {
      const res = await fetch(
        `/api/github/branches?owner=${encodeURIComponent(repoOwner)}&repo=${encodeURIComponent(repoName)}`
      )
      const data = await res.json()
      const branches = (data.branches || []).filter((b: string) => b !== branch.name)
      setRemoteBranches(branches)
      setSelectedBranch(branches.includes(branch.baseBranch) ? branch.baseBranch : branches[0] || "")
    } catch {
      setRemoteBranches([])
    } finally {
      setBranchesLoading(false)
    }
  }, [repoOwner, repoName, branch.name, branch.baseBranch])

  // Fetch branches when merge or rebase dialog opens
  useEffect(() => {
    if (mergeOpen || rebaseOpen) {
      setSelectedBranch("")
      setMergeDirection("from-current")
      fetchBranches()
    }
  }, [mergeOpen, rebaseOpen, fetchBranches])

  // Reset tag input when dialog opens
  useEffect(() => {
    if (tagOpen) {
      setTagNameInput("")
    }
  }, [tagOpen])

  // Reset confirm text when dialog opens
  useEffect(() => {
    if (resetOpen) {
      setResetConfirmText("")
    }
  }, [resetOpen])

  const handleMerge = async () => {
    if (!selectedBranch) return
    setActionLoading(true)

    const sourceBranch = mergeDirection === "from-current" ? branch.name : selectedBranch
    const targetBranch = mergeDirection === "from-current" ? selectedBranch : branch.name

    try {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId: branch.sandboxId,
          repoPath: `${PATHS.SANDBOX_HOME}/${repoName}`,
          action: "merge",
          targetBranch: targetBranch,
          currentBranch: sourceBranch,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addSystemMessage(`Merged **${sourceBranch}** into **${targetBranch}** and pushed.`)
      onMergeClose()
    } catch (err: unknown) {
      addSystemMessage(`Merge failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRebase = async () => {
    if (!selectedBranch) return
    setActionLoading(true)

    try {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId: branch.sandboxId,
          repoPath: `${PATHS.SANDBOX_HOME}/${repoName}`,
          action: "rebase",
          targetBranch: selectedBranch,
          currentBranch: branch.name,
          repoOwner: repoOwner,
          repoApiName: repoName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addSystemMessage(`Rebased **${branch.name}** onto **${selectedBranch}** and force-pushed.`)
      onRebaseClose()
    } catch (err: unknown) {
      addSystemMessage(`Rebase failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleTag = async () => {
    const name = tagNameInput.trim()
    if (!name) return
    setActionLoading(true)

    try {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId: branch.sandboxId,
          repoPath: `${PATHS.SANDBOX_HOME}/${repoName}`,
          action: "tag",
          tagName: name,
          repoOwner: repoOwner,
          repoApiName: repoName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addSystemMessage(`Tag **${name}** created and pushed.`)
      onTagClose()
    } catch (err: unknown) {
      addSystemMessage(`Tag failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReset = async () => {
    setActionLoading(true)

    try {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId: branch.sandboxId,
          repoPath: `${PATHS.SANDBOX_HOME}/${repoName}`,
          action: "reset",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addSystemMessage("Reset to HEAD completed successfully.")
      onResetClose()
    } catch (err: unknown) {
      addSystemMessage(`Reset failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      {/* Merge Dialog */}
      <Dialog open={mergeOpen} onOpenChange={(open) => !open && onMergeClose()}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Merge branches</DialogTitle>
          </DialogHeader>
          {branchesLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : remoteBranches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No other branches found.</p>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {/* Source (top) */}
              {mergeDirection === "from-current" ? (
                <div className="w-full rounded-md bg-muted/50 px-3 py-2 text-sm font-medium text-left truncate">
                  {branch.name}
                </div>
              ) : (
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {remoteBranches.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Arrow with "into" and swap button */}
              <div className="flex items-center justify-between w-full py-1">
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground">into</span>
                <div className="flex-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMergeDirection(prev => prev === "into-current" ? "from-current" : "into-current")}
                    className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    title="Swap merge direction"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Target (bottom) */}
              {mergeDirection === "from-current" ? (
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {remoteBranches.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="w-full rounded-md bg-muted/50 px-3 py-2 text-sm font-medium text-left truncate">
                  {branch.name}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              onClick={onMergeClose}
              className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={!selectedBranch || actionLoading}
              className="cursor-pointer flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              Merge
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rebase Dialog */}
      <Dialog open={rebaseOpen} onOpenChange={(open) => !open && onRebaseClose()}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Rebase {branch.name} onto...</DialogTitle>
          </DialogHeader>
          {branchesLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : remoteBranches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No other branches found.</p>
          ) : (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {remoteBranches.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <button
              onClick={onRebaseClose}
              className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleRebase}
              disabled={!selectedBranch || actionLoading}
              className="cursor-pointer flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              Rebase
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={tagOpen} onOpenChange={(open) => { if (!open) { onTagClose(); setTagNameInput("") } }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Create Tag</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="v1.0.0"
            value={tagNameInput}
            onChange={(e) => setTagNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleTag() }}
            className="h-8 text-xs font-mono"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={() => { onTagClose(); setTagNameInput("") }}
              className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleTag}
              disabled={!tagNameInput.trim() || actionLoading}
              className="cursor-pointer flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Dialog */}
      <Dialog open={resetOpen} onOpenChange={(open) => { if (!open) { onResetClose(); setResetConfirmText("") } }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm text-red-400">Reset to HEAD</DialogTitle>
            <DialogDescription className="text-xs">
              This will discard all uncommitted changes. Type <span className="font-mono font-semibold">reset</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Type 'reset' to confirm"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && resetConfirmText === "reset") handleReset() }}
            className="h-8 text-xs font-mono"
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={() => { onResetClose(); setResetConfirmText("") }}
              className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={resetConfirmText !== "reset" || actionLoading}
              className="cursor-pointer flex items-center gap-1.5 rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              Reset
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
