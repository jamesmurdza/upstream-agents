"use client"

import { GitBranchPlus, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface QueuedMessage {
  id: string
  content: string
  agent?: string
  model?: string
}

interface QueueShelfProps {
  messages: QueuedMessage[]
  canBranch: boolean
  isMobile: boolean
  onBranchQueuedMessage?: (
    id: string,
    content: string,
    agent?: string,
    model?: string
  ) => void
  onRemoveQueuedMessage?: (id: string) => void
}

export function QueueShelf({
  messages,
  canBranch,
  isMobile,
  onBranchQueuedMessage,
  onRemoveQueuedMessage,
}: QueueShelfProps) {
  if (messages.length === 0) return null

  return (
    <div
      className={cn(
        "border border-b-0 border-border bg-card rounded-t-md -mb-4",
        isMobile ? "mx-4" : "mx-6"
      )}
    >
      {messages.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 last:border-b-0"
        >
          <span className="flex-1 min-w-0 truncate text-sm text-foreground/80">
            {m.content}
          </span>
          {canBranch && onBranchQueuedMessage && (
            <button
              onClick={() =>
                onBranchQueuedMessage(m.id, m.content, m.agent, m.model)
              }
              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              aria-label="Branch to new chat"
              title="Branch to new chat"
            >
              <GitBranchPlus className="h-2.5 w-2.5" />
            </button>
          )}
          {onRemoveQueuedMessage && (
            <button
              onClick={() => onRemoveQueuedMessage(m.id)}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
              aria-label="Remove queued message"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
