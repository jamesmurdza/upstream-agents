"use client"

import { useState } from "react"
import { useSession, signIn } from "next-auth/react"
import { Sidebar } from "@/components/Sidebar"
import { ChatPanel } from "@/components/ChatPanel"
import { RepoPickerModal } from "@/components/modals/RepoPickerModal"
import { SettingsModal } from "@/components/modals/SettingsModal"
import { useChat } from "@/lib/hooks/useChat"
import { Loader2 } from "lucide-react"

export default function HomePage() {
  const { data: session, status } = useSession()

  const {
    chats,
    currentChat,
    currentChatId,
    settings,
    startNewChat,
    selectChat,
    removeChat,
    sendMessage,
    stopAgent,
    updateSettings,
  } = useChat()

  const [repoPickerOpen, setRepoPickerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Loading state (only show spinner briefly while checking auth)
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Handler for new chat - requires sign in to pick repo
  const handleNewChat = () => {
    // Must be signed in to access GitHub repos
    if (!session) {
      signIn("github")
      return
    }
    // OpenCode uses free models, no API key required
    setRepoPickerOpen(true)
  }

  // Handler for repo selection
  const handleRepoSelect = (repo: string, branch: string) => {
    startNewChat(repo, branch)
  }

  // Handler for sending message
  const handleSendMessage = (message: string) => {
    // OpenCode uses free models, no API key check needed
    sendMessage(message)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={selectChat}
        onNewChat={handleNewChat}
        onDeleteChat={removeChat}
        onOpenSettings={() => setSettingsOpen(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <ChatPanel
        chat={currentChat}
        onSendMessage={handleSendMessage}
        onStopAgent={stopAgent}
      />

      <RepoPickerModal
        open={repoPickerOpen}
        onClose={() => setRepoPickerOpen(false)}
        onSelect={handleRepoSelect}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={updateSettings}
      />
    </div>
  )
}
