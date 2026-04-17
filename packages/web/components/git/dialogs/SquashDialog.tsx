"use client"

import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface SquashDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchName: string
  baseBranch: string
  commitsAhead: number
  commitsLoading: boolean
  actionLoading: boolean
  onSquash: () => void
  onCancel: () => void
}

export function SquashDialog({
  open,
  onOpenChange,
  branchName,
  baseBranch,
  commitsAhead,
  commitsLoading,
  actionLoading,
  onSquash,
  onCancel,
}: SquashDialogProps) {
  const canSquash = commitsAhead >= 2 && !commitsLoading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Squash commits</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Current branch
            </label>
            <div className="bg-muted/50 rounded-md px-3 py-2 text-sm font-medium truncate">
              {branchName || "No branch"}
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Base branch
            </label>
            <div className="bg-muted/50 rounded-md px-3 py-2 text-sm font-medium truncate">
              {baseBranch || "main"}
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Commits to squash
            </label>
            {commitsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Counting commits...
              </div>
            ) : (
              <div className="bg-muted/50 rounded-md px-3 py-2 text-sm font-medium">
                {commitsAhead} commit{commitsAhead !== 1 ? "s" : ""} ahead of {baseBranch || "main"}
              </div>
            )}
          </div>

          {!commitsLoading && commitsAhead < 2 && (
            <p className="text-xs text-amber-500">
              Need at least 2 commits to squash. This branch has {commitsAhead} commit{commitsAhead !== 1 ? "s" : ""} ahead of {baseBranch || "main"}.
            </p>
          )}

          {canSquash && (
            <p className="text-xs text-muted-foreground">
              This will combine all {commitsAhead} commits into a single commit.
            </p>
          )}
        </div>
        <DialogFooter>
          <button
            onClick={onCancel}
            className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onSquash}
            disabled={!canSquash || actionLoading}
            className="cursor-pointer flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            Squash
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
