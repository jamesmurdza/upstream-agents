"use client"

import { AlertTriangle, Loader2, X } from "lucide-react"

interface MobileConflictBarProps {
  isMergeConflict: boolean
  conflictedFilesCount: number
  onAbort?: () => void
  isLoading: boolean
}

export function MobileConflictBar({
  isMergeConflict,
  conflictedFilesCount,
  onAbort,
  isLoading,
}: MobileConflictBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs bg-amber-500/10 border-b border-amber-500/20">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>{isMergeConflict ? "Merge" : "Rebase"} conflict</span>
        {conflictedFilesCount > 0 && (
          <span className="text-amber-500/70">
            ({conflictedFilesCount} files)
          </span>
        )}
      </div>
      <button
        onClick={onAbort}
        disabled={isLoading}
        className="flex items-center gap-1 text-destructive hover:text-destructive/80 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
        Abort
      </button>
    </div>
  )
}
