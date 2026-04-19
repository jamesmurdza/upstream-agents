"use client"

import { cn } from "@/lib/utils"
import { FileCode2 } from "lucide-react"

interface PreviewViewProps {
  fileName?: string
  className?: string
}

export function PreviewView({ fileName = "hello.ts", className }: PreviewViewProps) {
  return (
    <div className={cn("hidden xl:flex flex-col p-3 pl-0 min-h-0", className)}>
      <div className="flex-1 min-h-0 rounded-2xl border border-border bg-card shadow-sm flex flex-col overflow-hidden">
        {/* Titlebar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
          <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium truncate">{fileName}</span>
        </div>

        {/* File body — pseudo syntax-highlighted mockup. */}
        <div className="flex-1 min-h-0 overflow-auto font-mono text-[12px] leading-5">
          <pre className="p-4 text-foreground/90">
            <span className="text-muted-foreground">{`// Sample file showing the preview pane.`}</span>{"\n"}
            <span className="text-muted-foreground">{`// This is a mockup — not wired to anything yet.`}</span>{"\n\n"}
            <span className="text-purple-500 dark:text-purple-400">import</span>
            {" { "}
            <span className="text-cyan-600 dark:text-cyan-300">useState</span>
            {", "}
            <span className="text-cyan-600 dark:text-cyan-300">useEffect</span>
            {" } "}
            <span className="text-purple-500 dark:text-purple-400">from</span>{" "}
            <span className="text-emerald-600 dark:text-emerald-400">&quot;react&quot;</span>
            {"\n\n"}
            <span className="text-purple-500 dark:text-purple-400">export function</span>{" "}
            <span className="text-yellow-600 dark:text-yellow-300">Counter</span>
            {"("}
            <span className="text-muted-foreground">{}</span>
            {")"}
            {" {"}
            {"\n  "}
            <span className="text-purple-500 dark:text-purple-400">const</span>
            {" ["}
            <span className="text-cyan-600 dark:text-cyan-300">count</span>
            {", "}
            <span className="text-cyan-600 dark:text-cyan-300">setCount</span>
            {"] = "}
            <span className="text-yellow-600 dark:text-yellow-300">useState</span>
            {"("}
            <span className="text-orange-500 dark:text-orange-400">0</span>
            {")"}
            {"\n\n  "}
            <span className="text-yellow-600 dark:text-yellow-300">useEffect</span>
            {"(() => {"}
            {"\n    "}
            <span className="text-cyan-600 dark:text-cyan-300">document</span>
            {"."}
            <span className="text-cyan-600 dark:text-cyan-300">title</span>
            {" = "}
            <span className="text-emerald-600 dark:text-emerald-400">{"`count: ${count}`"}</span>
            {"\n  }, [count])"}
            {"\n\n  "}
            <span className="text-purple-500 dark:text-purple-400">return</span>
            {" ("}
            {"\n    "}
            {"<"}<span className="text-rose-500 dark:text-rose-400">button</span>
            {" "}
            <span className="text-sky-600 dark:text-sky-300">onClick</span>
            {"={() => "}
            <span className="text-yellow-600 dark:text-yellow-300">setCount</span>
            {"("}
            <span className="text-cyan-600 dark:text-cyan-300">count</span>
            {" + "}
            <span className="text-orange-500 dark:text-orange-400">1</span>
            {")"}
            {"}"}
            {">"}
            {"\n      Clicked "}
            {"{"}
            <span className="text-cyan-600 dark:text-cyan-300">count</span>
            {"}"}
            {" times"}
            {"\n    </"}<span className="text-rose-500 dark:text-rose-400">button</span>
            {">"}
            {"\n  )"}
            {"\n}"}
            {"\n"}
          </pre>
        </div>
      </div>
    </div>
  )
}
