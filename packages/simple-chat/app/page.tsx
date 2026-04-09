"use client"

import { useState, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import { Sidebar } from "@/components/Sidebar"
import { ChatPanel } from "@/components/ChatPanel"
import { RepoPickerModal } from "@/components/modals/RepoPickerModal"
import { SettingsModal, type HighlightKey } from "@/components/modals/SettingsModal"
import { useChat } from "@/lib/hooks/useChat"
import { NEW_REPOSITORY } from "@/lib/types"

export default function HomePage() {
  const { data: session } = useSession()

  const {
    chats,
    currentChat,
    currentChatId,
    settings,
    isHydrated,
    deletingChatIds,
    canCreateChat,
    startNewChat,
    selectChat,
    removeChat,
    updateChatRepo,
    updateCurrentChat,
    sendMessage,
    stopAgent,
    updateSettings,
  } = useChat()

  const [repoPickerOpen, setRepoPickerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsHighlightKey, setSettingsHighlightKey] = useState<HighlightKey>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(260)

  // Handler for opening settings (optionally with a highlighted API key field)
  const handleOpenSettings = (highlightKey?: HighlightKey) => {
    setSettingsHighlightKey(highlightKey ?? null)
    setSettingsOpen(true)
  }

  // Handler for closing settings
  const handleCloseSettings = () => {
    setSettingsOpen(false)
    setSettingsHighlightKey(null)
  }

  // Auto-create a new chat if none exists after hydration
  useEffect(() => {
    if (isHydrated && !currentChatId) {
      startNewChat()
    }
  }, [isHydrated, currentChatId, startNewChat])

  // Handler for new chat - creates with NEW_REPOSITORY by default
  const handleNewChat = () => {
    startNewChat() // Defaults to NEW_REPOSITORY
  }

  // Handler for changing repo (called from ChatPanel header)
  const handleChangeRepo = () => {
    // Must be signed in to access GitHub repos
    if (!session) {
      signIn("github")
      return
    }
    setRepoPickerOpen(true)
  }

  // Handler for repo selection - updates the current chat's repo
  const handleRepoSelect = (repo: string, branch: string) => {
    if (currentChatId) {
      updateChatRepo(currentChatId, repo, branch)
    }
  }

  // Handler for sending message
  const handleSendMessage = (message: string, agent: string, model: string) => {
    // For GitHub repos, we need auth
    if (currentChat && currentChat.repo !== NEW_REPOSITORY && !session) {
      signIn("github")
      return
    }
    sendMessage(message, agent, model)
  }

  // Don't render chats until hydrated to avoid SSR mismatch
  const displayChats = isHydrated ? chats : []
  const displayCurrentChatId = isHydrated ? currentChatId : null
  const displayCurrentChat = isHydrated ? currentChat : null

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        chats={displayChats}
        currentChatId={displayCurrentChatId}
        deletingChatIds={deletingChatIds}
        canCreateChat={canCreateChat}
        onSelectChat={selectChat}
        onNewChat={handleNewChat}
        onDeleteChat={removeChat}
        onOpenSettings={() => handleOpenSettings()}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />

      <ChatPanel
        chat={displayCurrentChat}
        settings={settings}
        onSendMessage={handleSendMessage}
        onStopAgent={stopAgent}
        onChangeRepo={handleChangeRepo}
        onUpdateChat={updateCurrentChat}
        onOpenSettings={handleOpenSettings}
      />

      <RepoPickerModal
        open={repoPickerOpen}
        onClose={() => setRepoPickerOpen(false)}
        onSelect={handleRepoSelect}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={handleCloseSettings}
        settings={settings}
        onSave={updateSettings}
        highlightKey={settingsHighlightKey}
      />
    </div>
  )
}
