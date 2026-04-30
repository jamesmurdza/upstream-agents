"use client"

import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface WelcomeViewProps {
  chatInput: React.ReactNode
  onOpenHelp?: () => void
  isMobile: boolean
}

export function WelcomeView({ chatInput, onOpenHelp, isMobile }: WelcomeViewProps) {
  return (
    <div
      className={cn(
        "flex-1 flex flex-col items-center justify-center bg-background relative",
        isMobile ? "p-4 pb-safe" : "p-4"
      )}
    >
      {onOpenHelp && (
        <button
          onClick={onOpenHelp}
          className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Help"
          aria-label="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      )}
      <div className="text-center mb-6">
        <h2 className={cn("font-semibold", isMobile ? "text-xl" : "text-2xl")}>
          What would you like to build?
        </h2>
      </div>
      {chatInput}
      <div
        className={cn(
          "text-muted-foreground mt-4 text-center",
          isMobile ? "text-sm px-4" : "text-sm"
        )}
      >
        <p>
          Agents live in{" "}
          <a
            href="https://www.daytona.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 hover:text-foreground transition-colors"
          >
            Daytona sandboxes
          </a>{" "}
          tied to Git branches.
        </p>
        <p className="mt-1">Access additional tools with ⌘K.</p>
      </div>
    </div>
  )
}
