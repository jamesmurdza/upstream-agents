import type { Chat, Settings, Agent, PendingFile, CredentialFlags } from "@/lib/types"
import type { RebaseConflictState } from "@upstream/common"
import type { HighlightKey } from "../modals/SettingsModal"
import type { SlashCommandType } from "../SlashCommandMenu"

export interface ChatPanelProps {
  chat: Chat | null
  settings: Settings
  credentialFlags: CredentialFlags
  onSendMessage: (message: string, agent: string, model: string, files?: File[]) => void
  onEnqueueMessage?: (message: string, agent?: string, model?: string) => void
  onRemoveQueuedMessage?: (id: string) => void
  onResumeQueue?: () => void
  onStopAgent: () => void
  onChangeRepo?: () => void
  onChangeBranch?: () => void
  onUpdateChat?: (updates: Partial<Chat>) => void
  onOpenSettings?: (highlightKey?: HighlightKey) => void
  onSlashCommand?: (command: SlashCommandType) => void
  onRequireSignIn?: () => void
  onDeleteChat?: () => void
  onOpenHelp?: () => void
  onOpenFile?: (filePath: string) => void
  /** Callback to open the force-push modal (from push-failure system messages). */
  onForcePush?: () => void
  isMobile?: boolean
  /** Conflict state for merge/rebase */
  rebaseConflict?: RebaseConflictState
  /** Callback to abort the current conflict */
  onAbortConflict?: () => void
  /** Whether an action is loading (e.g., aborting) */
  conflictActionLoading?: boolean
  /** Callback to branch and send a message to the new branch chat */
  onBranchWithMessage?: (message: string, agent: string, model: string) => void
  /** Callback to branch a queued message (removes from queue) */
  onBranchQueuedMessage?: (id: string, message: string, agent?: string, model?: string) => void
  /** Whether branching is available (has repo and branch) */
  canBranch?: boolean
  /** Whether messages are currently being loaded for this chat */
  isLoadingMessages?: boolean
  /** Current draft text for this chat */
  draft?: string
  /** Callback when draft text changes */
  onDraftChange?: (draft: string) => void
}

export interface ChatInputProps {
  chat: Chat
  input: string
  setInput: (value: string) => void
  pendingFiles: PendingFile[]
  onAddFiles: (files: FileList | File[]) => void
  onRemoveFile: (id: string) => void
  isDraggingOver: boolean
  setIsDraggingOver: (value: boolean) => void
  onSend: () => void
  onStopAgent: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  // Agent/model state
  currentAgent: Agent
  currentModel: string
  availableModels: { value: string; label: string; requiresKey: string }[]
  hasRequiredCredentials: boolean
  onAgentChange: (agent: Agent) => void
  onModelChange: (model: string) => void
  credentialFlags: CredentialFlags
  // Repo state
  showRepoButton: boolean
  isNewRepo: boolean
  isNewChat: boolean
  onChangeRepo?: () => void
  onChangeBranch?: () => void
  onUpdateChat?: (updates: Partial<Chat>) => void
  // Slash command state
  slashMenuOpen: boolean
  setSlashMenuOpen: (open: boolean) => void
  slashSelectedIndex: number
  setSlashSelectedIndex: (index: number) => void
  onSlashCommand?: (command: SlashCommandType) => void
  onAbortConflict?: () => void
  hasLinkedRepo: boolean
  inConflict: boolean
  // Status flags
  isCreating: boolean
  isRunning: boolean
  canSend: boolean
  canQueue: boolean
  isPaused: boolean
  // Mobile
  isMobile: boolean
  // Branching
  canBranch: boolean
  onBranchWithMessage?: (message: string, agent: string, model: string) => void
  // Settings
  onOpenSettings?: (highlightKey?: HighlightKey) => void
}

export interface ChatHeaderProps {
  chat: Chat
  isMobile: boolean
  // Title editing
  isEditingTitle: boolean
  editTitleValue: string
  setEditTitleValue: (value: string) => void
  startEditingTitle: () => void
  saveTitle: () => void
  cancelEditingTitle: () => void
  titleInputRef: React.RefObject<HTMLInputElement | null>
  // Menu state
  titleMenuOpen: boolean
  setTitleMenuOpen: (open: boolean) => void
  titleMenuRef: React.RefObject<HTMLDivElement | null>
  // Conflict state
  inConflict: boolean
  isMergeConflict: boolean
  conflictMenuOpen: boolean
  setConflictMenuOpen: (open: boolean) => void
  conflictMenuRef: React.RefObject<HTMLDivElement | null>
  conflictedFiles?: string[]
  onAbortConflict?: () => void
  conflictActionLoading: boolean
  // Actions
  onOpenSettings?: () => void
  onDeleteChat?: () => void
  githubBranchUrl: string | null
}

export interface ErrorBannerProps {
  message: string
  isMobile?: boolean
}
