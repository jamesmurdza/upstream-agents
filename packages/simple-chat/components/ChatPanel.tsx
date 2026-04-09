"use client"

import { useState, useRef, useEffect } from "react"
import { ArrowUp, Square, ChevronDown, Github } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Chat, Settings, Agent, ModelOption } from "@/lib/types"
import { NEW_REPOSITORY, agentModels, agentLabels, getModelLabel } from "@/lib/types"
import { MessageBubble } from "./MessageBubble"

interface ChatPanelProps {
  chat: Chat | null
  settings: Settings
  onSendMessage: (message: string, agent: string, model: string) => void
  onStopAgent: () => void
  onChangeRepo?: () => void
  onUpdateChat?: (updates: Partial<Chat>) => void
}

export function ChatPanel({ chat, settings, onSendMessage, onStopAgent, onChangeRepo, onUpdateChat }: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false)
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Get current agent/model (from chat or settings)
  const currentAgent = (chat?.agent || settings.defaultAgent) as Agent
  const currentModel = chat?.model || settings.defaultModel

  const isRunning = chat?.status === "running"
  const isCreating = chat?.status === "creating"
  const canSend = input.trim() && !isRunning && !isCreating

  // Track if user has scrolled up from bottom
  const handleScroll = () => {
    const container = messagesContainerRef.current
    if (!container) return
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    setUserHasScrolledUp(!isAtBottom)
  }

  // Auto-scroll to bottom when messages change (only if user hasn't scrolled up)
  useEffect(() => {
    if (!userHasScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [chat?.messages, userHasScrolledUp])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px"
    }
  }, [input])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setShowAgentDropdown(false)
        setShowModelDropdown(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleSend = () => {
    if (!canSend) return
    onSendMessage(input.trim(), currentAgent, currentModel)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAgentChange = (agent: Agent) => {
    setShowAgentDropdown(false)
    // Update chat's agent if possible
    if (chat && onUpdateChat) {
      const models = agentModels[agent] ?? []
      const newModel = models[0]?.value || currentModel
      onUpdateChat({ agent, model: newModel })
    }
  }

  const handleModelChange = (model: string) => {
    setShowModelDropdown(false)
    if (chat && onUpdateChat) {
      onUpdateChat({ model })
    }
  }

  // No chat selected - show loading state while creating
  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
        </div>
      </div>
    )
  }

  const isNewRepo = chat.repo === NEW_REPOSITORY
  const canChangeRepo = chat.messages.length === 0 && !chat.sandboxId
  const isNewChat = chat.messages.length === 0

  // Get available models for current agent
  const availableModels = agentModels[currentAgent] ?? []
  const agents: Agent[] = ["claude-code", "opencode", "codex", "gemini", "goose", "pi"]

  // Chat input component (used in two places)
  // Slightly wider than messages container (max-w-3xl = 48rem, this is ~52rem)
  const chatInput = (
    <div className="w-full max-w-[52rem] mx-auto">
      <div
        className={cn(
          "flex flex-col rounded-2xl border shadow-sm",
          "border-border bg-card focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20"
        )}
      >
        {/* Text input area */}
        <div className="flex items-end gap-2 px-4 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isCreating
                ? "Creating sandbox..."
                : isRunning
                ? "Agent is working..."
                : "Message..."
            }
            rows={1}
            disabled={isCreating}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
          />

          {/* Button container - always takes space to prevent layout shift */}
          <div className="w-8 h-8 shrink-0">
            {isRunning ? (
              <button
                onClick={onStopAgent}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors cursor-pointer"
              >
                <Square className="h-3 w-3 fill-current" />
              </button>
            ) : canSend ? (
              <button
                onClick={handleSend}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer transition-colors"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Bottom row with selectors */}
        <div className="flex items-center gap-4 px-4 py-2">
          {/* Repo selector */}
          {canChangeRepo && onChangeRepo ? (
            <button
              onClick={onChangeRepo}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {isNewRepo ? "New Repository" : chat.repo}
              <ChevronDown className="h-3 w-3" />
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {isNewRepo ? "New Repository" : chat.repo}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Agent selector */}
          <div className="relative" data-dropdown>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowAgentDropdown(!showAgentDropdown)
                setShowModelDropdown(false)
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {agentLabels[currentAgent]}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showAgentDropdown && (
              <div className="absolute bottom-full right-0 mb-1 w-40 bg-popover border border-border rounded-md shadow-lg py-1 z-50">
                {agents.map((agent) => (
                  <button
                    key={agent}
                    onClick={() => handleAgentChange(agent)}
                    className={cn(
                      "w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors",
                      agent === currentAgent && "bg-accent"
                    )}
                  >
                    {agentLabels[agent]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model selector */}
          <div className="relative" data-dropdown>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowModelDropdown(!showModelDropdown)
                setShowAgentDropdown(false)
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {getModelLabel(currentAgent, currentModel)}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showModelDropdown && (
              <div className="absolute bottom-full right-0 mb-1 w-52 max-h-64 overflow-y-auto bg-popover border border-border rounded-md shadow-lg py-1 z-50">
                {availableModels.map((model: ModelOption) => (
                  <button
                    key={model.value}
                    onClick={() => handleModelChange(model.value)}
                    className={cn(
                      "w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors",
                      model.value === currentModel && "bg-accent"
                    )}
                  >
                    {model.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  // New chat - centered welcome with input
  if (isNewChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold">What would you like to build?</h2>
        </div>
        {chatInput}
        <p className="text-sm text-muted-foreground mt-4">
          Agents work in an isolated sandbox and work on separate git branches.
        </p>
      </div>
    )
  }

  const chatTitle = chat.displayName || "Untitled"
  // Only show GitHub link after branch has been created and pushed (sandboxId exists means branch was pushed)
  const hasBranchOnGitHub = !isNewRepo && chat.branch && chat.sandboxId
  const githubBranchUrl = hasBranchOnGitHub
    ? `https://github.com/${chat.repo}/tree/${chat.branch}`
    : null

  // Chat with messages
  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header with title */}
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-sm font-medium text-foreground">{chatTitle}</h1>
        {githubBranchUrl && (
          <a
            href={githubBranchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="View branch on GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4"
      >
        <div className="space-y-6 max-w-3xl mx-auto">
          {chat.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-4">
        {chatInput}
      </div>
    </div>
  )
}
