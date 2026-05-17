"use client"

import { useState, useRef } from "react"
import { MoreHorizontal, Pencil, Trash2, Loader2, Pin, PinOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useClickOutside } from "@/lib/hooks/useClickOutside"
import type { Chat } from "@/lib/types"
import { hasMergedSuccessfully } from "./utils"
import { MergedChatCheckmark } from "./MergedChatCheckmark"

export interface MobileChatItemProps {
  chat: Chat
  isActive: boolean
  isDeleting: boolean
  isUnseen: boolean
  onSelect: () => void
  onDelete: () => void
  onRequestRename: () => void
  onPin?: () => void
}

export function MobileChatItem({ chat, isActive, isDeleting, isUnseen, onSelect, onDelete, onRequestRename, onPin }: MobileChatItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const displayName = chat.displayName || "Untitled"

  // Close menu when clicking outside
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen)

  return (
    <div
      data-testid="chat-item"
      data-chat-id={chat.id}
      className={cn(
        "flex items-center gap-2 rounded-md transition-colors px-3 py-2",
        isDeleting
          ? "opacity-50 cursor-not-allowed"
          : "active:bg-accent",
        !isDeleting && (isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 text-sidebar-foreground")
      )}
      onClick={isDeleting ? undefined : onSelect}
    >
      <div className="flex-1 min-w-0 flex items-center gap-1">
        {chat.pinnedAt && <Pin className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
        <div className="text-sm truncate">{displayName}</div>
      </div>
      {chat.status === "running" || chat.status === "creating" || (chat.queuedMessages && chat.queuedMessages.length > 0) ? (
        <Loader2 className="h-2.5 w-2.5 flex-shrink-0 animate-spin text-foreground/90" />
      ) : isUnseen ? (
        <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/80" />
      ) : hasMergedSuccessfully(chat.messages) ? (
        <MergedChatCheckmark className="flex-shrink-0" />
      ) : null}

      {/* Menu button */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(!menuOpen)
          }}
          disabled={isDeleting}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:cursor-not-allowed"
          aria-label="Chat options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-32 rounded-md border border-border bg-popover shadow-lg py-1 z-50">
            {onPin && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPin()
                  setMenuOpen(false)
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
              >
                {chat.pinnedAt ? (
                  <>
                    <PinOff className="h-3.5 w-3.5" />
                    Unpin
                  </>
                ) : (
                  <>
                    <Pin className="h-3.5 w-3.5" />
                    Pin
                  </>
                )}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onRequestRename()
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
            >
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
                setMenuOpen(false)
              }}
              disabled={isDeleting}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left text-destructive disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
