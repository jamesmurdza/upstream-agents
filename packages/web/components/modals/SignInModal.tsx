"use client"

import { signIn } from "next-auth/react"
import { Github, MessageSquare } from "lucide-react"
import { Modal, ModalText } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

interface SignInModalProps {
  open: boolean
  onClose: () => void
  isMobile?: boolean
}

export function SignInModal({ open, onClose, isMobile = false }: SignInModalProps) {
  const handleSignIn = () => {
    signIn("github")
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <>
          <MessageSquare className="h-4 w-4" />
          Sign in to continue
        </>
      }
      isMobile={isMobile}
      maxWidth="max-w-md"
      contentPadding="p-0"
    >
      <div
        className={cn(
          "flex flex-col items-center text-center",
          isMobile ? "p-6 space-y-4" : "p-6 space-y-4"
        )}
      >
        <ModalText isMobile={isMobile} muted>
          Sign in with GitHub to start chatting with AI agents. Your message will be
          sent automatically after signing in.
        </ModalText>

        <button
          autoFocus
          onClick={handleSignIn}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-md bg-[#24292f] text-white hover:bg-[#24292f]/90 active:bg-[#24292f]/80 transition-colors font-medium cursor-pointer",
            isMobile ? "px-6 py-3 text-base" : "px-4 py-2.5 text-sm"
          )}
        >
          <Github className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
          Sign in with GitHub
        </button>
      </div>

      {/* Footer */}
      <div
        className={cn(
          "flex justify-center border-t border-border bg-popover",
          isMobile ? "px-4 py-3" : "px-4 py-3"
        )}
      >
        <button
          onClick={onClose}
          className={cn(
            "text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
            isMobile ? "text-sm" : "text-xs"
          )}
        >
          Cancel
        </button>
      </div>
    </Modal>
  )
}
