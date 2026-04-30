"use client"

import { useState, useRef, useCallback } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { ModalHeader, focusChatPrompt } from "@/components/ui/modal-header"
import { cn } from "@/lib/utils"

const SWIPE_THRESHOLD = 100

export interface BaseDialogProps {
  open: boolean
  onClose: () => void
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  isMobile?: boolean
  /** When true, content area allows overflow (for dropdowns) */
  allowOverflow?: boolean
  /** Ref to the element that should receive focus when dialog opens */
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export function BaseDialog({
  open,
  onClose,
  title,
  icon,
  children,
  isMobile = false,
  allowOverflow = false,
  initialFocusRef,
}: BaseDialogProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [startY, setStartY] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile) return
      const content = contentRef.current
      if (content && content.scrollTop > 0) return
      setIsDragging(true)
      setStartY(e.touches[0].clientY)
      setDragY(0)
    },
    [isMobile]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || !isMobile) return
      const diff = e.touches[0].clientY - startY
      if (diff > 0) setDragY(diff)
    },
    [isDragging, startY, isMobile]
  )

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || !isMobile) return
    setIsDragging(false)
    if (dragY > SWIPE_THRESHOLD) onClose()
    setDragY(0)
  }, [isDragging, dragY, onClose, isMobile])

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/15 backdrop-blur-[1px]" />
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
              ? "inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh]"
              : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm border border-border rounded-lg shadow-xl",
            !isDragging && isMobile && "transition-transform duration-300"
          )}
          style={isMobile ? { transform: `translateY(${dragY}px)` } : undefined}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {isMobile && (
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}

          <ModalHeader
            title={
              <>
                {icon}
                {title}
              </>
            }
          />

          <div
            ref={contentRef}
            className={cn(
              "flex-1",
              isMobile ? "p-4" : "p-4",
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
