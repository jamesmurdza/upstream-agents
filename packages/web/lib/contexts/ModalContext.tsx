"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import type { HighlightKey, SectionKey } from "@/components/modals/SettingsModal"

// =============================================================================
// ModalContext - Provides modal state to avoid drilling modal callbacks
// =============================================================================

export interface ModalContextValue {
  // Repo/Branch modals
  repoSelectOpen: boolean
  setRepoSelectOpen: (open: boolean) => void
  repoCreateOpen: boolean
  setRepoCreateOpen: (open: boolean) => void
  branchSelectOpen: boolean
  setBranchSelectOpen: (open: boolean) => void

  // Settings modal
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  settingsHighlightKey: HighlightKey
  settingsDefaultSection: SectionKey
  openSettings: (highlightKey?: HighlightKey) => void
  openSettingsSection: (section?: SectionKey) => void
  closeSettings: () => void

  // Help & Sign-in modals
  helpOpen: boolean
  setHelpOpen: (open: boolean) => void
  signInModalOpen: boolean
  setSignInModalOpen: (open: boolean) => void

  // Delete confirmation
  deleteConfirmChatId: string | null
  setDeleteConfirmChatId: (chatId: string | null) => void

  // Environment variables modal
  envVarsModalOpen: boolean
  setEnvVarsModalOpen: (open: boolean) => void

  // Scheduled jobs
  scheduledJobFormOpen: boolean
  setScheduledJobFormOpen: (open: boolean) => void

  // Mobile-specific modals
  mobileCommandsOpen: boolean
  setMobileCommandsOpen: (open: boolean) => void
  mobileTitleMenuOpen: boolean
  setMobileTitleMenuOpen: (open: boolean) => void
  mobileRenameChat: { id: string; name: string } | null
  setMobileRenameChat: (chat: { id: string; name: string } | null) => void

  // Re-auth modal
  reAuthModalOpen: boolean
  setReAuthModalOpen: (open: boolean) => void
}

interface ModalProviderProps {
  children: ReactNode
  value: ModalContextValue
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function ModalProvider({ children, value }: ModalProviderProps) {
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
}

export function useModals(): ModalContextValue {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error("useModals must be used within a ModalProvider")
  }
  return context
}

/** Optional hook that returns null if not in provider */
export function useModalsOptional(): ModalContextValue | null {
  return useContext(ModalContext)
}
