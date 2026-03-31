"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useExecutionPoller } from "@/hooks/use-execution-poller"
import type { Branch, Message } from "@/lib/shared/types"
import { BRANCH_STATUS } from "@/lib/shared/constants"

interface PanelState {
  branch: Branch
  sandboxId: string
  messageContent: string
  contentLength: number
  pollCount: number
}

function AgentPanel({ initial }: { initial: PanelState }) {
  const [branch, setBranch] = useState<Branch>(initial.branch)
  const [content, setContent] = useState("")
  const [contentLength, setContentLength] = useState(0)
  const [pollCount, setPollCount] = useState(0)
  const pollCountRef = useRef(0)

  const onUpdateMessage = useCallback(
    (_branchId: string, messageId: string, updates: Partial<Message>) => {
      if (updates.content !== undefined) {
        setContent(updates.content)
        setContentLength(updates.content.length)
      }
      pollCountRef.current++
      setPollCount(pollCountRef.current)
    },
    [],
  )

  const onUpdateBranch = useCallback((_branchId: string, updates: Partial<Branch>) => {
    setBranch(prev => ({ ...prev, ...updates }))
  }, [])

  const onForceSave = useCallback(() => {}, [])

  const { startPolling } = useExecutionPoller({
    branch,
    onUpdateMessage,
    onUpdateBranch,
    onForceSave,
  })

  // Expose startPolling to the page so the test can trigger execution
  useEffect(() => {
    const el = document.querySelector(`[data-testid="panel-${branch.id}"]`)
    if (el) {
      ;(el as any).__startPolling = startPolling
      ;(el as any).__sandboxId = initial.sandboxId
    }
  }, [branch.id, startPolling, initial.sandboxId])

  return (
    <div data-testid={`panel-${branch.id}`} style={{ border: "1px solid #ccc", padding: 16, margin: 8 }}>
      <div data-testid={`status-${branch.id}`}>{branch.status}</div>
      <div data-testid={`content-length-${branch.id}`}>{contentLength}</div>
      <div data-testid={`poll-count-${branch.id}`}>{pollCount}</div>
      <div data-testid={`content-${branch.id}`}>{content}</div>
    </div>
  )
}

export default function PollingTestPage() {
  const searchParams = useSearchParams()
  const [panels, setPanels] = useState<PanelState[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const branchIds = searchParams.get("branches")?.split(",").filter(Boolean) || []
    const sandboxIds = searchParams.get("sandboxIds")?.split(",").filter(Boolean) || []
    if (branchIds.length === 0) return

    const newPanels: PanelState[] = branchIds.map((id, i) => ({
      branch: {
        id,
        name: `test-branch-${i}`,
        messages: [],
        status: BRANCH_STATUS.RUNNING,
        baseBranch: "main",
      },
      sandboxId: sandboxIds[i] || "",
      messageContent: "",
      contentLength: 0,
      pollCount: 0,
    }))
    setPanels(newPanels)
  }, [searchParams])

  if (error) return <div data-testid="error">{error}</div>

  return (
    <div data-testid="polling-test-page">
      <div data-testid="panel-count">{panels.length}</div>
      {panels.map(p => (
        <AgentPanel key={p.branch.id} initial={p} />
      ))}
    </div>
  )
}
