"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useExecutionPoller } from "@/hooks/use-execution-poller"
import type { Branch, Message, ToolCall, ContentBlock } from "@/lib/shared/types"
import { BRANCH_STATUS } from "@/lib/shared/constants"

function generateId() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface PanelState {
  branch: Branch
  sandboxId: string
  repoName: string
}

function AgentPanel({ initial }: { initial: PanelState }) {
  const [branch, setBranch] = useState<Branch>(initial.branch)
  const [content, setContent] = useState("")
  const [contentLength, setContentLength] = useState(0)
  const [toolCallCount, setToolCallCount] = useState(0)
  const [contentBlockCount, setContentBlockCount] = useState(0)
  const [toolCallTools, setToolCallTools] = useState<string[]>([])
  const [pollCount, setPollCount] = useState(0)
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "polling" | "done" | "error">("idle")
  const [sendError, setSendError] = useState("")
  const pollCountRef = useRef(0)

  const onUpdateMessage = useCallback(
    (_branchId: string, _messageId: string, updates: Partial<Message>) => {
      if (updates.content !== undefined) {
        setContent(updates.content)
        setContentLength(updates.content.length)
      }
      if (updates.toolCalls !== undefined) {
        setToolCallCount(updates.toolCalls.length)
        setToolCallTools(updates.toolCalls.map(tc => tc.tool))
      }
      if (updates.contentBlocks !== undefined && updates.contentBlocks) {
        setContentBlockCount(updates.contentBlocks.length)
      }
      pollCountRef.current++
      setPollCount(pollCountRef.current)
    },
    [],
  )

  const onUpdateBranch = useCallback((_branchId: string, updates: Partial<Branch>) => {
    setBranch(prev => ({ ...prev, ...updates }))
    if (updates.status === BRANCH_STATUS.IDLE) {
      setSendStatus("done")
    }
  }, [])

  const onForceSave = useCallback(() => {}, [])

  const { startPolling } = useExecutionPoller({
    branch,
    onUpdateMessage,
    onUpdateBranch,
    onForceSave,
  })

  // handleSend: mirrors the real chat-panel flow
  // 1. POST user message to /api/branches/messages
  // 2. POST assistant message to /api/branches/messages → get DB messageId
  // 3. startPolling(messageId) + set branch RUNNING (batched)
  // 4. POST /api/agent/execute with messageId
  const handleSend = useCallback(async (prompt: string) => {
    const branchId = branch.id
    setSendStatus("sending")

    try {
      // 1. Persist user message
      const userRes = await fetch("/api/branches/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          role: "user",
          content: prompt,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }),
      })
      if (!userRes.ok) throw new Error(`Failed to save user message: ${userRes.status}`)

      // 2. Persist empty assistant message → get real DB ID
      const asstRes = await fetch("/api/branches/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          role: "assistant",
          content: "",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          assistantSource: "model",
        }),
      })
      if (!asstRes.ok) throw new Error(`Failed to save assistant message: ${asstRes.status}`)
      const { message: asstMsg } = await asstRes.json()
      const messageId = asstMsg.id

      // 3. startPolling + set RUNNING (same sync block, like real app)
      startPolling(messageId)
      setBranch(prev => ({ ...prev, status: BRANCH_STATUS.RUNNING }))
      setSendStatus("polling")

      // 4. POST /api/agent/execute
      const execRes = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sandboxId: initial.sandboxId,
          prompt,
          repoName: initial.repoName,
          messageId,
          agent: "opencode",
        }),
      })
      if (!execRes.ok) {
        const errData = await execRes.json().catch(() => ({}))
        throw new Error(errData.error || errData.message || `Execute failed: ${execRes.status}`)
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unknown error")
      setSendStatus("error")
      setBranch(prev => ({ ...prev, status: BRANCH_STATUS.IDLE }))
    }
  }, [branch.id, initial.sandboxId, initial.repoName, startPolling])

  // Expose handleSend to Playwright via DOM
  useEffect(() => {
    const el = document.querySelector(`[data-testid="panel-${branch.id}"]`)
    if (el) {
      ;(el as any).__handleSend = handleSend
    }
  }, [branch.id, handleSend])

  return (
    <div data-testid={`panel-${branch.id}`} style={{ border: "1px solid #ccc", padding: 16, margin: 8 }}>
      <div data-testid={`status-${branch.id}`}>{branch.status}</div>
      <div data-testid={`send-status-${branch.id}`}>{sendStatus}</div>
      <div data-testid={`send-error-${branch.id}`}>{sendError}</div>
      <div data-testid={`content-length-${branch.id}`}>{contentLength}</div>
      <div data-testid={`tool-call-count-${branch.id}`}>{toolCallCount}</div>
      <div data-testid={`tool-call-tools-${branch.id}`}>{toolCallTools.join(",")}</div>
      <div data-testid={`content-block-count-${branch.id}`}>{contentBlockCount}</div>
      <div data-testid={`poll-count-${branch.id}`}>{pollCount}</div>
      <div data-testid={`content-${branch.id}`}>{content}</div>
    </div>
  )
}

export default function PollingTestPage() {
  const searchParams = useSearchParams()
  const [panels, setPanels] = useState<PanelState[]>([])

  useEffect(() => {
    const branchIds = searchParams.get("branches")?.split(",").filter(Boolean) || []
    const sandboxIds = searchParams.get("sandboxIds")?.split(",").filter(Boolean) || []
    const repoNames = searchParams.get("repoNames")?.split(",").filter(Boolean) || []
    if (branchIds.length === 0) return

    const newPanels: PanelState[] = branchIds.map((id, i) => ({
      branch: {
        id,
        name: `test-branch-${i}`,
        messages: [],
        status: BRANCH_STATUS.IDLE,
        baseBranch: "main",
      },
      sandboxId: sandboxIds[i] || "",
      repoName: repoNames[i] || "",
    }))
    setPanels(newPanels)
  }, [searchParams])

  return (
    <div data-testid="polling-test-page">
      <div data-testid="panel-count">{panels.length}</div>
      {panels.map(p => (
        <AgentPanel key={p.branch.id} initial={p} />
      ))}
    </div>
  )
}
