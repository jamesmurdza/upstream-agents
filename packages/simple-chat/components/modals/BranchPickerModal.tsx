"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import * as Dialog from "@radix-ui/react-dialog"
import { Search, GitBranch, Loader2, ChevronLeft } from "lucide-react"
import { ModalHeader, focusChatPrompt } from "@/components/ui/modal-header"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { fetchBranches } from "@/lib/github"
import type { GitHubBranch } from "@/lib/types"

interface BranchPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (branch: string) => void
  repo: string
  owner: string
  defaultBranch?: string
  isMobile?: boolean
}

export function BranchPickerModal({
  open,
  onClose,
  onSelect,
  repo,
  owner,
  defaultBranch = "main",
  isMobile = false,
}: BranchPickerModalProps) {
  const { data: session } = useSession()
  const [branches, setBranches] = useState<GitHubBranch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  useEffect(() => {
    if (open && session?.accessToken && repo && owner) {
      setLoading(true)
      setError(null)
      setSelectedBranch(defaultBranch)

      fetchBranches(session.accessToken, owner, repo)
        .then(setBranches)
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to fetch branches"))
        .finally(() => setLoading(false))
    }
  }, [open, session?.accessToken, repo, owner, defaultBranch])

  useEffect(() => {
    if (open) {
      setSelectedBranch(defaultBranch)
      setSearch("")
      setError(null)
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [open, defaultBranch])

  const filteredBranches = branches.filter((branch) =>
    branch.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = useCallback(() => {
    if (selectedBranch) {
      onSelect(selectedBranch)
      onClose()
    }
  }, [selectedBranch, onSelect, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSelect()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filteredBranches.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    }
  }, [handleSelect, filteredBranches.length])

  return (
    <Dialog.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 animate-in fade-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-background shadow-lg",
            isMobile ? "max-h-[85vh] rounded-t-2xl" : "max-w-[480px] rounded-2xl max-h-[80vh]",
            "animate-in fade-in zoom-in-95"
          )}
        >
          <ModalHeader
            title="Select Branch"
            onClose={onClose}
          />

          <div className="flex flex-col overflow-hidden">
            <div className={cn("flex items-center gap-2 border-b border-border", isMobile ? "p-3" : "p-4 pt-2")}>
              <GitBranch className={cn("text-muted-foreground", isMobile ? "h-5 w-5" : "h-4 w-4")} />
              <span className={cn("font-medium", isMobile ? "text-base" : "text-sm")}>
                {owner}/{repo}
              </span>
            </div>

            <div className={cn("flex items-center gap-2 border-b border-border", isMobile ? "p-3 pt-0" : "p-4 pt-2")}>
              <Search className={cn("text-muted-foreground shrink-0", isMobile ? "h-5 w-5" : "h-4 w-4")} />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search branches..."
                className={cn("bg-transparent focus:outline-none", isMobile ? "text-base" : "text-sm")}
              />
            </div>

            <div
              ref={searchInputRef}
              onKeyDown={handleKeyDown}
              className={cn("overflow-y-auto", isMobile ? "flex-1" : "flex-1 min-h-0")}
              style={{ maxHeight: "calc(80vh - 180px)" }}
            >
              {loading && (
                <div className="flex items-center justify-center p-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}

              {error && (
                <div className="p-4 text-sm text-destructive">{error}</div>
              )}

              {!loading && !error && filteredBranches.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {search ? "No branches match your search" : "No branches found"}
                </div>
              )}

              {!loading && !error && filteredBranches.length > 0 && (
                <div className="py-2">
                  {filteredBranches.map((branch, index) => (
                    <button
                      key={branch.name}
                      onClick={() => {
                        setSelectedBranch(branch.name)
                        handleSelect()
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-4 py-2 text-left transition-colors",
                        isMobile ? "text-base" : "text-sm",
                        index === selectedIndex || branch.name === selectedBranch
                          ? "bg-accent"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <GitBranch className={cn("text-muted-foreground", isMobile ? "h-5 w-5" : "h-4 w-4")} />
                      <span className="flex-1 truncate">{branch.name}</span>
                      {branch.name === defaultBranch && (
                        <span className="text-xs text-muted-foreground">default</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={cn("flex items-center justify-between border-t border-border", isMobile ? "p-3" : "p-3")}>
              <button
                onClick={onClose}
                className={cn(
                  "flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors",
                  isMobile ? "text-base" : "text-sm"
                )}
              >
                <ChevronLeft className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                Back
              </button>

              <button
                onClick={handleSelect}
                disabled={!selectedBranch}
                className={cn(
                  "flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50",
                  isMobile ? "text-base" : "text-sm"
                )}
              >
                Select
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}