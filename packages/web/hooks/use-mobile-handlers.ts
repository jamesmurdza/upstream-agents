import { useCallback } from "react"
import type { Branch } from "@/lib/shared/types"
import type { TransformedRepo } from "@/lib/db/db-types"
import { toggleSandbox, createPR } from "@/lib/git/git-actions"

interface UseMobileHandlersOptions {
  activeBranch: Branch | null
  activeRepo: TransformedRepo | null
  handleUpdateBranch: (branchId: string, updates: Partial<Branch>) => void
  mobileSandboxToggleLoading: boolean
  setMobileSandboxToggleLoading: React.Dispatch<React.SetStateAction<boolean>>
  mobilePrLoading: boolean
  setMobilePrLoading: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * Provides mobile-specific action handlers (sandbox toggle, PR creation)
 */
export function useMobileHandlers({
  activeBranch,
  activeRepo,
  handleUpdateBranch,
  mobileSandboxToggleLoading,
  setMobileSandboxToggleLoading,
  mobilePrLoading,
  setMobilePrLoading,
}: UseMobileHandlersOptions) {
  // Toggle sandbox start/stop
  const handleMobileSandboxToggle = useCallback(async () => {
    if (!activeBranch?.sandboxId || mobileSandboxToggleLoading) return
    setMobileSandboxToggleLoading(true)
    try {
      const result = await toggleSandbox(activeBranch.sandboxId, activeBranch.status)
      handleUpdateBranch(activeBranch.id, { status: result.newStatus })
    } catch {
      // ignore
    } finally {
      setMobileSandboxToggleLoading(false)
    }
  }, [activeBranch, mobileSandboxToggleLoading, handleUpdateBranch, setMobileSandboxToggleLoading])

  // Create or open PR
  const handleMobileCreatePR = useCallback(async () => {
    if (!activeBranch || !activeRepo) return
    // If PR already exists, just open it
    if (activeBranch.prUrl) {
      window.open(activeBranch.prUrl, "_blank")
      return
    }
    setMobilePrLoading(true)
    try {
      const result = await createPR(activeRepo.owner, activeRepo.name, activeBranch.name, activeBranch.baseBranch)
      handleUpdateBranch(activeBranch.id, { prUrl: result.url })
      window.open(result.url, "_blank")
    } catch {
      // Silently fail
    } finally {
      setMobilePrLoading(false)
    }
  }, [activeBranch, activeRepo, handleUpdateBranch, setMobilePrLoading])

  return {
    handleMobileSandboxToggle,
    handleMobileCreatePR,
  }
}

export type MobileHandlers = ReturnType<typeof useMobileHandlers>
