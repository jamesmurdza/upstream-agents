"use client"

import { useRef, useCallback } from "react"
import { GitCommitVertical, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Chat } from "@/lib/types"
import type { UseGitDialogsResult } from "./types"
import { BaseDialog } from "./BaseDialog"
import { DialogButtons } from "./DialogButtons"

interface SquashDialogProps {
  open: boolean
  onClose: () => void
  gitDialogs: UseGitDialogsResult
  chat: Chat | null
  isMobile?: boolean
}

export function SquashDialog({
  open,
  onClose,
  gitDialogs,
  chat,
  isMobile = false,
}: SquashDialogProps) {
  const canSquash = gitDialogs.commitsAhead >= 2 && !gitDialogs.commitsLoading
  const squashButtonRef = useRef<HTMLButtonElement>(null)

  const handleSquashAndClose = useCallback(async () => {
    await gitDialogs.handleSquash()
    onClose()
  }, [gitDialogs, onClose])

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title="Squash Commits"
      icon={<GitCommitVertical className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />}
      isMobile={isMobile}
      initialFocusRef={squashButtonRef}
    >
      <div className={cn("space-y-5")}>
        <div>
          <label
            className={cn(
              "block text-muted-foreground mb-1",
              isMobile ? "text-sm" : "text-xs"
            )}
          >
            Current branch
          </label>
          <div
            className={cn(
              "bg-muted/50 rounded-md px-3 font-medium truncate",
              isMobile ? "py-3 text-base" : "py-2 text-sm"
            )}
          >
            {gitDialogs.branchName
              ? gitDialogs.branchLabel(gitDialogs.branchName)
              : "No chat"}
          </div>
        </div>

        <div>
          <label
            className={cn(
              "block text-muted-foreground mb-1",
              isMobile ? "text-sm" : "text-xs"
            )}
          >
            Base branch
          </label>
          <div
            className={cn(
              "bg-muted/50 rounded-md px-3 font-medium truncate",
              isMobile ? "py-3 text-base" : "py-2 text-sm"
            )}
          >
            {gitDialogs.baseBranch || "main"}
          </div>
        </div>

        <div>
          <label
            className={cn(
              "block text-muted-foreground mb-1",
              isMobile ? "text-sm" : "text-xs"
            )}
          >
            Commits to squash
          </label>
          {gitDialogs.commitsLoading ? (
            <div
              className={cn(
                "flex items-center gap-2 text-muted-foreground",
                isMobile ? "py-3 text-base" : "py-2 text-sm"
              )}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Counting commits...
            </div>
          ) : (
            <div
              className={cn(
                "bg-muted/50 rounded-md px-3 font-medium",
                isMobile ? "py-3 text-base" : "py-2 text-sm"
              )}
            >
              {gitDialogs.commitsAhead} commit
              {gitDialogs.commitsAhead !== 1 ? "s" : ""} ahead of{" "}
              {gitDialogs.baseBranch || "main"}
            </div>
          )}
        </div>

        {!gitDialogs.commitsLoading && gitDialogs.commitsAhead < 2 && (
          <p className={cn("text-amber-500", isMobile ? "text-sm" : "text-xs")}>
            Need at least 2 commits to squash.
          </p>
        )}

        {canSquash && (
          <p
            className={cn(
              "text-muted-foreground",
              isMobile ? "text-sm" : "text-xs"
            )}
          >
            This will combine all {gitDialogs.commitsAhead} commits into a single
            commit.
          </p>
        )}

        <DialogButtons
          onCancel={onClose}
          onConfirm={handleSquashAndClose}
          confirmLabel="Squash"
          confirmDisabled={!canSquash}
          loading={gitDialogs.actionLoading}
          isMobile={isMobile}
        />
      </div>
    </BaseDialog>
  )
}
