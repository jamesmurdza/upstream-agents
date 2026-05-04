"use client"

import { Brain } from "lucide-react"
import type { PanelPlugin, PanelProps, PreviewItem } from "../types"
import { MarkdownPreview } from "@/lib/file-preview"

function PlanViewerComponent({ item, messages }: PanelProps) {
  if (item.type !== "plan") return null

  // Find the message containing the plan. The stream updates messages automatically.
  const message = messages?.find((m) => m.id === item.messageId)
  const content = message?.content || item.content

  return (
    <MarkdownPreview
      content={content}
      className="h-full"
    />
  )
}

export const PlanViewerPlugin: PanelPlugin = {
  id: "plan-viewer",

  canHandle: (item: PreviewItem) => item.type === "plan",

  getLabel: () => "Plan",

  getIcon: () => Brain,

  Component: PlanViewerComponent,
}
