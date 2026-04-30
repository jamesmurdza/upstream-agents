"use client"

import { useRef, useState, useCallback } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import { ModalHeader, focusChatPrompt } from "./modal-header"

const SWIPE_THRESHOLD = 100

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when the modal is closed */
  onClose: () => void
  /** Title displayed in the modal header */
  title: React.ReactNode
  /** Modal content */
  children: React.ReactNode
  /** Whether in mobile mode */
  isMobile?: boolean
  /** Maximum width class (default: max-w-md) */
  maxWidth?: "max-w-sm" | "max-w-md" | "max-w-lg" | "max-w-xl" | "max-w-2xl"
  /** Allow overflow for dropdowns (default: false) */
  allowOverflow?: boolean
  /** Element to focus when modal opens */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  /** Disable swipe-to-dismiss on mobile */
  disableSwipe?: boolean
  /** Custom padding class for content area */
  contentPadding?: string
  /** Show mobile swipe handle (default: true on mobile) */
  showHandle?: boolean
  /** Use mobile full-screen mode (inset-0) vs centered (default: false) */
  mobileFullScreen?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  children,
  isMobile = false,
  maxWidth = "max-w-md",
  allowOverflow = false,
  initialFocusRef,
  disableSwipe = false,
  contentPadding,
  showHandle = true,
  mobileFullScreen = false,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [startY, setStartY] = useState(0)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile || disableSwipe) return
      const content = contentRef.current
      if (content && content.scrollTop > 0) return
      setIsDragging(true)
      setStartY(e.touches[0].clientY)
      setDragY(0)
    },
    [isMobile, disableSwipe]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || !isMobile || disableSwipe) return
      const diff = e.touches[0].clientY - startY
      if (diff > 0) setDragY(diff)
    },
    [isDragging, startY, isMobile, disableSwipe]
  )

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || !isMobile || disableSwipe) return
    setIsDragging(false)
    if (dragY > SWIPE_THRESHOLD) onClose()
    setDragY(0)
  }, [isDragging, dragY, onClose, isMobile, disableSwipe])

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/15 backdrop-blur-[1px] transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            if (initialFocusRef?.current) {
              e.preventDefault()
              initialFocusRef.current.focus()
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            focusChatPrompt()
          }}
          className={cn(
            "fixed z-50 bg-popover flex flex-col",
            allowOverflow ? "overflow-visible" : "overflow-hidden",
            isMobile
              ? mobileFullScreen
                ? "inset-x-0 bottom-0 top-0 rounded-none"
                : "inset-x-4 top-1/2 -translate-y-1/2 rounded-xl"
              : `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${maxWidth} border border-border rounded-xl shadow-xl`,
            !isDragging && isMobile && "transition-transform duration-300"
          )}
          style={
            isMobile && !disableSwipe
              ? { transform: `translateY(${dragY}px)` }
              : undefined
          }
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile swipe handle */}
          {isMobile && showHandle && mobileFullScreen && (
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}

          <ModalHeader title={title} />

          <div
            ref={contentRef}
            className={cn(
              "flex-1",
              contentPadding ?? (isMobile ? "p-4" : "p-4"),
              allowOverflow ? "overflow-visible" : "overflow-y-auto"
            )}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Convenience components for common modal patterns

export interface ModalButtonsProps {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  confirmDisabled?: boolean
  loading?: boolean
  isMobile?: boolean
  variant?: "default" | "destructive"
  confirmRef?: React.RefObject<HTMLButtonElement | null>
}

export function ModalButtons({
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled = false,
  loading = false,
  isMobile = false,
  variant = "default",
  confirmRef,
}: ModalButtonsProps) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        onClick={onCancel}
        className={cn(
          "rounded-md hover:bg-accent transition-colors cursor-pointer",
          isMobile ? "px-4 py-2.5 text-base" : "px-3 py-1.5 text-sm"
        )}
      >
        {cancelLabel}
      </button>
      <button
        ref={confirmRef}
        onClick={onConfirm}
        disabled={confirmDisabled || loading}
        className={cn(
          "rounded-md disabled:opacity-50 transition-colors cursor-pointer",
          isMobile ? "px-4 py-2.5 text-base" : "px-3 py-1.5 text-sm",
          variant === "destructive"
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {loading ? "Loading..." : confirmLabel}
      </button>
    </div>
  )
}

// Common mobile-aware text component
export function ModalText({
  children,
  isMobile = false,
  muted = false,
  className,
}: {
  children: React.ReactNode
  isMobile?: boolean
  muted?: boolean
  className?: string
}) {
  return (
    <p
      className={cn(
        isMobile ? "text-base" : "text-sm",
        muted && "text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  )
}
