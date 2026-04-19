"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  FileCode2,
  RefreshCw,
  X,
  ChevronDown,
  TerminalSquare,
  Globe,
  Check,
} from "lucide-react"

/**
 * The item currently shown in the preview pane. One-at-a-time by design:
 * closing the current item clears it; opening another replaces it.
 */
export type PreviewItem =
  | { type: "file"; filePath: string; filename: string }
  | { type: "terminal"; id: string }
  | { type: "server"; port: number; url: string }

export interface PreviewViewProps {
  item: PreviewItem | null
  /** Additional openable items surfaced in the titlebar action menu. */
  availableServers?: Array<{ port: number; url: string }>
  terminalAvailable?: boolean
  onOpenTerminal?: () => void
  onOpenServer?: (port: number, url: string) => void
  onClose?: () => void
  onRefresh?: () => void
  className?: string
  style?: React.CSSProperties
}

export function PreviewView({
  item,
  availableServers = [],
  terminalAvailable = true,
  onOpenTerminal,
  onOpenServer,
  onClose,
  onRefresh,
  className,
  style,
}: PreviewViewProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [menuOpen])

  const title =
    item?.type === "file"
      ? item.filename
      : item?.type === "terminal"
      ? "Terminal"
      : item?.type === "server"
      ? `Live preview · :${item.port}`
      : "Preview"

  const TitleIcon =
    item?.type === "terminal"
      ? TerminalSquare
      : item?.type === "server"
      ? Globe
      : FileCode2

  return (
    <div className={cn("flex flex-col min-h-0 bg-card", className)} style={style}>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Titlebar */}
        <div className="flex items-center gap-2 px-4 py-3">
          <TitleIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium truncate flex-1">{title}</span>

          {/* Action menu: pick what shows in the pane */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-6 items-center gap-0.5 rounded-md px-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              title="Open…"
              aria-label="Preview actions"
            >
              <span className="text-[11px]">Open</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 min-w-[200px] rounded-md border border-border bg-popover shadow-md py-1 z-50">
                {terminalAvailable && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenTerminal?.()
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
                  >
                    <TerminalSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 text-left">Terminal</span>
                    {item?.type === "terminal" && <Check className="h-3.5 w-3.5" />}
                  </button>
                )}
                {availableServers.length > 0 && (
                  <>
                    <div className="my-1 border-t border-border/60" />
                    {availableServers.map((s) => (
                      <button
                        key={s.port}
                        onClick={() => {
                          setMenuOpen(false)
                          onOpenServer?.(s.port, s.url)
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
                      >
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex-1 text-left">Live preview · :{s.port}</span>
                        {item?.type === "server" && item.port === s.port && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ))}
                  </>
                )}
                {!terminalAvailable && availableServers.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nothing to open yet.
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onRefresh}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            title="Refresh"
            aria-label="Refresh preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            title="Close"
            aria-label="Close preview"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body — one content kind at a time */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {!item ? (
            <EmptyState />
          ) : item.type === "file" ? (
            <FileBody filePath={item.filePath} />
          ) : item.type === "terminal" ? (
            <TerminalBody />
          ) : (
            <ServerBody url={item.url} />
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
      <FileCode2 className="h-5 w-5" />
      <div>Nothing open yet.</div>
      <div className="text-xs">Click a file path in the chat or pick something from Open.</div>
    </div>
  )
}

function FileBody({ filePath }: { filePath: string }) {
  // Mockup body — real implementation will fetch file contents from the
  // sandbox via /api/sandbox/files (read-file action) and syntax-highlight.
  return (
    <div className="h-full overflow-auto font-mono text-[12px] leading-5">
      <pre className="p-4 text-foreground/80">
        <span className="text-muted-foreground">{`// ${filePath}`}</span>{"\n"}
        <span className="text-muted-foreground">{`// Preview wiring not connected yet — placeholder contents.`}</span>
      </pre>
    </div>
  )
}

function TerminalBody() {
  // Mockup terminal — real implementation will connect xterm.js to the
  // sandbox PTY WebSocket provisioned by /api/sandbox/terminal (setup).
  return (
    <div className="h-full bg-black/90 text-green-300 font-mono text-[12px] leading-5 p-4 overflow-auto">
      <div>$ terminal placeholder</div>
      <div className="text-green-200/70">
        # real xterm + websocket pty will land in a follow-up commit.
      </div>
    </div>
  )
}

function ServerBody({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      className="h-full w-full border-0 bg-white"
      title="Live preview"
    />
  )
}
