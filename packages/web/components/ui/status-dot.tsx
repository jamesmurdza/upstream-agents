/**
 * StatusDot - Visual indicator for branch/sandbox status
 * Shows loading spinner, unread indicator, error state, or stopped state
 */

import { Loader2 } from "lucide-react"
import { BRANCH_STATUS, type BranchStatus } from "@/lib/shared/constants"

interface StatusDotProps {
  /** Current status of the branch/sandbox */
  status: BranchStatus
  /** Whether there are unread messages */
  unread?: boolean
  /** Whether this branch is currently active/selected */
  isActive?: boolean
  /** Size variant for the component */
  size?: "sm" | "default"
}

/**
 * Displays a status indicator dot or spinner based on branch state
 *
 * States:
 * - running/creating: Shows animated spinner
 * - unread (when not active): Shows solid dot
 * - error: Shows red dot
 * - stopped: Shows faded dot
 * - idle: Shows empty space (maintains layout)
 */
export function StatusDot({
  status,
  unread = false,
  isActive = false,
  size = "default",
}: StatusDotProps) {
  const containerClass =
    size === "sm"
      ? "flex h-3.5 w-3.5 shrink-0 items-center justify-center"
      : "flex h-4 w-4 shrink-0 items-center justify-center"

  const spinnerClass =
    size === "sm"
      ? "h-3 w-3 animate-spin text-primary"
      : "h-4 w-4 animate-spin text-primary"

  const dotClass =
    size === "sm" ? "h-1.5 w-1.5 rounded-full" : "h-2 w-2 rounded-full"

  // Running or creating - show spinner
  if (status === BRANCH_STATUS.RUNNING || status === BRANCH_STATUS.CREATING) {
    return (
      <span className={containerClass}>
        <Loader2 className={spinnerClass} />
      </span>
    )
  }

  // Unread messages (only show when not active)
  if (unread && !isActive) {
    return (
      <span className={containerClass}>
        <span className={`${dotClass} bg-foreground`} />
      </span>
    )
  }

  // Error state
  if (status === BRANCH_STATUS.ERROR) {
    return (
      <span className={containerClass}>
        <span className={`${dotClass} bg-red-400`} />
      </span>
    )
  }

  // Stopped state
  if (status === BRANCH_STATUS.STOPPED) {
    return (
      <span className={containerClass}>
        <span className={`${dotClass} bg-muted-foreground/30`} />
      </span>
    )
  }

  // Idle - empty space to maintain layout
  return <span className={size === "sm" ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0"} />
}
