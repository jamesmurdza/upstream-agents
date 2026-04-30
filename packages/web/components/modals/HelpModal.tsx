"use client"

import { HelpCircle } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

interface HelpModalProps {
  open: boolean
  onClose: () => void
  isMobile?: boolean
}

export function HelpModal({ open, onClose, isMobile = false }: HelpModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <>
          <HelpCircle className="h-4 w-4" />
          Help
        </>
      }
      isMobile={isMobile}
      maxWidth="max-w-xl"
      contentPadding={cn(isMobile ? "p-4" : "p-5")}
    >
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="font-medium mb-1.5">Keyboard shortcuts</h3>
          <ul className="space-y-1 text-muted-foreground">
            <li>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                ⌘P
              </kbd>{" "}
              Search chats, repos, and branches
            </li>
            <li>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                ⌘K
              </kbd>{" "}
              Command palette
            </li>
            <li>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                ⌥↑/↓
              </kbd>{" "}
              Switch chats
            </li>
            <li>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                ⌥Enter
              </kbd>{" "}
              Branch and send to a new chat
            </li>
          </ul>
        </section>

        <section>
          <h3 className="font-medium mb-1.5">Git actions</h3>
          <p className="text-muted-foreground">
            Type{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/</code> in
            the prompt for merge, rebase, squash, and PR.
          </p>
        </section>
      </div>
    </Modal>
  )
}
