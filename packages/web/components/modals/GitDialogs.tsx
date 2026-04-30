/**
 * Git Dialogs - Re-exports from refactored module structure
 *
 * This file maintains backward compatibility by re-exporting all components
 * and types from the new modular structure in ./git/
 *
 * The dialogs have been split into individual files for better maintainability:
 * - git/types.ts - Type definitions
 * - git/useGitDialogs.ts - Main hook for managing dialog state
 * - git/BaseDialog.tsx - Shared dialog wrapper component
 * - git/BranchSelector.tsx - Branch selection dropdown component
 * - git/DialogButtons.tsx - Shared Cancel/Confirm button component
 * - git/MergeDialog.tsx - Merge branch dialog
 * - git/RebaseDialog.tsx - Rebase branch dialog
 * - git/PRDialog.tsx - Create pull request dialog
 * - git/SquashDialog.tsx - Squash commits dialog
 * - git/ForcePushDialog.tsx - Force push confirmation dialog
 */

// Re-export everything from the new modular structure
export {
  // Types
  type RebaseConflictState,
  type PRDescriptionType,
  type UseGitDialogsOptions,
  type UseGitDialogsResult,
  // Hook
  useGitDialogs,
  // Shared components
  BaseDialog,
  type BaseDialogProps,
  BranchSelector,
  type BranchSelectorProps,
  DialogButtons,
  type DialogButtonsProps,
  // Dialog components
  MergeDialog,
  RebaseDialog,
  PRDialog,
  SquashDialog,
  ForcePushDialog,
} from "./git"
