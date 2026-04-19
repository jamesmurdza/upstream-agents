"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { highlight } from "sugar-high"
import { cn } from "@/lib/utils"
import {
  FileCode2,
  RefreshCw,
  X,
  TerminalSquare,
  Globe,
  Loader2,
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
  sandboxId: string | null
  onClose?: () => void
  className?: string
  style?: React.CSSProperties
}

export function PreviewView({
  item,
  sandboxId,
  onClose,
  className,
  style,
}: PreviewViewProps) {
  const [refreshKey, setRefreshKey] = useState(0)

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

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
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

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {item?.type === "file" ? (
            <FileBody
              key={`${item.filePath}-${refreshKey}`}
              filePath={item.filePath}
              sandboxId={sandboxId}
            />
          ) : item?.type === "terminal" ? (
            <TerminalBody key={`${item.id}-${refreshKey}`} sandboxId={sandboxId} />
          ) : item?.type === "server" ? (
            <ServerBody key={`${item.url}-${refreshKey}`} url={item.url} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// File viewer
// ---------------------------------------------------------------------------

function FileBody({ filePath, sandboxId }: { filePath: string; sandboxId: string | null }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sandboxId) {
      setError("No sandbox.")
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch("/api/sandbox/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandboxId, action: "read-file", filePath }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || `Failed to load ${filePath}`)
          setContent(null)
        } else {
          setContent(typeof data.content === "string" ? data.content : "")
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sandboxId, filePath])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1 p-4 text-sm text-destructive">
        <div>{error}</div>
      </div>
    )
  }
  return <HighlightedCode code={content ?? ""} />
}

function HighlightedCode({ code }: { code: string }) {
  const lines = code.split("\n").map((_, i) => i)
  const html = highlight(code)
  const lineHtmls = html.split("\n")
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <tbody>
          {lines.map((i) => (
            <tr key={i} className="leading-5">
              <td className="select-none text-right text-muted-foreground/50 pr-3 pl-3 align-top w-1 whitespace-nowrap">
                {i + 1}
              </td>
              <td
                className="pr-3 whitespace-pre-wrap break-all"
                dangerouslySetInnerHTML={{ __html: lineHtmls[i] ?? "" }}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Terminal (xterm.js + sandbox PTY WebSocket)
// ---------------------------------------------------------------------------

const TERMINAL_THEMES = {
  dark: {
    background: "#1a1a1a",
    foreground: "#e0e0e0",
    cursor: "#ffffff",
    cursorAccent: "#1a1a1a",
    selectionBackground: "rgba(255, 255, 255, 0.3)",
    selectionForeground: "#ffffff",
  },
  light: {
    background: "#ffffff",
    foreground: "#1a1a1a",
    cursor: "#000000",
    cursorAccent: "#ffffff",
    selectionBackground: "rgba(0, 0, 0, 0.2)",
    selectionForeground: "#000000",
  },
}

function TerminalBody({ sandboxId }: { sandboxId: string | null }) {
  const { resolvedTheme } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<import("xterm").Terminal | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const fitRef = useRef<import("xterm-addon-fit").FitAddon | null>(null)
  const [status, setStatus] = useState<"connecting" | "connected" | "error" | "disconnected">("connecting")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const initialized = useRef(false)

  const terminalTheme = resolvedTheme === "dark" ? TERMINAL_THEMES.dark : TERMINAL_THEMES.light

  const connect = useCallback(async (wsUrl: string) => {
    if (!ref.current) return
    const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
      import("xterm"),
      import("xterm-addon-fit"),
      import("xterm-addon-web-links"),
    ])
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: terminalTheme,
      allowProposedApi: true,
      scrollback: 10000,
    })
    terminalRef.current = term
    const fit = new FitAddon()
    fitRef.current = fit
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(ref.current)
    setTimeout(() => { try { fit.fit() } catch {} }, 0)

    const sock = new WebSocket(wsUrl)
    socketRef.current = sock
    sock.onopen = () => {
      setStatus("connected")
      const { cols, rows } = term
      sock.send(JSON.stringify({ type: "resize", cols, rows }))
    }
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === "data" && msg.payload) term.write(msg.payload)
      } catch {}
    }
    sock.onerror = () => {
      setStatus("error")
      setErrorMessage("Connection error")
    }
    sock.onclose = (ev) => {
      setStatus("disconnected")
      setErrorMessage(`closed code=${ev.code}${ev.reason ? ` reason=${ev.reason}` : ""}`)
    }
    term.onData((data) => {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(JSON.stringify({ type: "input", payload: data }))
      }
    })
    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        if (sock.readyState === WebSocket.OPEN) {
          const { cols, rows } = term
          sock.send(JSON.stringify({ type: "resize", cols, rows }))
        }
      } catch {}
    })
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      sock.close()
      term.dispose()
    }
  }, [terminalTheme])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    if (!sandboxId) {
      setStatus("error")
      setErrorMessage("No sandbox.")
      return
    }
    fetch("/api/sandbox/terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandboxId, action: "setup" }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.status === "running" && data.websocketUrl) {
          connect(data.websocketUrl)
        } else {
          setStatus("error")
          setErrorMessage(data.error || "Failed to start terminal server")
        }
      })
      .catch((err) => {
        setStatus("error")
        setErrorMessage(err instanceof Error ? err.message : "Connection error")
      })
    return () => {
      socketRef.current?.close()
      socketRef.current = null
      terminalRef.current?.dispose()
      terminalRef.current = null
      fitRef.current = null
    }
  }, [sandboxId, connect])

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.options.theme = terminalTheme
  }, [terminalTheme])

  return (
    <div className="flex-1 h-full w-full relative" style={{ backgroundColor: terminalTheme.background }}>
      <div
        ref={ref}
        className="h-full w-full"
        style={{
          padding: "6px 8px",
          ...(status === "connecting" || status === "error" ? { visibility: "hidden" as const } : {}),
        }}
      />
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Starting terminal…</span>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-red-500">Terminal error</span>
            <span className="text-xs text-muted-foreground">{errorMessage}</span>
          </div>
        </div>
      )}
      {status === "disconnected" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-yellow-600">Disconnected</span>
            <span className="text-xs text-muted-foreground">{errorMessage || "Session ended"}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Server (live preview)
// ---------------------------------------------------------------------------

function ServerBody({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      className="h-full w-full border-0 bg-white"
      title="Live preview"
    />
  )
}
