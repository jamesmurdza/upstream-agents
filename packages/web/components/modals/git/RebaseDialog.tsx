"use client"

import { useState, useCallback } from "react"
import { GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Chat } from "@/lib/types"
import type { UseGitDialogsResult } from "./types"
import { BaseDialog } from "./BaseDialog"
import { BranchSelector } from "./BranchSelector"
import { DialogButtons } from "./DialogButtons"

interface RebaseDialogProps {
  open: boolean
  onClose: () => void
  gitDialogs: UseGitDialogsResult
  chat: Chat | null
  isMobile?: boolean
}

export function RebaseDialog({
  open,
  onClose,
  gitDialogs,
  chat,
  isMobile = false,
}: RebaseDialogProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleRebaseAndClose = useCallback(async () => {
    await gitDialogs.handleRebase()
    onClose()
  }, [gitDialogs, onClose])

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title="Rebase Branch"
      icon={<GitBranch className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />}
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
            Rebase
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
            Onto branch
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
            onSubmit={handleRebaseAndClose}
          />
        </div>

        <DialogButtons
          onCancel={onClose}
          onConfirm={handleRebaseAndClose}
          confirmLabel="Rebase"
          confirmDisabled={!gitDialogs.selectedBranch}
          loading={gitDialogs.actionLoading}
          isMobile={isMobile}
        />
      </div>
    </BaseDialog>
  )
}
