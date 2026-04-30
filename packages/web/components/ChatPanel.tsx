"use client"

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react"
import { ArrowUp, Square, ChevronDown, GitBranch, Key, X, Paperclip } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Chat, Agent, ModelOption, PendingFile } from "@/lib/types"
import { nanoid } from "nanoid"
import { NEW_REPOSITORY, agentModels, agentLabels, getModelLabel, hasCredentialsForModel, getDefaultAgent, getDefaultModelForAgent } from "@/lib/types"
import { filterSlashCommandsWithConflict } from "@upstream/common"
import { MessageBubble } from "./MessageBubble"
import { AgentIcon } from "./icons/agent-icons"
import { MobileSelect } from "./ui/MobileBottomSheet"
import { SlashCommandMenu, type SlashCommandType } from "./SlashCommandMenu"
import { Input } from "./ui/input"

import type { HighlightKey } from "./modals/SettingsModal"
import type { ChatPanelProps } from "./chat/types"
import {
  ErrorBanner,
  ChatHeader,
  MobileConflictBar,
  ChatPanelSkeleton,
  LoadingMessagesSkeleton,
  WelcomeView,
  QueueShelf,
} from "./chat"

export type { ChatPanelProps }

export function ChatPanel({
  chat,
  settings,
  credentialFlags,
  onSendMessage,
  onEnqueueMessage,
  onRemoveQueuedMessage,
  onResumeQueue,
  onStopAgent,
  onChangeRepo,
  onChangeBranch,
  onUpdateChat,
  onOpenSettings,
  onSlashCommand,
  onRequireSignIn,
  onDeleteChat,
  onOpenHelp,
  onOpenFile,
  onForcePush,
  isMobile = false,
  rebaseConflict,
  onAbortConflict,
  conflictActionLoading = false,
  onBranchWithMessage,
  onBranchQueuedMessage,
  canBranch = false,
  isLoadingMessages = false,
  draft = "",
  onDraftChange,
}: ChatPanelProps) {
  // Use draft prop as input value (controlled component pattern for per-chat drafts)
  const input = draft
  const setInput = useCallback(
    (value: string) => {
      onDraftChange?.(value)
    },
    [onDraftChange]
  )
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false)
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  // Mobile bottom sheet states
  const [showAgentSheet, setShowAgentSheet] = useState(false)
  const [showModelSheet, setShowModelSheet] = useState(false)
  // Slash command menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState("")
  const [titleMenuOpen, setTitleMenuOpen] = useState(false)
  const titleMenuRef = useRef<HTMLDivElement>(null)
  // Conflict menu state
  const [conflictMenuOpen, setConflictMenuOpen] = useState(false)
  const conflictMenuRef = useRef<HTMLDivElement>(null)
  // File upload state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const prevChatIdRef = useRef<string | null>(null)

  const focusPrompt = useCallback((moveCursorToEnd: boolean = false) => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.focus()

    if (moveCursorToEnd) {
      const end = textarea.value.length
      textarea.setSelectionRange(end, end)
    }
  }, [])

  // Get current agent/model (from chat, the user's preference, or auto-resolved
  // from credential flags). Uses ?? so we don't trip over the empty string.
  const currentAgent = (chat?.agent ??
    settings.defaultAgent ??
    getDefaultAgent(credentialFlags)) as Agent
  const currentModel =
    chat?.model ??
    settings.defaultModel ??
    getDefaultModelForAgent(currentAgent, credentialFlags)

  // Check if the selected model has required credentials
  const availableModels = agentModels[currentAgent] ?? []
  const selectedModelConfig = availableModels.find((m) => m.value === currentModel)
  const hasRequiredCredentials = selectedModelConfig
    ? hasCredentialsForModel(selectedModelConfig, credentialFlags, currentAgent)
    : true

  // Conflict state
  const inConflict = !!(rebaseConflict?.inRebase || rebaseConflict?.inMerge)
  const isMergeConflict = rebaseConflict?.inMerge ?? false

  // Treat the chat as running while it has (non-paused) queued messages too,
  // so the UI doesn't flicker between ready and running as the queue drains.
  const hasQueued = (chat?.queuedMessages?.length ?? 0) > 0
  const isPaused = !!(chat?.queuePaused && hasQueued)
  const isRunning = chat?.status === "running" || (hasQueued && !chat?.queuePaused)
  const isCreating = chat?.status === "creating"
  const hasContent = input.trim() || pendingFiles.length > 0
  // When the agent is running, text-only messages are queued for later dispatch.
  const canQueue = !!onEnqueueMessage && !!input.trim() && pendingFiles.length === 0
  // Paused queue: always show the send button (either to enqueue a new prompt
  // at the end or to resume draining with nothing typed).
  const canSend =
    (hasContent && !isRunning && !isCreating && !isPaused) ||
    (isRunning && canQueue) ||
    isPaused

  // Track if user has scrolled up from bottom
  const handleScroll = () => {
    const container = messagesContainerRef.current
    if (!container) return
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100
    setUserHasScrolledUp(!isAtBottom)
  }

  // Auto-scroll to bottom when chat changes or content grows during streaming.
  useLayoutEffect(() => {
    const chatChanged = chat?.id !== prevChatIdRef.current
    prevChatIdRef.current = chat?.id ?? null

    if (chatChanged || !userHasScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" })
    }
  }, [chat?.id, chat?.messages, userHasScrolledUp])

  // Focus prompt when switching chats or when the welcome view transitions to
  // the messages view (which remounts the textarea in a different DOM location).
  useEffect(() => {
    if (isMobile) return
    const t = window.setTimeout(() => {
      focusPrompt(true)
    }, 0)
    return () => window.clearTimeout(t)
  }, [chat?.id, isCreating, isMobile, focusPrompt])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      const maxHeight = isMobile ? 120 : 200
      textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + "px"
    }
  }, [input, isMobile])

  // Close dropdowns when clicking outside (desktop only)
  useEffect(() => {
    if (isMobile) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-dropdown]")) {
        setShowAgentDropdown(false)
        setShowModelDropdown(false)
      }
    }
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [isMobile])

  // Close title menu on outside click
  useEffect(() => {
    if (!titleMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (titleMenuRef.current && !titleMenuRef.current.contains(e.target as Node)) {
        setTitleMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [titleMenuOpen])

  // Update slash menu visibility based on input.
  const hasLinkedRepo = !!(chat?.repo && chat.repo !== NEW_REPOSITORY)
  useEffect(() => {
    if (input.startsWith("/")) {
      setSlashMenuOpen(true)
    } else {
      setSlashMenuOpen(false)
      setSlashSelectedIndex(0)
    }
  }, [input])

  // Get filtered commands for keyboard navigation. When there's no linked repo,
  // the slash menu swaps in a single "Create repository" entry.
  const filteredCommands = useMemo(() => {
    if (hasLinkedRepo) return filterSlashCommandsWithConflict(input, inConflict)
    const filter = input.startsWith("/")
      ? input.slice(1).toLowerCase()
      : input.toLowerCase()
    const repoCmd = { name: "repo", description: "Create repository", icon: "FolderGit2" }
    if (!filter || repoCmd.name.startsWith(filter)) return [repoCmd]
    return []
  }, [input, hasLinkedRepo, inConflict])

  // Close conflict menu on outside click
  useEffect(() => {
    if (!conflictMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (conflictMenuRef.current && !conflictMenuRef.current.contains(e.target as Node)) {
        setConflictMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [conflictMenuOpen])

  // Handle slash command selection
  const handleSlashCommandSelect = useCallback(
    (command: SlashCommandType) => {
      setSlashMenuOpen(false)
      setSlashSelectedIndex(0)
      setInput("")
      if (command === "repo") {
        onChangeRepo?.()
        return
      }
      if (command === "abort") {
        onAbortConflict?.()
        return
      }
      onSlashCommand?.(command)
    },
    [onSlashCommand, onChangeRepo, onAbortConflict, setInput]
  )

  const handleSend = () => {
    if (!canSend) return
    // Don't send if credentials are missing - the UI shows a warning instead
    if (!hasRequiredCredentials) return

    // If the agent is running, queue the message instead of sending.
    if (isRunning && onEnqueueMessage) {
      onEnqueueMessage(input.trim(), currentAgent, currentModel)
      setInput("")
      textareaRef.current?.focus()
      return
    }

    // Paused queue: typed text goes to the end of the queue and unpauses it;
    // with nothing typed, just resume draining.
    if (isPaused) {
      if (input.trim() && onEnqueueMessage) {
        onEnqueueMessage(input.trim(), currentAgent, currentModel)
        setInput("")
      } else {
        onResumeQueue?.()
      }
      textareaRef.current?.focus()
      return
    }

    // Pass files to sendMessage - upload will happen after sandbox is ready
    const files = pendingFiles.length > 0 ? pendingFiles.map((pf) => pf.file) : undefined
    onSendMessage(input.trim(), currentAgent, currentModel, files)
    setInput("")
    setPendingFiles([])
    textareaRef.current?.focus()
  }

  // File handling - files can be added anytime, upload happens after sandbox is ready
  // If user is not signed in, trigger sign-in immediately when adding files
  const addFiles = (files: FileList | File[]) => {
    // Require sign-in before adding files (files can't persist across OAuth redirect)
    if (onRequireSignIn) {
      onRequireSignIn()
      return
    }
    const newFiles: PendingFile[] = Array.from(files).map((file) => ({
      id: nanoid(),
      file,
      name: file.name,
      size: file.size,
    }))
    setPendingFiles((prev) => [...prev, ...newFiles])
  }

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle slash command menu navigation
    if (slashMenuOpen && filteredCommands.length > 0 && onSlashCommand) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSlashSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          return
        case "ArrowUp":
          e.preventDefault()
          setSlashSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          return
        case "Enter":
          e.preventDefault()
          if (filteredCommands[slashSelectedIndex]) {
            handleSlashCommandSelect(
              filteredCommands[slashSelectedIndex].name as SlashCommandType
            )
          }
          return
        case "Tab":
          e.preventDefault()
          if (filteredCommands[slashSelectedIndex]) {
            handleSlashCommandSelect(
              filteredCommands[slashSelectedIndex].name as SlashCommandType
            )
          }
          return
        case "Escape":
          e.preventDefault()
          setSlashMenuOpen(false)
          setSlashSelectedIndex(0)
          setInput("")
          return
      }
    }

    // Option/Alt+Enter to branch and send
    if (e.key === "Enter" && e.altKey && !e.shiftKey) {
      e.preventDefault()
      if (canBranch && onBranchWithMessage && input.trim()) {
        onBranchWithMessage(input.trim(), currentAgent, currentModel)
        setInput("")
        setPendingFiles([])
        textareaRef.current?.focus()
      }
      return
    }

    // Normal enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAgentChange = (agent: Agent) => {
    setShowAgentDropdown(false)
    setShowAgentSheet(false)
    // Update chat's agent if possible
    if (chat && onUpdateChat) {
      const models = agentModels[agent] ?? []
      const newModel = models[0]?.value || currentModel
      onUpdateChat({ agent, model: newModel })

      // Check if the new model requires credentials we don't have
      const newModelConfig = models.find((m) => m.value === newModel)
      if (newModelConfig && !hasCredentialsForModel(newModelConfig, credentialFlags, agent)) {
        // Open settings with the required key highlighted
        const requiredKey = newModelConfig.requiresKey
        if (requiredKey && requiredKey !== "none" && onOpenSettings) {
          onOpenSettings(requiredKey as HighlightKey)
        }
      }
    }
  }

  const handleModelChange = (model: string) => {
    setShowModelDropdown(false)
    setShowModelSheet(false)
    if (chat && onUpdateChat) {
      onUpdateChat({ model })

      // Check if the new model requires credentials we don't have
      const newModelConfig = availableModels.find((m) => m.value === model)
      if (
        newModelConfig &&
        !hasCredentialsForModel(newModelConfig, credentialFlags, currentAgent)
      ) {
        // Open settings with the required key highlighted
        const requiredKey = newModelConfig.requiresKey
        if (requiredKey && requiredKey !== "none" && onOpenSettings) {
          onOpenSettings(requiredKey as HighlightKey)
        }
      }
    }
  }

  // No chat selected - show a skeleton while the first chat is being created.
  if (!chat) {
    return <ChatPanelSkeleton isMobile={isMobile} />
  }

  const isNewRepo = chat.repo === NEW_REPOSITORY
  // Can select an existing repo only before first message and sandbox creation
  const canSelectRepo = chat.messages.length === 0 && !chat.sandboxId
  // Can create a new repo anytime if still on NEW_REPOSITORY (even after sandbox is created)
  const canCreateRepo = isNewRepo
  // Show the repo button if either action is available
  const showRepoButton = canSelectRepo || canCreateRepo
  // Only show welcome screen if no messages AND not loading messages AND not a child chat
  const isNewChat = chat.messages.length === 0 && !chat.parentChatId && !isLoadingMessages

  const agents: Agent[] = [
    "claude-code",
    "opencode",
    "codex",
    "gemini",
    "goose",
    "pi",
    "eliza",
  ]

  // Prepare agent options for mobile bottom sheet
  const agentOptions = agents.map((agent) => ({
    value: agent,
    label: agentLabels[agent],
    icon: <AgentIcon agent={agent} className="h-5 w-5" />,
  }))

  // Prepare model options for mobile bottom sheet
  const modelOptions = availableModels.map((model: ModelOption) => {
    const modelHasCredentials = hasCredentialsForModel(model, credentialFlags, currentAgent)
    const needsKey = model.requiresKey !== "none" && !modelHasCredentials
    return {
      value: model.value,
      label: model.label,
      description: needsKey ? "Requires API key" : undefined,
      icon: needsKey ? <Key className="h-5 w-5 text-red-500" /> : undefined,
    }
  })

  // Chat input component - responsive design
  const chatInput = (
    <div className={cn("w-full mx-auto", isMobile ? "max-w-full" : "max-w-[52rem]")}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col border shadow-sm bg-card border-border",
          isMobile ? "rounded-xl" : "rounded-2xl",
          "focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20",
          isDraggingOver && "border-primary ring-2 ring-primary/30"
        )}
      >
        {/* Drop zone overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-primary/5 rounded-2xl flex items-center justify-center z-10 pointer-events-none">
            <div className="text-primary text-sm font-medium">Drop files here</div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              addFiles(e.target.files)
              e.target.value = ""
            }
          }}
        />
        {/* Text input area */}
        <div className={cn("flex items-end gap-2", isMobile ? "px-3 py-2" : "px-4 py-3")}>
          {/* Textarea wrapper with slash command menu */}
          <div className="relative flex-1">
            {/* Slash Command Menu - positioned above the textarea */}
            {onSlashCommand && (
              <SlashCommandMenu
                input={input}
                open={slashMenuOpen}
                onSelect={handleSlashCommandSelect}
                onClose={() => {
                  setSlashMenuOpen(false)
                  setSlashSelectedIndex(0)
                }}
                selectedIndex={slashSelectedIndex}
                onSelectedIndexChange={setSlashSelectedIndex}
                hasLinkedRepo={hasLinkedRepo}
                inConflict={inConflict}
                isMobile={isMobile}
              />
            )}

            <textarea
              ref={textareaRef}
              data-chat-prompt
              data-testid="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isCreating
                  ? "Creating sandbox..."
                  : isRunning
                    ? "Agent is working..."
                    : isNewChat
                      ? "Message..."
                      : "Enter prompt or /merge..."
              }
              rows={1}
              className={cn(
                "w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none",
                isMobile ? "text-base" : "text-[15px]"
              )}
            />
          </div>

          {/* Button container - fixed size to prevent layout shift */}
          <div
            className={cn(
              "shrink-0 flex items-center justify-center",
              isMobile ? "h-9 w-9" : "h-7 w-7"
            )}
          >
            {isRunning && canQueue ? (
              <button
                onClick={handleSend}
                title="Queue message (sent after current response)"
                className={cn(
                  "flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 transition-colors",
                  isMobile ? "h-9 w-9" : "h-7 w-7"
                )}
              >
                <ArrowUp className={cn(isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} />
              </button>
            ) : isRunning ? (
              <button
                onClick={onStopAgent}
                className={cn(
                  "flex items-center justify-center rounded-md bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-colors",
                  isMobile ? "h-9 w-9" : "h-7 w-7"
                )}
              >
                <Square
                  className={cn(isMobile ? "h-3.5 w-3.5" : "h-3 w-3", "fill-current")}
                />
              </button>
            ) : canSend ? (
              <button
                onClick={handleSend}
                className={cn(
                  "flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 transition-colors",
                  isMobile ? "h-9 w-9" : "h-7 w-7"
                )}
              >
                <ArrowUp className={cn(isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Pending files display */}
        {pendingFiles.length > 0 && (
          <div className={cn("flex flex-wrap gap-1.5", isMobile ? "px-3 pb-2" : "px-4 pb-2")}>
            {pendingFiles.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "flex items-center gap-1 bg-muted/50 rounded-md",
                  isMobile ? "px-2 py-1 text-sm" : "px-1.5 py-0.5 text-xs"
                )}
              >
                <Paperclip
                  className={cn(isMobile ? "h-3.5 w-3.5" : "h-3 w-3", "text-muted-foreground")}
                />
                <span className="text-foreground truncate max-w-[120px]">{file.name}</span>
                <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
                <button
                  onClick={() => removeFile(file.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                >
                  <X className={cn(isMobile ? "h-3.5 w-3.5" : "h-3 w-3")} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bottom row with selectors */}
        <div
          className={cn(
            "flex items-center gap-2",
            isMobile ? "px-3 py-2 flex-wrap" : "px-4 py-2 gap-4"
          )}
        >
          {/* Repo display/selector */}
          {showRepoButton ? (
            // Can change repo - show as button
            <div className="flex items-center gap-1">
              {onChangeRepo && (
                <button
                  onClick={onChangeRepo}
                  className={cn(
                    "flex items-center gap-1 text-muted-foreground hover:text-foreground active:text-foreground transition-colors cursor-pointer",
                    isMobile
                      ? "text-sm py-1 px-2 rounded-md hover:bg-accent/50"
                      : "text-[13px]"
                  )}
                >
                  {isNewRepo ? "Repository" : chat.repo}
                  <ChevronDown className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
                </button>
              )}
              {!isNewRepo && onChangeBranch && isNewChat && (
                <button
                  onClick={onChangeBranch}
                  className={cn(
                    "flex items-center gap-1 text-muted-foreground hover:text-foreground active:text-foreground transition-colors cursor-pointer",
                    isMobile
                      ? "text-sm py-1 px-2 rounded-md hover:bg-accent/50"
                      : "text-[13px]"
                  )}
                >
                  <GitBranch className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
                  {chat.branch || chat.baseBranch}
                  <ChevronDown className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
                </button>
              )}
              {!isNewRepo && onUpdateChat && canSelectRepo && (
                <button
                  onClick={() => onUpdateChat({ repo: NEW_REPOSITORY, baseBranch: "main" })}
                  className={cn(
                    "rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
                    isMobile ? "p-1.5" : "p-0.5"
                  )}
                  title="Remove repository"
                >
                  <X className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
                </button>
              )}
            </div>
          ) : (
            !isNewRepo && (
              // Repo is locked — link out to the repo on GitHub instead of a
              // plain label so the user can jump to it.
              <div className="flex items-center gap-2">
                <a
                  href={`https://github.com/${chat.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "text-muted-foreground hover:text-foreground transition-colors",
                    isMobile ? "text-sm" : "text-[13px]"
                  )}
                >
                  {chat.repo}
                </a>
                {chat.branch && (
                  <a
                    href={`https://github.com/${chat.repo}/tree/${chat.branch}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors",
                      isMobile ? "text-sm" : "text-[13px]"
                    )}
                  >
                    <GitBranch className={cn(isMobile ? "h-4 w-4" : "h-3 w-3")} />
                    {chat.branch}
                  </a>
                )}
              </div>
            )
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Agent selector */}
          {isMobile ? (
            // Mobile: Use bottom sheet
            <button
              onClick={() => setShowAgentSheet(true)}
              className="flex items-center gap-1 text-sm py-1 px-2 rounded-md hover:bg-accent/50 text-muted-foreground hover:text-foreground active:text-foreground transition-colors cursor-pointer"
            >
              <AgentIcon agent={currentAgent} className="h-4 w-4" />
              {agentLabels[currentAgent]}
              <ChevronDown className="h-4 w-4" />
            </button>
          ) : (
            // Desktop: Use dropdown
            <div className="relative" data-dropdown>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAgentDropdown(!showAgentDropdown)
                  setShowModelDropdown(false)
                }}
                className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground active:text-foreground transition-colors cursor-pointer"
              >
                <AgentIcon agent={currentAgent} className="h-3.5 w-3.5" />
                {agentLabels[currentAgent]}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showAgentDropdown && (
                <div className="absolute bottom-full right-0 mb-1 bg-popover border border-border rounded-md shadow-lg py-1 z-50 w-40">
                  {agents.map((agent) => (
                    <button
                      key={agent}
                      onClick={() => handleAgentChange(agent)}
                      className={cn(
                        "w-full text-left hover:bg-accent active:bg-accent transition-colors flex items-center gap-2 px-3 py-1.5 text-[13px] cursor-pointer",
                        agent === currentAgent && "bg-accent"
                      )}
                    >
                      <AgentIcon agent={agent} className="h-3.5 w-3.5" />
                      {agentLabels[agent]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Model selector */}
          {isMobile ? (
            // Mobile: Use bottom sheet
            <button
              onClick={() => setShowModelSheet(true)}
              className={cn(
                "flex items-center gap-1 text-sm py-1 px-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer",
                !hasRequiredCredentials
                  ? "text-red-500 hover:text-red-600"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {!hasRequiredCredentials && <Key className="h-4 w-4" />}
              {getModelLabel(currentAgent, currentModel)}
              <ChevronDown className="h-4 w-4" />
            </button>
          ) : (
            // Desktop: Use dropdown
            <div className="relative" data-dropdown>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowModelDropdown(!showModelDropdown)
                  setShowAgentDropdown(false)
                }}
                className={cn(
                  "flex items-center gap-1 text-[13px] transition-colors cursor-pointer",
                  !hasRequiredCredentials
                    ? "text-red-500 hover:text-red-600"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {!hasRequiredCredentials && <Key className="h-3 w-3" />}
                {getModelLabel(currentAgent, currentModel)}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showModelDropdown && (
                <div className="absolute bottom-full right-0 mb-1 max-h-64 overflow-y-auto bg-popover border border-border rounded-md shadow-lg py-1 z-50 w-52">
                  {availableModels.map((model: ModelOption) => {
                    const modelHasCredentials = hasCredentialsForModel(
                      model,
                      credentialFlags,
                      currentAgent
                    )
                    const needsKey = model.requiresKey !== "none" && !modelHasCredentials
                    return (
                      <button
                        key={model.value}
                        onClick={() => handleModelChange(model.value)}
                        className={cn(
                          "w-full text-left hover:bg-accent active:bg-accent transition-colors flex items-center justify-between px-3 py-1.5 text-[13px] cursor-pointer",
                          model.value === currentModel && "bg-accent"
                        )}
                      >
                        <span>{model.label}</span>
                        {needsKey && <Key className="h-3 w-3 text-red-500 shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Sheets */}
      {isMobile && (
        <>
          <MobileSelect
            open={showAgentSheet}
            onClose={() => setShowAgentSheet(false)}
            title="Select Agent"
            options={agentOptions}
            value={currentAgent}
            onChange={(value) => handleAgentChange(value as Agent)}
          />
          <MobileSelect
            open={showModelSheet}
            onClose={() => setShowModelSheet(false)}
            title="Select Model"
            options={modelOptions}
            value={currentModel}
            onChange={handleModelChange}
          />
        </>
      )}
    </div>
  )

  // Loading messages skeleton - check BEFORE isNewChat to prevent flash
  if (isLoadingMessages) {
    return <LoadingMessagesSkeleton isMobile={isMobile} />
  }

  // New chat - centered welcome with input
  if (isNewChat) {
    return (
      <WelcomeView chatInput={chatInput} onOpenHelp={onOpenHelp} isMobile={isMobile} />
    )
  }

  const chatTitle = chat.displayName || "Untitled"
  // Only show GitHub link after branch has been created and pushed (sandboxId exists means branch was pushed)
  const hasBranchOnGitHub = !isNewRepo && chat.branch && chat.sandboxId
  const githubBranchUrl = hasBranchOnGitHub
    ? `https://github.com/${chat.repo}/tree/${chat.branch}`
    : null

  // Title editing handlers
  const startEditingTitle = () => {
    setEditTitleValue(chatTitle)
    setIsEditingTitle(true)
    setTimeout(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }, 0)
  }

  const saveTitle = () => {
    const trimmed = editTitleValue.trim()
    if (trimmed && trimmed !== chatTitle && onUpdateChat) {
      onUpdateChat({ displayName: trimmed })
    }
    setIsEditingTitle(false)
  }

  const cancelEditingTitle = () => {
    setIsEditingTitle(false)
    setEditTitleValue("")
  }

  // Chat with messages
  return (
    <div
      className="flex-1 flex flex-col bg-background min-h-0"
      data-testid="chat-container"
      data-chat-status={chat?.status}
      data-chat-id={chat?.id}
    >
      {/* Header with title - hide on mobile since we have mobile header in page.tsx */}
      <ChatHeader
        chat={chat}
        isMobile={isMobile}
        isEditingTitle={isEditingTitle}
        editTitleValue={editTitleValue}
        setEditTitleValue={setEditTitleValue}
        startEditingTitle={startEditingTitle}
        saveTitle={saveTitle}
        cancelEditingTitle={cancelEditingTitle}
        titleInputRef={titleInputRef}
        titleMenuOpen={titleMenuOpen}
        setTitleMenuOpen={setTitleMenuOpen}
        titleMenuRef={titleMenuRef}
        inConflict={inConflict}
        isMergeConflict={isMergeConflict}
        conflictMenuOpen={conflictMenuOpen}
        setConflictMenuOpen={setConflictMenuOpen}
        conflictMenuRef={conflictMenuRef}
        conflictedFiles={rebaseConflict?.conflictedFiles}
        onAbortConflict={onAbortConflict}
        conflictActionLoading={conflictActionLoading}
        onOpenSettings={() => onOpenSettings?.()}
        onDeleteChat={onDeleteChat}
        githubBranchUrl={githubBranchUrl}
      />

      {/* Mobile conflict bar */}
      {isMobile && inConflict && (
        <MobileConflictBar
          isMergeConflict={isMergeConflict}
          conflictedFilesCount={rebaseConflict?.conflictedFiles?.length ?? 0}
          onAbort={onAbortConflict}
          isLoading={conflictActionLoading}
        />
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto mobile-scroll scrollbar-auto-hide",
          isMobile ? "py-3 px-[27px]" : "py-4 px-[31px]"
        )}
      >
        <div
          className={cn(
            "space-y-4 mx-auto",
            isMobile ? "max-w-full" : "max-w-3xl space-y-6"
          )}
        >
          {chat.messages.map((message, index) => {
            const isLastAssistant =
              isRunning && message.role === "assistant" && index === chat.messages.length - 1
            return (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={isLastAssistant}
                isMobile={isMobile}
                repo={isNewRepo ? undefined : chat.repo}
                onOpenFile={onOpenFile}
                onForcePush={onForcePush}
              />
            )
          })}
          {/* Show loading indicator when sandbox is being created */}
          {isCreating && (
            <div className="text-2xl text-muted-foreground animate-pulse">...</div>
          )}
          {/* Surface the latest agent/streaming error inline so users see why
              their last run stopped. Cleared on the next send. */}
          {chat.status === "error" && chat.errorMessage && (
            <ErrorBanner key={chat.id} message={chat.errorMessage} isMobile={isMobile} />
          )}
          {/* Queue shelf — lives at the bottom of the scroll area so it
              scrolls out of view with the conversation. */}
          <QueueShelf
            messages={chat.queuedMessages ?? []}
            canBranch={canBranch}
            isMobile={isMobile}
            onBranchQueuedMessage={onBranchQueuedMessage}
            onRemoveQueuedMessage={onRemoveQueuedMessage}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input - fixed at bottom on mobile */}
      <div
        className={cn(
          "bg-background",
          isMobile
            ? hasQueued
              ? "px-[27px] pt-0 pb-3 pb-safe"
              : "px-[27px] py-3 pb-safe"
            : hasQueued
              ? "px-[31px] pt-0 pb-4"
              : "px-[31px] pb-4 pt-2"
        )}
      >
        {chatInput}
      </div>
    </div>
  )
}
