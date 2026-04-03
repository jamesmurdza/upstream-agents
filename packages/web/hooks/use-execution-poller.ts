/**
 * @deprecated Per-branch polling lives in {@link useExecutionManager} + execution-store.
 * `isBranchPolling` now reflects global execution tracking so sync/load guards stay correct
 * when multiple agents run on different branches.
 */
export { isBranchStreaming as isBranchPolling, hasActiveExecutions } from "@/lib/stores/execution-store"
