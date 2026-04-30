"use client"

import { useState, useCallback } from "react"
import { GitMerge } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Chat } from "@/lib/types"
import type { UseGitDialogsResult } from "./types"
import { BaseDialog } from "./BaseDialog"
import { BranchSelector } from "./BranchSelector"
import { DialogButtons } from "./DialogButtons"

interface MergeDialogProps {
  open: boolean
  onClose: () => void
  gitDialogs: UseGitDialogsResult
  chat: Chat | null
  isMobile?: boolean
}

export function MergeDialog({
  open,
  onClose,
  gitDialogs,
  chat,
  isMobile = false,
}: MergeDialogProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleMergeAndClose = useCallback(async () => {
    await gitDialogs.handleMerge()
    onClose()
  }, [gitDialogs, onClose])

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title="Merge Branch"
      icon={<GitMerge className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />}
      isMobile={isMobile}
      allowOverflow={dropdownOpen}
    >
      <div className={cn("space-y-5")}>
        <div>
          <label
            className={cn(
              "block text-muted-foreground mb-1",
              isMobile ? "text-sm" : "text-xs"
            )}
          >
            From chat
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
            Into chat
          </label>
          <BranchSelector
            autoFocus
            value={gitDialogs.selectedBranch}
            onChange={gitDialogs.setSelectedBranch}
            branches={gitDialogs.remoteBranches}
            loading={gitDialogs.branchesLoading}
            isMobile={isMobile}
            getLabel={gitDialogs.branchLabel}
            onOpenChange={setDropdownOpen}
            onSubmit={handleMergeAndClose}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={gitDialogs.squashMerge}
            onChange={(e) => gitDialogs.setSquashMerge(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span
            className={cn(
              "text-muted-foreground",
              isMobile ? "text-base" : "text-sm"
            )}
          >
            Squash commits
          </span>
        </label>

        <DialogButtons
          onCancel={onClose}
          onConfirm={handleMergeAndClose}
          confirmLabel="Merge"
          confirmDisabled={!gitDialogs.selectedBranch}
          loading={gitDialogs.actionLoading}
          isMobile={isMobile}
        />
      </div>
    </BaseDialog>
  )
}
