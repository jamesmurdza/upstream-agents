"use client"

import { useState, useCallback } from "react"
import { GitPullRequest, ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Chat } from "@/lib/types"
import type { UseGitDialogsResult, PRDescriptionType } from "./types"
import { BaseDialog } from "./BaseDialog"
import { BranchSelector } from "./BranchSelector"

/** PR description format options */
const PR_DESCRIPTION_TYPES = ["short", "long", "commits", "none"] as const

const DESCRIPTION_TYPE_LABELS: Record<
  PRDescriptionType,
  { label: string; description: string }
> = {
  short: { label: "Short description", description: "AI-generated summary" },
  long: { label: "Long description", description: "AI-generated detailed description" },
  commits: { label: "List of commits", description: "Simple commit list (no AI)" },
  none: { label: "No description", description: "Empty description" },
}

interface PRDialogProps {
  open: boolean
  onClose: () => void
  gitDialogs: UseGitDialogsResult
  chat: Chat | null
  isMobile?: boolean
}

export function PRDialog({
  open,
  onClose,
  gitDialogs,
  chat,
  isMobile = false,
}: PRDialogProps) {
  const isGitHubRepo = chat?.repo && chat.repo !== "__new__"
  const [descriptionType, setDescriptionType] = useState<PRDescriptionType>("short")
  const [descriptionDropdownOpen, setDescriptionDropdownOpen] = useState(false)
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false)

  const handleCreatePRAndClose = useCallback(async () => {
    await gitDialogs.handleCreatePR(descriptionType)
    onClose()
  }, [gitDialogs, descriptionType, onClose])

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      title="Create Pull Request"
      icon={<GitPullRequest className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />}
      isMobile={isMobile}
      allowOverflow={descriptionDropdownOpen || branchDropdownOpen}
    >
      <div className={cn("space-y-5")}>
        {!isGitHubRepo ? (
          <p
            className={cn(
              "text-muted-foreground",
              isMobile ? "text-base" : "text-sm"
            )}
          >
            Pull requests require a GitHub repository. This chat is using a local
            repository.
          </p>
        ) : (
          <>
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
                onOpenChange={setBranchDropdownOpen}
                onSubmit={handleCreatePRAndClose}
              />
            </div>

            {/* Description type selector */}
            <div>
              <label
                className={cn(
                  "block text-muted-foreground mb-1",
                  isMobile ? "text-sm" : "text-xs"
                )}
              >
                Description format
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDescriptionDropdownOpen(!descriptionDropdownOpen)}
                  className={cn(
                    "w-full flex items-center justify-between bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring",
                    isMobile ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
                  )}
                >
                  <span className="text-foreground">
                    {DESCRIPTION_TYPE_LABELS[descriptionType].label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      descriptionDropdownOpen && "rotate-180"
                    )}
                  />
                </button>

                {descriptionDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {PR_DESCRIPTION_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setDescriptionType(type)
                          setDescriptionDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 hover:bg-accent transition-colors",
                          isMobile ? "text-base" : "text-sm",
                          descriptionType === type && "bg-accent"
                        )}
                      >
                        {DESCRIPTION_TYPE_LABELS[type].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p
                className={cn(
                  "text-muted-foreground mt-1",
                  isMobile ? "text-sm" : "text-xs"
                )}
              >
                {DESCRIPTION_TYPE_LABELS[descriptionType].description}
              </p>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className={cn(
              "rounded-md hover:bg-accent transition-colors",
              isMobile ? "px-4 py-2.5 text-base" : "px-3 py-1.5 text-sm"
            )}
          >
            Cancel
          </button>
          {isGitHubRepo && (
            <button
              onClick={handleCreatePRAndClose}
              disabled={!gitDialogs.selectedBranch || gitDialogs.actionLoading}
              className={cn(
                "rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2",
                isMobile ? "px-4 py-2.5 text-base" : "px-3 py-1.5 text-sm"
              )}
            >
              {gitDialogs.actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create PR
            </button>
          )}
        </div>
      </div>
    </BaseDialog>
  )
}
