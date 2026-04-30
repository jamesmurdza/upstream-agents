"use client"

import {
  ChevronDown,
  Github,
  Settings as SettingsIcon,
  Trash2,
  Pencil,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "../ui/input"
import type { ChatHeaderProps } from "./types"

export function ChatHeader({
  chat,
  isMobile,
  // Title editing
  isEditingTitle,
  editTitleValue,
  setEditTitleValue,
  startEditingTitle,
  saveTitle,
  cancelEditingTitle,
  titleInputRef,
  // Menu state
  titleMenuOpen,
  setTitleMenuOpen,
  titleMenuRef,
  // Conflict state
  inConflict,
  isMergeConflict,
  conflictMenuOpen,
  setConflictMenuOpen,
  conflictMenuRef,
  conflictedFiles,
  onAbortConflict,
  conflictActionLoading,
  // Actions
  onOpenSettings,
  onDeleteChat,
  githubBranchUrl,
}: ChatHeaderProps) {
  const chatTitle = chat.displayName || "Untitled"

  // Hide header on mobile
  if (isMobile) return null

  return (
    <div
      className="flex items-center justify-between pt-3"
      style={{ paddingLeft: "1.625rem", paddingRight: "1rem" }}
    >
      <div className="flex items-center gap-2">
        {/* Conflict indicator */}
        {inConflict && (
          <div className="relative" ref={conflictMenuRef}>
            <button
              onClick={() => setConflictMenuOpen(!conflictMenuOpen)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
              title={isMergeConflict ? "Merge conflict" : "Rebase conflict"}
            >
              <AlertTriangle className="h-4 w-4" />
            </button>
            {conflictMenuOpen && (
              <div className="absolute left-0 top-full mt-1 min-w-[220px] rounded-md border border-border bg-popover shadow-md py-1 z-50">
                <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
                  {isMergeConflict ? "Merge" : "Rebase"} conflict in progress
                </div>
                {conflictedFiles && conflictedFiles.length > 0 && (
                  <div className="px-3 py-2 border-b border-border">
                    <div className="text-xs text-muted-foreground mb-1">
                      Conflicted files:
                    </div>
                    <div className="space-y-0.5">
                      {conflictedFiles.slice(0, 5).map((file) => (
                        <div
                          key={file}
                          className="text-xs text-foreground truncate font-mono"
                        >
                          {file}
                        </div>
                      ))}
                      {conflictedFiles.length > 5 && (
                        <div className="text-xs text-muted-foreground">
                          +{conflictedFiles.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    setConflictMenuOpen(false)
                    onAbortConflict?.()
                  }}
                  disabled={conflictActionLoading}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left text-destructive cursor-pointer disabled:opacity-50"
                >
                  {conflictActionLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  {isMergeConflict ? "Abort Merge" : "Abort Rebase"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Title */}
        {isEditingTitle ? (
          <Input
            ref={titleInputRef}
            type="text"
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle()
              if (e.key === "Escape") cancelEditingTitle()
            }}
            onBlur={saveTitle}
            className="w-56 font-medium"
          />
        ) : (
          <div
            className="group/title relative flex items-center gap-[2px]"
            ref={titleMenuRef}
          >
            <button
              onClick={startEditingTitle}
              className="flex h-7 items-center text-sm font-medium text-foreground px-2 rounded-l-md rounded-r-none hover:bg-accent group-hover/title:bg-accent transition-colors cursor-pointer"
              title="Click to rename"
            >
              {chatTitle}
            </button>
            <button
              onClick={() => setTitleMenuOpen(!titleMenuOpen)}
              className="flex h-7 w-6 items-center justify-center rounded-r-md rounded-l-none text-muted-foreground hover:bg-accent hover:text-foreground group-hover/title:bg-accent group-hover/title:text-foreground transition-colors cursor-pointer"
              aria-label="Chat menu"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {titleMenuOpen && (
              <div className="absolute left-0 top-full mt-1 min-w-[180px] rounded-md border border-border bg-popover shadow-md py-1 z-50">
                <button
                  onClick={() => {
                    setTitleMenuOpen(false)
                    startEditingTitle()
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </button>
                {githubBranchUrl && (
                  <button
                    onClick={() => {
                      setTitleMenuOpen(false)
                      window.open(githubBranchUrl, "_blank", "noopener,noreferrer")
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left cursor-pointer"
                  >
                    <Github className="h-3.5 w-3.5" />
                    Open in GitHub
                  </button>
                )}
                <button
                  onClick={() => {
                    setTitleMenuOpen(false)
                    onOpenSettings?.()
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left cursor-pointer"
                >
                  <SettingsIcon className="h-3.5 w-3.5" />
                  Settings
                </button>
                {onDeleteChat && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      onClick={() => {
                        setTitleMenuOpen(false)
                        onDeleteChat()
                      }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left text-destructive cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
