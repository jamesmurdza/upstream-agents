"use client"

import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface DialogButtonsProps {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  confirmDisabled?: boolean
  loading?: boolean
  isMobile?: boolean
  /** Use destructive styling for confirm button */
  destructive?: boolean
}

export function DialogButtons({
  onCancel,
  onConfirm,
  confirmLabel,
  confirmDisabled = false,
  loading = false,
  isMobile = false,
  destructive = false,
}: DialogButtonsProps) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        onClick={onCancel}
        className={cn(
          "rounded-md hover:bg-accent transition-colors",
          isMobile ? "px-4 py-2.5 text-base" : "px-3 py-1.5 text-sm"
        )}
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={confirmDisabled || loading}
        className={cn(
          "rounded-md disabled:opacity-50 flex items-center gap-2",
          isMobile ? "px-4 py-2.5 text-base" : "px-3 py-1.5 text-sm",
          destructive
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  )
}
