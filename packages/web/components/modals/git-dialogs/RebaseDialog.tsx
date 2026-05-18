"use client"

import { useMemo } from "react"
import { GitBranch } from "lucide-react"
import { GitBranchDialog, type GitBranchDialogConfig } from "./GitBranchDialog"
import type { GitDialogProps } from "./types"

export function RebaseDialog({ open, onClose, gitDialogs, chat, isMobile = false }: GitDialogProps) {
  const config = useMemo<GitBranchDialogConfig>(() => ({
    title: "Rebase Branch",
    icon: <GitBranch />,
    sourceLabel: "Rebase",
    targetLabel: "Onto branch",
    actionLabel: "Rebase",
    onAction: gitDialogs.handleRebase,
  }), [gitDialogs.handleRebase])

  return (
    <GitBranchDialog
      open={open}
      onClose={onClose}
      gitDialogs={gitDialogs}
      chat={chat}
      isMobile={isMobile}
      config={config}
    />
  )
}
