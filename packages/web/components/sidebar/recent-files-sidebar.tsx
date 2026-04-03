"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/shared/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Loader2, Terminal, Globe, Copy, Check } from "lucide-react"

interface ModifiedFile {
  path: string
  modifiedAt: number
  size: number
}

interface FileContent {
  path: string
  content: string
  modifiedAt: number
  size: number
}

interface DevServer {
  port: number
  url: string
}

interface RecentFilesSidebarProps {
  sandboxId: string | null | undefined
  repoPath: string
  /** Cache key to preserve state across branch switches */
  cacheKey: string
  /** Preview URL pattern from the branch (e.g., "https://{port}-xxx.daytonaproxy.net") */
  previewUrlPattern?: string
}

// Cache for files per sandbox/branch
const filesCache = new Map<string, { files: ModifiedFile[]; timestamp: number }>()
const CACHE_TTL = 30000 // 30 seconds

// Cache for file content
const contentCache = new Map<string, { content: FileContent; timestamp: number }>()
const CONTENT_CACHE_TTL = 60000 // 1 minute

// Cache for servers per sandbox
const serversCache = new Map<string, { ports: number[]; previewUrlPattern: string | null; timestamp: number }>()
const SERVERS_CACHE_TTL = 5000 // 5 seconds (check more frequently)

/**
 * Extract display info from file path
 * Returns short name (2-4 chars) and extension
 */
function getFileDisplayInfo(filePath: string): { shortName: string; ext: string; filename: string } {
  const parts = filePath.split("/")
  const filename = parts[parts.length - 1] || ""
  const dotIndex = filename.lastIndexOf(".")

  const baseName = dotIndex > 0 ? filename.slice(0, dotIndex) : filename
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : ""

  // Create a short name: up to 4 chars, smart truncation
  let shortName: string
  if (baseName.length <= 4) {
    shortName = baseName
  } else {
    // Try to find natural break points (camelCase, snake_case, kebab-case)
    const camelMatch = baseName.match(/^[a-z]+/i)
    if (camelMatch && camelMatch[0].length >= 2 && camelMatch[0].length <= 4) {
      shortName = camelMatch[0]
    } else {
      // Just take first 3-4 chars
      shortName = baseName.slice(0, 4)
    }
  }

  return { shortName: shortName.toLowerCase(), ext, filename }
}

/**
 * Get color for file extension
 */
function getExtColor(ext: string): string {
  const colors: Record<string, string> = {
    ".ts": "text-blue-500",
    ".tsx": "text-blue-400",
    ".js": "text-yellow-500",
    ".jsx": "text-yellow-400",
    ".json": "text-orange-500",
    ".py": "text-green-500",
    ".go": "text-cyan-500",
    ".rs": "text-orange-600",
    ".md": "text-gray-500",
    ".css": "text-pink-500",
    ".html": "text-red-500",
    ".txt": "text-gray-400",
    ".log": "text-amber-500",
  }
  return colors[ext] || "text-muted-foreground"
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

/** Check if file is older than 5 minutes */
function isOldFile(modifiedAt: number): boolean {
  return Date.now() - modifiedAt > 5 * 60 * 1000
}

function FileIcon({ file, isLoading, onClick, isPinned }: {
  file: ModifiedFile
  isLoading: boolean
  onClick: () => void
  isPinned: boolean
}) {
  const { shortName, ext } = getFileDisplayInfo(file.path)
  const extColor = getExtColor(ext)
  const isOld = isOldFile(file.modifiedAt)

  // Adjust font size based on name length
  const nameSize = shortName.length <= 2 ? "text-[10px]" : shortName.length <= 3 ? "text-[9px]" : "text-[8px]"

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-md transition-all",
        "bg-secondary hover:bg-accent",
        isPinned && "ring-2 ring-primary",
        isOld && "opacity-40 hover:opacity-100"
      )}
    >
      <div className="flex flex-col items-center justify-center leading-none gap-0.5">
        <span className={cn(nameSize, "font-semibold text-foreground font-mono")}>{shortName}</span>
        <span className={cn("text-[7px] font-medium", extColor)}>{ext}</span>
      </div>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
          <Loader2 className="h-3 w-3 animate-spin" />
        </div>
      )}
    </button>
  )
}

function FilePreviewPopover({
  file,
  content,
  isLoading,
  error,
  open,
  onOpenChange,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  file: ModifiedFile
  content: FileContent | null
  isLoading: boolean
  error: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  children: React.ReactNode
}) {
  const { filename, ext } = getFileDisplayInfo(file.path)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        sideOffset={8}
        className="w-[500px] max-w-[90vw] max-h-[80vh] p-0 overflow-hidden"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2 bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("text-xs font-medium", getExtColor(ext))}>{ext}</span>
            <span className="font-mono text-xs truncate">{filename}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
            <span>{formatSize(file.size)}</span>
            <span>{formatRelativeTime(file.modifiedAt)}</span>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[calc(80vh-40px)]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32 text-sm text-destructive">
              {error}
            </div>
          ) : content ? (
            <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all overflow-x-auto">
              {content.content}
            </pre>
          ) : null}
        </div>

        {/* Footer with full path */}
        <div className="border-t border-border px-3 py-1.5 bg-muted/30">
          <p className="font-mono text-[10px] text-muted-foreground truncate">{file.path}</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ServerIcon({ server, onOpenUrl }: {
  server: DevServer
  onOpenUrl: (url: string) => void
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onOpenUrl(server.url)}
            className={cn(
              "relative flex h-9 w-9 items-center justify-center rounded-md transition-all",
              "bg-secondary hover:bg-accent"
            )}
          >
            <div className="flex flex-col items-center justify-center leading-none gap-0.5">
              <Globe className="h-3.5 w-3.5 text-foreground" />
              <span className="text-[8px] font-semibold text-foreground font-mono">
                {server.port}
              </span>
            </div>
            {/* Pulsing indicator for active server */}
            <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs font-mono">{server.port}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function TerminalButton({ sandboxId, onSshCommand }: {
  sandboxId: string
  onSshCommand: (command: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [sshCommand, setSshCommand] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const fetchSshCommand = useCallback(async () => {
    if (sshCommand) return // Already fetched

    setLoading(true)
    try {
      const res = await fetch("/api/sandbox/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId }),
      })

      if (res.ok) {
        const data = await res.json()
        setSshCommand(data.sshCommand)
        onSshCommand(data.sshCommand)
      }
    } catch (err) {
      console.error("Failed to get SSH command:", err)
    } finally {
      setLoading(false)
    }
  }, [sandboxId, sshCommand, onSshCommand])

  const handleCopy = useCallback(async () => {
    if (sshCommand) {
      await navigator.clipboard.writeText(sshCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [sshCommand])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={() => {
            setOpen(true)
            fetchSshCommand()
          }}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-md transition-all",
            "bg-secondary hover:bg-accent"
          )}
        >
          <Terminal className="h-4 w-4 text-foreground" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-md">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="end" sideOffset={8} className="w-[400px] p-0">
        <div className="border-b border-border px-3 py-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-foreground" />
            <span className="font-semibold text-sm">SSH into Sandbox</span>
          </div>
        </div>
        <div className="p-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sshCommand ? (
            <>
              <div className="relative">
                <pre className="p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all pr-10">
                  {sshCommand}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Valid for 60 minutes.
              </p>
            </>
          ) : (
            <p className="text-sm text-destructive">Failed to generate SSH command</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}


export function RecentFilesSidebar({ sandboxId, repoPath, cacheKey, previewUrlPattern: propPreviewUrlPattern }: RecentFilesSidebarProps) {
  const [files, setFiles] = useState<ModifiedFile[]>([])
  const [pinnedFileIndex, setPinnedFileIndex] = useState<number | null>(null)
  const [hoveredFileIndex, setHoveredFileIndex] = useState<number | null>(null)
  const [loadingContent, setLoadingContent] = useState<string | null>(null)
  const [fileContents, setFileContents] = useState<Map<string, FileContent>>(new Map())
  const [contentError, setContentError] = useState<string | null>(null)
  const [servers, setServers] = useState<DevServer[]>([])
  const [previewUrlPattern, setPreviewUrlPattern] = useState<string | null>(propPreviewUrlPattern || null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const serverPollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch modified files
  const fetchModifiedFiles = useCallback(async () => {
    if (!sandboxId || !repoPath) return

    // Check cache first
    const cached = filesCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setFiles(cached.files)
      return
    }

    try {
      const res = await fetch("/api/sandbox/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          repoPath,
          action: "list-modified",
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const newFiles = data.files || []
        setFiles(newFiles)
        filesCache.set(cacheKey, { files: newFiles, timestamp: Date.now() })
      }
    } catch (err) {
      console.error("Failed to fetch modified files:", err)
    }
  }, [sandboxId, repoPath, cacheKey])

  // Fetch running servers
  const fetchServers = useCallback(async () => {
    if (!sandboxId || !repoPath) return

    // Check cache first
    const cacheKeySrv = `servers-${sandboxId}`
    const cached = serversCache.get(cacheKeySrv)
    if (cached && Date.now() - cached.timestamp < SERVERS_CACHE_TTL) {
      const pattern = cached.previewUrlPattern || propPreviewUrlPattern
      if (pattern) {
        setServers(cached.ports.map(port => ({
          port,
          url: pattern.replace("{port}", String(port))
        })))
        setPreviewUrlPattern(pattern)
      }
      return
    }

    try {
      const res = await fetch("/api/sandbox/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          repoPath,
          action: "list-servers",
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const ports: number[] = data.ports || []
        const pattern = data.previewUrlPattern || propPreviewUrlPattern

        serversCache.set(cacheKeySrv, {
          ports,
          previewUrlPattern: pattern,
          timestamp: Date.now()
        })

        if (pattern) {
          setServers(ports.map(port => ({
            port,
            url: pattern.replace("{port}", String(port))
          })))
          setPreviewUrlPattern(pattern)
        } else {
          setServers([])
        }
      }
    } catch (err) {
      console.error("Failed to fetch servers:", err)
    }
  }, [sandboxId, repoPath, propPreviewUrlPattern])

  // Fetch file content
  const fetchFileContent = useCallback(async (filePath: string) => {
    if (!sandboxId || !repoPath) return

    // Check cache first
    const cached = contentCache.get(filePath)
    if (cached && Date.now() - cached.timestamp < CONTENT_CACHE_TTL) {
      setFileContents((prev) => new Map(prev).set(filePath, cached.content))
      return
    }

    setLoadingContent(filePath)
    setContentError(null)

    try {
      const res = await fetch("/api/sandbox/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId,
          repoPath,
          action: "read-file",
          filePath,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setFileContents((prev) => new Map(prev).set(filePath, data))
        contentCache.set(filePath, { content: data, timestamp: Date.now() })
      } else if (res.status === 413) {
        setContentError("File too large to preview")
      } else {
        setContentError("Failed to load file")
      }
    } catch (err) {
      console.error("Failed to fetch file content:", err)
      setContentError("Failed to load file")
    } finally {
      setLoadingContent(null)
    }
  }, [sandboxId, repoPath])

  // Load cached files immediately on mount or cache key change
  useEffect(() => {
    const cached = filesCache.get(cacheKey)
    if (cached) {
      setFiles(cached.files)
    } else {
      setFiles([])
    }
    // Clear open popover on branch switch
    setPinnedFileIndex(null)
    setHoveredFileIndex(null)
  }, [cacheKey])

  // Poll for modified files
  useEffect(() => {
    if (!sandboxId || !repoPath) {
      setFiles([])
      return
    }

    // Initial fetch
    fetchModifiedFiles()

    // Poll every 5 seconds
    pollIntervalRef.current = setInterval(fetchModifiedFiles, 5000)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [sandboxId, repoPath, fetchModifiedFiles])

  // Poll for running servers
  useEffect(() => {
    if (!sandboxId || !repoPath) {
      setServers([])
      return
    }

    // Initial fetch
    fetchServers()

    // Poll every 5 seconds
    serverPollIntervalRef.current = setInterval(fetchServers, 5000)

    return () => {
      if (serverPollIntervalRef.current) {
        clearInterval(serverPollIntervalRef.current)
      }
    }
  }, [sandboxId, repoPath, fetchServers])

  // Handle file icon click - pins the popover open
  const handleFileClick = useCallback((index: number) => {
    if (pinnedFileIndex === index) {
      // Unpin if already pinned
      setPinnedFileIndex(null)
    } else {
      // Pin this file
      setPinnedFileIndex(index)
    }
  }, [pinnedFileIndex])

  // Handle mouse enter - show popover on hover
  const handleMouseEnter = useCallback((index: number, file: ModifiedFile) => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    // Don't override pinned state
    if (pinnedFileIndex !== null) return

    setHoveredFileIndex(index)

    // Fetch content if needed
    if (!fileContents.has(file.path)) {
      fetchFileContent(file.path)
    }
  }, [pinnedFileIndex, fileContents, fetchFileContent])

  // Handle mouse leave - hide popover after a short delay (unless pinned)
  const handleMouseLeave = useCallback(() => {
    // Don't close if pinned
    if (pinnedFileIndex !== null) return

    // Small delay to allow moving to the popover
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredFileIndex(null)
    }, 200)
  }, [pinnedFileIndex])

  // Handle popover content mouse enter - cancel the close timeout
  const handlePopoverMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  // Handle popover open change (for clicking outside when pinned)
  const handleOpenChange = useCallback((index: number, open: boolean) => {
    if (!open) {
      if (pinnedFileIndex === index) {
        setPinnedFileIndex(null)
      }
      if (hoveredFileIndex === index) {
        setHoveredFileIndex(null)
      }
    }
  }, [pinnedFileIndex, hoveredFileIndex])

  // Open server URL
  const handleOpenUrl = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }, [])

  // Handle SSH command (could show toast notification, etc.)
  const handleSshCommand = useCallback((command: string) => {
    console.log("SSH command generated:", command)
  }, [])

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Check if we have any content to show
  const hasContent = files.length > 0 || servers.length > 0 || sandboxId

  // Don't render if no content and no sandbox
  if (!hasContent) {
    return null
  }

  return (
    <aside className="flex h-full w-[52px] shrink-0 flex-col items-center gap-1.5 border-l border-border bg-sidebar py-2 overflow-y-auto">
      {/* Modified Files - Top */}
      {files.map((file, index) => {
        const isPinned = pinnedFileIndex === index
        const isHovered = hoveredFileIndex === index
        const isOpen = isPinned || isHovered
        const content = fileContents.get(file.path) || null
        const isLoadingThis = loadingContent === file.path

        return (
          <FilePreviewPopover
            key={file.path}
            file={file}
            content={content}
            isLoading={isLoadingThis}
            error={isOpen && !isLoadingThis && !content ? contentError : null}
            open={isOpen}
            onOpenChange={(open) => handleOpenChange(index, open)}
            onMouseEnter={handlePopoverMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div
              onMouseEnter={() => handleMouseEnter(index, file)}
              onMouseLeave={handleMouseLeave}
            >
              <FileIcon
                file={file}
                isLoading={isLoadingThis}
                onClick={() => handleFileClick(index)}
                isPinned={isPinned}
              />
            </div>
          </FilePreviewPopover>
        )
      })}

      {/* Spacer to push servers and terminal to bottom */}
      <div className="flex-1" />

      {/* Running Servers - Above Terminal */}
      {servers.map((server) => (
        <ServerIcon
          key={server.port}
          server={server}
          onOpenUrl={handleOpenUrl}
        />
      ))}

      {/* Terminal/SSH - Bottom */}
      {sandboxId && (
        <TerminalButton
          sandboxId={sandboxId}
          onSshCommand={handleSshCommand}
        />
      )}
    </aside>
  )
}
