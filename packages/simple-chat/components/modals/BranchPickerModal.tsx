"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import * as Dialog from "@radix-ui/react-dialog"
import { Search, GitBranch, Loader2, ChevronLeft, X } from "lucide-react"
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

  const handleSelect = useCallback((branchName?: string) => {
    const branch = branchName ?? selectedBranch
    if (branch) {
      onSelect(branch)
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
        <Dialog.Overlay className={cn(
            "fixed inset-0 z-50 transition-opacity duration-300 bg-black/15 backdrop-blur-[1px]",
            open ? "opacity-100" : "opacity-0"
          )} />
        <Dialog.Content
          onCloseAutoFocus={(e) => { e.preventDefault(); focusChatPrompt() }}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            setTimeout(() => {
              searchInputRef.current?.focus()
            }, 0)
          }}
          className={cn(
            "fixed z-50 bg-popover flex flex-col",
            "overflow-hidden",
            isMobile
              ? "inset-x-0 bottom-0 top-0 rounded-none"
              : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md border border-border rounded-lg shadow-xl",
            "animate-in fade-in zoom-in-95 duration-200"
          )}
        >
          <ModalHeader title="Select Branch" />

          <div className="flex flex-col overflow-hidden">
            <div className={cn("flex items-center gap-2 border-b border-border", isMobile ? "p-4" : "p-4")}>
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
              className={cn("flex-1 overflow-y-auto", isMobile ? "max-h-none" : "max-h-80")}
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
                <div className={cn(isMobile ? "p-3" : "p-2")}>
                  {filteredBranches.map((branch, index) => (
                    <button
                      key={branch.name}
                      onClick={() => handleSelect(branch.name)}
                      className={cn(
                        "flex items-center gap-2 w-full rounded-lg hover:bg-accent active:bg-accent transition-colors text-left",
                        isMobile ? "px-4 py-4" : "px-3 py-2",
                        index === selectedIndex && "bg-accent"
                      )}
                    >
                      <GitBranch className={cn("text-muted-foreground shrink-0", isMobile ? "h-5 w-5" : "h-4 w-4")} />
                      <span className="flex-1 truncate">{branch.name}</span>
                      {branch.name === defaultBranch && (
                        <span className="text-xs text-muted-foreground">default</span>
                      )}
                      {branch.name === selectedBranch && (
                        <X className={cn("text-primary shrink-0", isMobile ? "h-5 w-5" : "h-4 w-4")} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={cn("flex justify-end gap-2 border-t border-border", isMobile ? "p-4" : "p-4")}>
              <button
                onClick={onClose}
                className={cn(
                  "rounded-md hover:bg-accent active:bg-accent transition-colors",
                  isMobile ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"
                )}
              >
                Back
              </button>

              <button
                onClick={handleSelect}
                disabled={!selectedBranch}
                className={cn(
                  "bg-primary text-primary-foreground rounded-md hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50",
                  isMobile ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"
                )}
              >
                OK
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}