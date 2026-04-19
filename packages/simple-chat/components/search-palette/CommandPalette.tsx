"use client"

import { GitMerge, GitBranch, GitPullRequest, GitCommitVertical, Plus, GitBranchPlus, Settings, Github, PanelLeft } from "lucide-react"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command"
import { SLASH_COMMANDS } from "@upstream/common"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GitMerge,
  GitBranch,
  GitPullRequest,
  GitCommitVertical,
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRunCommand: (command: string) => void
  onNewChat: () => void
  /** Omitted when the current chat has no branch to fork from. */
  onBranchChat?: () => void
  /** Omitted when the current chat has no pushed branch on GitHub. */
  onOpenInGitHub?: () => void
  onOpenSettings: () => void
  onToggleSidebar?: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  onRunCommand,
  onNewChat,
  onBranchChat,
  onOpenInGitHub,
  onOpenSettings,
  onToggleSidebar,
}: CommandPaletteProps) {
  const handleSelect = (command: string) => {
    onRunCommand(command)
    onOpenChange(false)
  }

  const run = (fn: () => void) => {
    fn()
    onOpenChange(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Commands"
      description="Run a command"
    >
      <CommandInput placeholder="Type a command..." />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="Chat">
          <CommandItem value="new chat" onSelect={() => run(onNewChat)}>
            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>New Chat</span>
          </CommandItem>
          {onBranchChat && (
            <CommandItem value="branch chat" onSelect={() => run(onBranchChat)}>
              <GitBranchPlus className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Branch from current chat</span>
            </CommandItem>
          )}
          {onOpenInGitHub && (
            <CommandItem value="open in github" onSelect={() => run(onOpenInGitHub)}>
              <Github className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Open in GitHub</span>
            </CommandItem>
          )}
        </CommandGroup>
        <CommandGroup heading="Git Commands">
          {SLASH_COMMANDS.map((cmd) => {
            const Icon = iconMap[cmd.icon]
            return (
              <CommandItem
                key={cmd.name}
                value={cmd.name}
                onSelect={() => handleSelect(cmd.name)}
              >
                {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                <span>{cmd.description}</span>
                <CommandShortcut>/{cmd.name}</CommandShortcut>
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandGroup heading="Application">
          {onToggleSidebar && (
            <CommandItem value="toggle sidebar" onSelect={() => run(onToggleSidebar)}>
              <PanelLeft className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Toggle Sidebar</span>
            </CommandItem>
          )}
          <CommandItem value="settings" onSelect={() => run(onOpenSettings)}>
            <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
