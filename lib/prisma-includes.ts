/**
 * Prisma Include Patterns
 *
 * Centralizes common Prisma include patterns used across API routes.
 */

import { Prisma } from "@prisma/client"
import { PAGINATION } from "@/lib/constants"

// =============================================================================
// Branch Includes
// =============================================================================

export const INCLUDE_BRANCH_WITH_MESSAGES = {
  sandbox: true,
  messages: {
    orderBy: { createdAt: "asc" },
    take: PAGINATION.MESSAGES_PER_REQUEST,
  },
} satisfies Prisma.BranchInclude

export const INCLUDE_BRANCH_FOR_LIST = {
  sandbox: true,
  messages: false,
  _count: {
    select: { messages: true },
  },
} satisfies Prisma.BranchInclude

export const INCLUDE_BRANCH_WITH_REPO = {
  repo: true,
} satisfies Prisma.BranchInclude

export const INCLUDE_BRANCH_WITH_REPO_AND_SANDBOX = {
  repo: true,
  sandbox: true,
} satisfies Prisma.BranchInclude

// =============================================================================
// Repo Includes
// =============================================================================

export const INCLUDE_REPO_FOR_LIST = {
  branches: {
    include: INCLUDE_BRANCH_FOR_LIST,
    orderBy: { updatedAt: "desc" },
    take: PAGINATION.BRANCHES_PER_REPO,
  },
  _count: {
    select: { branches: true },
  },
} satisfies Prisma.RepoInclude

export const INCLUDE_REPO_WITH_BRANCHES = {
  branches: true,
} satisfies Prisma.RepoInclude

// =============================================================================
// Sandbox Includes
// =============================================================================

export const INCLUDE_SANDBOX_WITH_USER_CREDENTIALS = {
  user: { include: { credentials: true } },
  branch: { include: { repo: true } },
} satisfies Prisma.SandboxInclude

// =============================================================================
// Message Includes
// =============================================================================

export const INCLUDE_MESSAGE_WITH_BRANCH = {
  branch: { include: { repo: true } },
} satisfies Prisma.MessageInclude

// =============================================================================
// Agent Execution Includes
// =============================================================================

export const INCLUDE_EXECUTION_WITH_CONTEXT = {
  message: {
    include: {
      branch: {
        include: {
          sandbox: {
            include: {
              user: {
                include: {
                  credentials: true,
                },
              },
            },
          },
          repo: true,
        },
      },
    },
  },
} satisfies Prisma.AgentExecutionInclude
