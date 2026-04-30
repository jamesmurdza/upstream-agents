"use client"

import { useCallback, useRef, useEffect } from "react"
import { Modal, ModalButtons } from "@/components/ui/modal"

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  isMobile?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isMobile = false,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  const handleConfirm = useCallback(() => {
    onConfirm()
    onClose()
  }, [onConfirm, onClose])

  // Focus the confirm button when modal opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure the modal is fully rendered
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      isMobile={isMobile}
      maxWidth="max-w-sm"
      initialFocusRef={confirmButtonRef}
      contentPadding="px-4 pt-3 pb-4"
    >
      <div className="space-y-4 text-sm">
        {description && (
          <div className="text-muted-foreground">{description}</div>
        )}
        <ModalButtons
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          variant={variant}
          isMobile={isMobile}
          confirmRef={confirmButtonRef}
        />
      </div>
    </Modal>
  )
}
