"use client"

import { useRef, useCallback } from "react"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Chat } from "@/lib/types"
import type { UseGitDialogsResult } from "./types"
import { BaseDialog } from "./BaseDialog"
import { DialogButtons } from "./DialogButtons"

interface ForcePushDialogProps {
  open: boolean
  onClose: () => void
  gitDialogs: UseGitDialogsResult
  chat: Chat | null
  isMobile?: boolean
}

export function ForcePushDialog({
  open,
  onClose,
  gitDialogs,
  chat,
  isMobile = false,
}: ForcePushDialogProps) {
  const agentRunning = chat?.status === "running"
  const branchLabel = gitDialogs.branchName
    ? gitDialogs.branchLabel(gitDialogs.branchName)
    : ""
  const forcePushButtonRef = useRef<HTMLButtonElement>(null)

  const handleForcePush = useCallback(async () => {
    await gitDialogs.handleForcePush()
  }, [gitDialogs])

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title="Force push"
      icon={
        <AlertTriangle
          className={cn(isMobile ? "h-5 w-5" : "h-4 w-4", "text-amber-500")}
        />
      }
      isMobile={isMobile}
      initialFocusRef={forcePushButtonRef}
    >
      <div className={cn("space-y-5")}>
        <div>
          <label
            className={cn(
              "block text-muted-foreground mb-1",
              isMobile ? "text-sm" : "text-xs"
            )}
          >
            Branch
          </label>
          <div
            className={cn(
              "bg-muted/50 rounded-md px-3 font-medium truncate",
              isMobile ? "py-3 text-base" : "py-2 text-sm"
            )}
          >
            {branchLabel || "No chat"}
          </div>
        </div>

        <p
          className={cn(
            "text-muted-foreground",
            isMobile ? "text-base" : "text-sm"
          )}
        >
          This will overwrite the remote history of{" "}
          <span className="font-semibold text-foreground">{branchLabel}</span>{" "}
          with your local commits. Anyone with the old history will need to
          re-sync.
        </p>

        {agentRunning && (
          <p className={cn("text-amber-500", isMobile ? "text-sm" : "text-xs")}>
            The agent is running on this branch. Wait for it to finish before
            force pushing.
          </p>
        )}

        <DialogButtons
          onCancel={onClose}
          onConfirm={handleForcePush}
          confirmLabel="Force push"
          confirmDisabled={agentRunning || !gitDialogs.branchName}
          loading={gitDialogs.actionLoading}
          isMobile={isMobile}
          destructive
        />
      </div>
    </BaseDialog>
  )
}
