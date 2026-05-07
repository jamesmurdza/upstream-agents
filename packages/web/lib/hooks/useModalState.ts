"use client"

import { useState, useCallback } from "react"
import type { HighlightKey, SectionKey } from "@/components/modals/SettingsModal"

interface ModalState {
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

interface UseModalStateOptions {
  isMobile: boolean
  onMobileSidebarClose?: () => void
}

export function useModalState({ isMobile, onMobileSidebarClose }: UseModalStateOptions): ModalState {
  // Repo/Branch modals
  const [repoSelectOpen, setRepoSelectOpen] = useState(false)
  const [repoCreateOpen, setRepoCreateOpen] = useState(false)
  const [branchSelectOpen, setBranchSelectOpen] = useState(false)

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsHighlightKey, setSettingsHighlightKey] = useState<HighlightKey>(null)
  const [settingsDefaultSection, setSettingsDefaultSection] = useState<SectionKey>("general")

  // Help & Sign-in modals
  const [helpOpen, setHelpOpen] = useState(false)
  const [signInModalOpen, setSignInModalOpen] = useState(false)

  // Delete confirmation
  const [deleteConfirmChatId, setDeleteConfirmChatId] = useState<string | null>(null)

  // Environment variables modal
  const [envVarsModalOpen, setEnvVarsModalOpen] = useState(false)

  // Scheduled jobs
  const [scheduledJobFormOpen, setScheduledJobFormOpen] = useState(false)

  // Mobile-specific modals
  const [mobileCommandsOpen, setMobileCommandsOpen] = useState(false)
  const [mobileTitleMenuOpen, setMobileTitleMenuOpen] = useState(false)
  const [mobileRenameChat, setMobileRenameChat] = useState<{ id: string; name: string } | null>(null)

  // Re-auth modal
  const [reAuthModalOpen, setReAuthModalOpen] = useState(false)

  // Handler for opening settings (optionally with a highlighted API key field)
  const openSettings = useCallback((highlightKey?: HighlightKey) => {
    setSettingsHighlightKey(highlightKey ?? null)
    setSettingsDefaultSection("general")
    setSettingsOpen(true)
    // Close mobile sidebar when opening settings
    if (isMobile) {
      onMobileSidebarClose?.()
    }
  }, [isMobile, onMobileSidebarClose])

  // Handler for opening settings to a specific section (used by command palette)
  const openSettingsSection = useCallback((section?: SectionKey) => {
    setSettingsHighlightKey(null)
    setSettingsDefaultSection(section ?? "general")
    setSettingsOpen(true)
    if (isMobile) {
      onMobileSidebarClose?.()
    }
  }, [isMobile, onMobileSidebarClose])

  // Handler for closing settings
  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    setSettingsHighlightKey(null)
  }, [])

  return {
    // Repo/Branch modals
    repoSelectOpen,
    setRepoSelectOpen,
    repoCreateOpen,
    setRepoCreateOpen,
    branchSelectOpen,
    setBranchSelectOpen,

    // Settings modal
    settingsOpen,
    setSettingsOpen,
    settingsHighlightKey,
    settingsDefaultSection,
    openSettings,
    openSettingsSection,
    closeSettings,

    // Help & Sign-in modals
    helpOpen,
    setHelpOpen,
    signInModalOpen,
    setSignInModalOpen,

    // Delete confirmation
    deleteConfirmChatId,
    setDeleteConfirmChatId,

    // Environment variables modal
    envVarsModalOpen,
    setEnvVarsModalOpen,

    // Scheduled jobs
    scheduledJobFormOpen,
    setScheduledJobFormOpen,

    // Mobile-specific modals
    mobileCommandsOpen,
    setMobileCommandsOpen,
    mobileTitleMenuOpen,
    setMobileTitleMenuOpen,
    mobileRenameChat,
    setMobileRenameChat,

    // Re-auth modal
    reAuthModalOpen,
    setReAuthModalOpen,
  }
}
