"use client"

import { cn } from "@/lib/utils"

interface ChatInputSkeletonProps {
  isMobile: boolean
}

export function ChatInputSkeleton({ isMobile }: ChatInputSkeletonProps) {
  return (
    <div
      className={cn(
        "flex flex-col border border-border bg-card shadow-sm",
        isMobile ? "rounded-xl" : "rounded-2xl"
      )}
    >
      <div className={cn(isMobile ? "px-3 py-3" : "px-4 py-3")}>
        <div className="h-5 w-1/3 rounded bg-muted" />
      </div>
      <div
        className={cn(
          "flex items-center gap-2 border-t border-border",
          isMobile ? "px-3 py-2" : "px-4 py-2"
        )}
      >
        <div className="h-6 w-20 rounded bg-muted" />
        <div className="h-6 w-24 rounded bg-muted" />
        <div className="flex-1" />
        <div
          className={cn(
            "rounded-md bg-muted",
            isMobile ? "h-9 w-9" : "h-7 w-7"
          )}
        />
      </div>
    </div>
  )
}

export function ChatPanelSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="flex-1 flex flex-col bg-background min-h-0 animate-pulse">
      {!isMobile && (
        <div className="pt-3 pl-[1.625rem] pr-4">
          <div className="h-6 w-40 rounded bg-muted" />
        </div>
      )}
      <div className="flex-1" />
      <div
        className={cn(
          "w-full mx-auto",
          isMobile ? "max-w-full px-3 pb-3" : "max-w-[52rem] px-4 pb-4"
        )}
      >
        <ChatInputSkeleton isMobile={isMobile} />
      </div>
    </div>
  )
}

export function LoadingMessagesSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="flex-1 flex flex-col bg-background min-h-0 animate-pulse">
      {!isMobile && (
        <div className="pt-3 pl-[1.625rem] pr-4">
          <div className="h-6 w-48 rounded bg-muted" />
        </div>
      )}
      <div className="flex-1" />
      <div
        className={cn(
          "w-full mx-auto",
          isMobile ? "max-w-full px-3 pb-3" : "max-w-[52rem] px-4 pb-4"
        )}
      >
        <div
          className={cn(
            "flex flex-col border border-border bg-card shadow-sm",
            isMobile ? "rounded-xl" : "rounded-2xl"
          )}
        >
          <div className={cn(isMobile ? "px-3 py-3" : "px-4 py-3")}>
            <div className="h-5 w-1/4 rounded bg-muted" />
          </div>
          <div
            className={cn(
              "flex items-center gap-2 border-t border-border",
              isMobile ? "px-3 py-2" : "px-4 py-2"
            )}
          >
            <div className="h-6 w-20 rounded bg-muted" />
            <div className="h-6 w-24 rounded bg-muted" />
            <div className="flex-1" />
            <div
              className={cn(
                "rounded-md bg-muted",
                isMobile ? "h-9 w-9" : "h-7 w-7"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
