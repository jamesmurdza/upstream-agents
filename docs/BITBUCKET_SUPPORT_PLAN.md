# BitBucket Support Implementation Plan

This document outlines the complete implementation plan for adding BitBucket support to the sandboxed-agents platform.

## Table of Contents

1. [Overview](#overview)
2. [Current Architecture](#current-architecture)
3. [Implementation Phases](#implementation-phases)
4. [Detailed Task Breakdown](#detailed-task-breakdown)
5. [API Mapping](#api-mapping)
6. [Database Changes](#database-changes)
7. [Testing Strategy](#testing-strategy)
8. [Rollout Plan](#rollout-plan)

---

## Overview

### Goal
Enable users to connect their BitBucket accounts and manage repositories alongside existing GitHub support, maintaining feature parity across both providers.

### Scope
- BitBucket OAuth authentication
- Repository listing, creation, and forking
- Branch management
- Sandbox creation with BitBucket repos
- Pull request creation
- Git operations (clone, push, status)

### Out of Scope (Future Enhancements)
- GitLab support
- Azure DevOps support
- Self-hosted BitBucket Server instances
- BitBucket Pipelines integration

---

## Current Architecture

### Authentication Flow
```
User → Login Page → GitHub OAuth → NextAuth.js → Session + Token Storage
```

### Repository Flow
```
User → Add Repo Modal → GitHub API → Database → Sandbox Creation → Agent Execution
```

### Key Components
| Component | Location | Purpose |
|-----------|----------|---------|
| Auth Config | `lib/auth.ts` | NextAuth.js configuration |
| GitHub Client | `lib/github-client.ts` | GitHub API wrapper |
| API Helpers | `lib/api-helpers.ts` | Token retrieval, auth checks |
| Sandbox Creation | `app/api/sandbox/create/route.ts` | Clone repos into Daytona |
| Add Repo UI | `components/add-repo-modal.tsx` | Repository selection interface |

---

## Implementation Phases

### Phase 1: Authentication & Database (Priority: Critical)
**Duration: 2-3 hours**

Add BitBucket OAuth provider and update database schema to support multiple Git providers.

### Phase 2: Provider Abstraction Layer (Priority: Critical)
**Duration: 4-6 hours**

Create abstraction layer to support multiple Git providers without code duplication.

### Phase 3: BitBucket API Routes (Priority: Critical)
**Duration: 4-6 hours**

Implement all BitBucket-specific API endpoints.

### Phase 4: Sandbox Integration (Priority: Critical)
**Duration: 3-4 hours**

Update sandbox creation to handle BitBucket repositories.

### Phase 5: Frontend Updates (Priority: High)
**Duration: 3-4 hours**

Update UI components to support provider selection and display.

### Phase 6: Testing & Documentation (Priority: High)
**Duration: 4-6 hours**

Comprehensive testing and documentation updates.

---

## Detailed Task Breakdown

### Phase 1: Authentication & Database

#### Task 1.1: Update Prisma Schema
**File:** `prisma/schema.prisma`

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?

  // GitHub fields (existing)
  githubId      String?   @unique
  githubLogin   String?

  // BitBucket fields (NEW)
  bitbucketId     String?   @unique
  bitbucketLogin  String?

  accounts      Account[]
  sessions      Session[]
  repos         Repo[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Repo {
  id            String   @id @default(cuid())
  owner         String   // GitHub: owner, BitBucket: workspace
  name          String   // GitHub: name, BitBucket: slug
  defaultBranch String   @default("main")
  avatar        String?
  provider      String   @default("github") // NEW: "github" | "bitbucket"

  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  branches      Branch[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([userId, owner, name, provider]) // Updated constraint
}
```

#### Task 1.2: Add BitBucket Provider to NextAuth
**File:** `lib/auth.ts`

```typescript
import BitBucketProvider from "next-auth/providers/bitbucket"

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: { params: { scope: "repo read:user" } },
    }),
    // NEW: BitBucket Provider
    BitBucketProvider({
      clientId: process.env.BITBUCKET_CLIENT_ID!,
      clientSecret: process.env.BITBUCKET_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "repository account pullrequest:write"
        }
      }
    }),
  ],
  // Update callbacks to handle both providers...
}
```

#### Task 1.3: Update Environment Variables
**File:** `.env.example`

```env
# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# BitBucket OAuth (NEW)
BITBUCKET_CLIENT_ID=
BITBUCKET_CLIENT_SECRET=
```

#### Task 1.4: Run Database Migration
```bash
npx prisma migrate dev --name add_bitbucket_support
npx prisma generate
```

---

### Phase 2: Provider Abstraction Layer

#### Task 2.1: Create Git Provider Interface
**File:** `lib/git-provider/types.ts` (NEW)

```typescript
export type ProviderType = "github" | "bitbucket"

export interface GitUser {
  id: string
  login: string
  name: string | null
  email: string | null
  avatarUrl: string
}

export interface GitRepo {
  id: string
  name: string
  owner: string
  fullName: string
  description: string | null
  defaultBranch: string
  isPrivate: boolean
  avatarUrl: string
  cloneUrl: string
  htmlUrl: string
}

export interface GitBranch {
  name: string
  commit: {
    sha: string
    message?: string
  }
  isDefault: boolean
}

export interface GitCompareResult {
  ahead: number
  behind: number
  commits: GitCommit[]
  files: GitFile[]
}

export interface GitCommit {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
}

export interface GitFile {
  filename: string
  status: "added" | "modified" | "deleted" | "renamed"
  additions: number
  deletions: number
  patch?: string
}

export interface GitPullRequest {
  id: number
  number: number
  title: string
  body: string | null
  htmlUrl: string
  state: "open" | "closed" | "merged"
  head: { ref: string; sha: string }
  base: { ref: string; sha: string }
}

export interface CreateRepoOptions {
  name: string
  description?: string
  isPrivate?: boolean
  autoInit?: boolean
}

export interface CreatePROptions {
  title: string
  body?: string
  head: string
  base: string
}

export interface GitProvider {
  readonly type: ProviderType
  readonly apiBaseUrl: string

  // User operations
  getUser(token: string): Promise<GitUser>

  // Repository operations
  getUserRepos(token: string): Promise<GitRepo[]>
  getRepo(token: string, owner: string, name: string): Promise<GitRepo>
  createRepo(token: string, options: CreateRepoOptions): Promise<GitRepo>
  forkRepo(token: string, owner: string, name: string): Promise<GitRepo>

  // Branch operations
  getBranches(token: string, owner: string, repo: string): Promise<GitBranch[]>
  compareBranches(
    token: string,
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<GitCompareResult>
  getDiff(
    token: string,
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<string>

  // Pull request operations
  createPullRequest(
    token: string,
    owner: string,
    repo: string,
    options: CreatePROptions
  ): Promise<GitPullRequest>
  getPullRequest(
    token: string,
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitPullRequest>

  // Clone URL generation
  getCloneUrl(owner: string, repo: string): string
  getAuthenticatedCloneUrl(owner: string, repo: string, token: string): string
}
```

#### Task 2.2: Create BitBucket Client
**File:** `lib/git-provider/bitbucket.ts` (NEW)

```typescript
import { GitProvider, GitUser, GitRepo, GitBranch, ... } from "./types"

const BITBUCKET_API_BASE = "https://api.bitbucket.org/2.0"

export class BitBucketProvider implements GitProvider {
  readonly type = "bitbucket" as const
  readonly apiBaseUrl = BITBUCKET_API_BASE

  private async fetch<T>(
    token: string,
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${BITBUCKET_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `BitBucket API error: ${response.status}`)
    }

    return response.json()
  }

  async getUser(token: string): Promise<GitUser> {
    const user = await this.fetch<BitBucketUser>(token, "/user")
    return {
      id: user.uuid,
      login: user.username,
      name: user.display_name,
      email: null, // Requires separate API call
      avatarUrl: user.links.avatar.href,
    }
  }

  async getUserRepos(token: string): Promise<GitRepo[]> {
    const repos: GitRepo[] = []
    let url = "/repositories?role=member&pagelen=100"

    while (url) {
      const response = await this.fetch<BitBucketPaginatedResponse<BitBucketRepo>>(
        token,
        url
      )
      repos.push(...response.values.map(this.mapRepo))
      url = response.next ? response.next.replace(BITBUCKET_API_BASE, "") : ""
    }

    return repos
  }

  async getRepo(token: string, workspace: string, slug: string): Promise<GitRepo> {
    const repo = await this.fetch<BitBucketRepo>(
      token,
      `/repositories/${workspace}/${slug}`
    )
    return this.mapRepo(repo)
  }

  async createRepo(token: string, options: CreateRepoOptions): Promise<GitRepo> {
    const user = await this.getUser(token)
    const repo = await this.fetch<BitBucketRepo>(
      token,
      `/repositories/${user.login}/${options.name}`,
      {
        method: "POST",
        body: JSON.stringify({
          scm: "git",
          is_private: options.isPrivate ?? true,
          description: options.description,
          // BitBucket doesn't have autoInit, repo is always initialized
        }),
      }
    )
    return this.mapRepo(repo)
  }

  async forkRepo(token: string, workspace: string, slug: string): Promise<GitRepo> {
    const repo = await this.fetch<BitBucketRepo>(
      token,
      `/repositories/${workspace}/${slug}/forks`,
      { method: "POST", body: JSON.stringify({}) }
    )
    return this.mapRepo(repo)
  }

  async getBranches(token: string, workspace: string, slug: string): Promise<GitBranch[]> {
    const branches: GitBranch[] = []
    let url = `/repositories/${workspace}/${slug}/refs/branches?pagelen=100`

    while (url) {
      const response = await this.fetch<BitBucketPaginatedResponse<BitBucketBranch>>(
        token,
        url
      )
      branches.push(...response.values.map(this.mapBranch))
      url = response.next ? response.next.replace(BITBUCKET_API_BASE, "") : ""
    }

    return branches
  }

  async compareBranches(
    token: string,
    workspace: string,
    slug: string,
    base: string,
    head: string
  ): Promise<GitCompareResult> {
    // BitBucket uses diffstat endpoint
    const diffstat = await this.fetch<BitBucketDiffstat>(
      token,
      `/repositories/${workspace}/${slug}/diffstat/${base}..${head}`
    )

    const commits = await this.fetch<BitBucketPaginatedResponse<BitBucketCommit>>(
      token,
      `/repositories/${workspace}/${slug}/commits?include=${head}&exclude=${base}`
    )

    return {
      ahead: commits.values.length,
      behind: 0, // Would need separate calculation
      commits: commits.values.map(this.mapCommit),
      files: diffstat.values.map(this.mapDiffFile),
    }
  }

  async getDiff(
    token: string,
    workspace: string,
    slug: string,
    base: string,
    head: string
  ): Promise<string> {
    const response = await fetch(
      `${BITBUCKET_API_BASE}/repositories/${workspace}/${slug}/diff/${base}..${head}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/plain",
        },
      }
    )
    return response.text()
  }

  async createPullRequest(
    token: string,
    workspace: string,
    slug: string,
    options: CreatePROptions
  ): Promise<GitPullRequest> {
    const pr = await this.fetch<BitBucketPullRequest>(
      token,
      `/repositories/${workspace}/${slug}/pullrequests`,
      {
        method: "POST",
        body: JSON.stringify({
          title: options.title,
          description: options.body,
          source: { branch: { name: options.head } },
          destination: { branch: { name: options.base } },
        }),
      }
    )
    return this.mapPullRequest(pr)
  }

  async getPullRequest(
    token: string,
    workspace: string,
    slug: string,
    prId: number
  ): Promise<GitPullRequest> {
    const pr = await this.fetch<BitBucketPullRequest>(
      token,
      `/repositories/${workspace}/${slug}/pullrequests/${prId}`
    )
    return this.mapPullRequest(pr)
  }

  getCloneUrl(workspace: string, slug: string): string {
    return `https://bitbucket.org/${workspace}/${slug}.git`
  }

  getAuthenticatedCloneUrl(workspace: string, slug: string, token: string): string {
    return `https://x-token-auth:${token}@bitbucket.org/${workspace}/${slug}.git`
  }

  // Private mapping methods
  private mapRepo(repo: BitBucketRepo): GitRepo {
    return {
      id: repo.uuid,
      name: repo.slug,
      owner: repo.workspace.slug,
      fullName: repo.full_name,
      description: repo.description,
      defaultBranch: repo.mainbranch?.name || "main",
      isPrivate: repo.is_private,
      avatarUrl: repo.links.avatar.href,
      cloneUrl: repo.links.clone.find(c => c.name === "https")?.href || "",
      htmlUrl: repo.links.html.href,
    }
  }

  private mapBranch(branch: BitBucketBranch): GitBranch {
    return {
      name: branch.name,
      commit: {
        sha: branch.target.hash,
        message: branch.target.message,
      },
      isDefault: false, // Determined separately
    }
  }

  private mapCommit(commit: BitBucketCommit): GitCommit {
    return {
      sha: commit.hash,
      message: commit.message,
      author: {
        name: commit.author.user?.display_name || commit.author.raw,
        email: "", // Parsed from raw if needed
        date: commit.date,
      },
    }
  }

  private mapPullRequest(pr: BitBucketPullRequest): GitPullRequest {
    return {
      id: pr.id,
      number: pr.id,
      title: pr.title,
      body: pr.description,
      htmlUrl: pr.links.html.href,
      state: pr.state === "MERGED" ? "merged" : pr.state === "OPEN" ? "open" : "closed",
      head: { ref: pr.source.branch.name, sha: pr.source.commit.hash },
      base: { ref: pr.destination.branch.name, sha: pr.destination.commit.hash },
    }
  }
}

// BitBucket API types
interface BitBucketUser {
  uuid: string
  username: string
  display_name: string
  links: { avatar: { href: string } }
}

interface BitBucketRepo {
  uuid: string
  slug: string
  full_name: string
  description: string
  is_private: boolean
  workspace: { slug: string }
  mainbranch: { name: string } | null
  links: {
    avatar: { href: string }
    clone: Array<{ name: string; href: string }>
    html: { href: string }
  }
}

interface BitBucketBranch {
  name: string
  target: { hash: string; message: string }
}

interface BitBucketCommit {
  hash: string
  message: string
  date: string
  author: { raw: string; user?: { display_name: string } }
}

interface BitBucketPullRequest {
  id: number
  title: string
  description: string
  state: "OPEN" | "MERGED" | "DECLINED" | "SUPERSEDED"
  source: { branch: { name: string }; commit: { hash: string } }
  destination: { branch: { name: string }; commit: { hash: string } }
  links: { html: { href: string } }
}

interface BitBucketPaginatedResponse<T> {
  values: T[]
  next?: string
  page: number
  pagelen: number
}

interface BitBucketDiffstat {
  values: Array<{
    status: string
    lines_added: number
    lines_removed: number
    old?: { path: string }
    new?: { path: string }
  }>
}
```

#### Task 2.3: Update GitHub Client to Implement Interface
**File:** `lib/git-provider/github.ts` (refactored from `lib/github-client.ts`)

```typescript
import { GitProvider, ... } from "./types"

export class GitHubProvider implements GitProvider {
  readonly type = "github" as const
  readonly apiBaseUrl = "https://api.github.com"

  // Implement all interface methods...
  // (Refactor existing github-client.ts code)
}
```

#### Task 2.4: Create Provider Factory
**File:** `lib/git-provider/index.ts` (NEW)

```typescript
import { GitProvider, ProviderType } from "./types"
import { GitHubProvider } from "./github"
import { BitBucketProvider } from "./bitbucket"

const providers: Record<ProviderType, GitProvider> = {
  github: new GitHubProvider(),
  bitbucket: new BitBucketProvider(),
}

export function getProvider(type: ProviderType): GitProvider {
  const provider = providers[type]
  if (!provider) {
    throw new Error(`Unknown provider: ${type}`)
  }
  return provider
}

export function isValidProvider(type: string): type is ProviderType {
  return type === "github" || type === "bitbucket"
}

export * from "./types"
export { GitHubProvider } from "./github"
export { BitBucketProvider } from "./bitbucket"
```

---

### Phase 3: API Routes

#### Task 3.1: Create Provider-Agnostic API Routes
**File:** `app/api/git/[provider]/repos/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getProvider, isValidProvider } from "@/lib/git-provider"
import { requireProviderAuth } from "@/lib/api-helpers"

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { provider: providerType } = params

  if (!isValidProvider(providerType)) {
    return NextResponse.json(
      { error: `Invalid provider: ${providerType}` },
      { status: 400 }
    )
  }

  const authResult = await requireProviderAuth(providerType)
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: 401 })
  }

  const provider = getProvider(providerType)
  const repos = await provider.getUserRepos(authResult.token)

  return NextResponse.json(repos)
}
```

#### Task 3.2: Create All Required Routes
Create similar routes for:
- `app/api/git/[provider]/repos/route.ts` - GET user repos
- `app/api/git/[provider]/repo/route.ts` - GET single repo
- `app/api/git/[provider]/branches/route.ts` - GET repo branches
- `app/api/git/[provider]/create/route.ts` - POST create repo
- `app/api/git/[provider]/fork/route.ts` - POST fork repo
- `app/api/git/[provider]/pr/route.ts` - POST create PR, GET check PR
- `app/api/git/[provider]/compare/route.ts` - GET compare branches

#### Task 3.3: Update API Helpers
**File:** `lib/api-helpers.ts`

```typescript
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./prisma"
import { ProviderType } from "./git-provider"

export async function requireProviderAuth(provider: ProviderType) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return { error: "Unauthorized" }
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: provider,
    },
  })

  if (!account?.access_token) {
    return { error: `No ${provider} account linked` }
  }

  return { token: account.access_token, userId: session.user.id }
}

export async function getProviderTokenForUser(
  userId: string,
  provider: ProviderType
): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider },
  })
  return account?.access_token ?? null
}
```

---

### Phase 4: Sandbox Integration

#### Task 4.1: Update Sandbox Creation
**File:** `app/api/sandbox/create/route.ts`

```typescript
import { getProvider, isValidProvider, ProviderType } from "@/lib/git-provider"
import { getProviderTokenForUser } from "@/lib/api-helpers"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    repoOwner,
    repoName,
    branch,
    provider = "github" // Default for backward compatibility
  } = body

  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 })
  }

  // Get token for the specific provider
  const token = await getProviderTokenForUser(session.user.id, provider as ProviderType)
  if (!token) {
    return NextResponse.json(
      { error: `No ${provider} account linked` },
      { status: 401 }
    )
  }

  const gitProvider = getProvider(provider as ProviderType)

  // Get clone URL based on provider
  const cloneUrl = gitProvider.getAuthenticatedCloneUrl(repoOwner, repoName, token)

  // Get user info for git config
  const user = await gitProvider.getUser(token)

  // Create sandbox with provider-specific configuration
  const sandbox = await daytona.create({
    // ... existing config
  })

  // Clone repository
  await sandbox.git.clone(
    cloneUrl,
    `/home/daytona/repo`,
    branch,
    undefined,
    provider === "bitbucket" ? "x-token-auth" : "x-access-token",
    token
  )

  // ... rest of setup
}
```

#### Task 4.2: Update Git Operations Route
**File:** `app/api/sandbox/git/route.ts`

```typescript
// Add provider parameter to push operations
case "push": {
  const provider = body.provider || "github"
  const token = await getProviderTokenForUser(userId, provider)

  // BitBucket uses different auth format
  const authType = provider === "bitbucket" ? "x-token-auth" : "x-access-token"

  await sandbox.git.push(repoPath, authType, token)
  return NextResponse.json({ success: true })
}
```

---

### Phase 5: Frontend Updates

#### Task 5.1: Update Login Page
**File:** `app/login/page.tsx`

```tsx
"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Github } from "lucide-react"
import { BitBucketIcon } from "@/components/icons/bitbucket"

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1>Sign in to Sandboxed Agents</h1>

      <Button onClick={() => signIn("github", { callbackUrl: "/" })}>
        <Github className="mr-2 h-4 w-4" />
        Continue with GitHub
      </Button>

      <Button onClick={() => signIn("bitbucket", { callbackUrl: "/" })}>
        <BitBucketIcon className="mr-2 h-4 w-4" />
        Continue with BitBucket
      </Button>
    </div>
  )
}
```

#### Task 5.2: Create Provider Selection Component
**File:** `components/provider-selector.tsx` (NEW)

```tsx
"use client"

import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Github } from "lucide-react"
import { BitBucketIcon } from "@/components/icons/bitbucket"

type Provider = "github" | "bitbucket"

interface ProviderSelectorProps {
  value: Provider
  onChange: (provider: Provider) => void
  disabled?: boolean
}

export function ProviderSelector({ value, onChange, disabled }: ProviderSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select provider" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="github">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub
          </div>
        </SelectItem>
        <SelectItem value="bitbucket">
          <div className="flex items-center gap-2">
            <BitBucketIcon className="h-4 w-4" />
            BitBucket
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
```

#### Task 5.3: Update Add Repo Modal
**File:** `components/add-repo-modal.tsx`

```tsx
// Add provider state
const [provider, setProvider] = useState<"github" | "bitbucket">("github")

// Update URL parsing
function parseRepoUrl(url: string): { owner: string; name: string; provider: string } | null {
  const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (githubMatch) {
    return { owner: githubMatch[1], name: githubMatch[2].replace(".git", ""), provider: "github" }
  }

  const bitbucketMatch = url.match(/bitbucket\.org\/([^/]+)\/([^/]+)/)
  if (bitbucketMatch) {
    return { owner: bitbucketMatch[1], name: bitbucketMatch[2].replace(".git", ""), provider: "bitbucket" }
  }

  return null
}

// Update API calls to use selected provider
const fetchRepos = async () => {
  const response = await fetch(`/api/git/${provider}/repos`)
  // ...
}
```

#### Task 5.4: Create BitBucket Icon Component
**File:** `components/icons/bitbucket.tsx` (NEW)

```tsx
export function BitBucketIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
    </svg>
  )
}
```

---

## API Mapping

### Endpoint Mapping: GitHub vs BitBucket

| Operation | GitHub API | BitBucket API |
|-----------|------------|---------------|
| Get User | `GET /user` | `GET /user` |
| List Repos | `GET /user/repos` | `GET /repositories?role=member` |
| Get Repo | `GET /repos/{owner}/{repo}` | `GET /repositories/{workspace}/{slug}` |
| List Branches | `GET /repos/{owner}/{repo}/branches` | `GET /repositories/{workspace}/{slug}/refs/branches` |
| Compare | `GET /repos/{owner}/{repo}/compare/{base}...{head}` | `GET /repositories/{workspace}/{slug}/diffstat/{base}..{head}` |
| Create PR | `POST /repos/{owner}/{repo}/pulls` | `POST /repositories/{workspace}/{slug}/pullrequests` |
| Get PR | `GET /repos/{owner}/{repo}/pulls/{number}` | `GET /repositories/{workspace}/{slug}/pullrequests/{id}` |
| Fork | `POST /repos/{owner}/{repo}/forks` | `POST /repositories/{workspace}/{slug}/forks` |
| Create Repo | `POST /user/repos` | `POST /repositories/{workspace}/{slug}` |

### Authentication Headers

| Provider | Header Format |
|----------|---------------|
| GitHub | `Authorization: Bearer {token}` or `Authorization: token {token}` |
| BitBucket | `Authorization: Bearer {token}` |

### Clone URL Authentication

| Provider | Authenticated Clone URL Format |
|----------|-------------------------------|
| GitHub | `https://x-access-token:{token}@github.com/{owner}/{repo}.git` |
| BitBucket | `https://x-token-auth:{token}@bitbucket.org/{workspace}/{slug}.git` |

---

## Database Changes

### Migration Script

```sql
-- Add BitBucket fields to User
ALTER TABLE "User" ADD COLUMN "bitbucketId" TEXT;
ALTER TABLE "User" ADD COLUMN "bitbucketLogin" TEXT;
CREATE UNIQUE INDEX "User_bitbucketId_key" ON "User"("bitbucketId");

-- Add provider field to Repo
ALTER TABLE "Repo" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'github';

-- Update unique constraint
DROP INDEX "Repo_userId_owner_name_key";
CREATE UNIQUE INDEX "Repo_userId_owner_name_provider_key" ON "Repo"("userId", "owner", "name", "provider");
```

---

## Testing Strategy

### Unit Tests

1. **Provider Client Tests**
   - Test each provider client method in isolation
   - Mock API responses
   - Test error handling

2. **Provider Factory Tests**
   - Test provider selection
   - Test invalid provider handling

### Integration Tests

1. **Authentication Flow**
   - Test GitHub OAuth flow
   - Test BitBucket OAuth flow
   - Test token storage and retrieval

2. **API Route Tests**
   - Test each endpoint with both providers
   - Test error responses
   - Test pagination

3. **Sandbox Creation Tests**
   - Test clone with GitHub repo
   - Test clone with BitBucket repo
   - Test git operations (push, status)

### End-to-End Tests

1. **Full Workflow Test**
   ```
   Login → Add Repo → Create Branch → Execute Agent → Push → Create PR
   ```
   Run for both GitHub and BitBucket

2. **Multi-Provider Test**
   - User with both accounts linked
   - Switch between providers
   - Manage repos from both providers

---

## Rollout Plan

### Phase 1: Internal Testing (Week 1)
- Deploy to staging environment
- Internal team testing
- Bug fixes and refinements

### Phase 2: Beta Release (Week 2)
- Enable for select users
- Gather feedback
- Monitor error rates

### Phase 3: General Availability (Week 3)
- Enable for all users
- Documentation updates
- Announcement

### Feature Flags

```typescript
// lib/feature-flags.ts
export const FEATURES = {
  BITBUCKET_ENABLED: process.env.FEATURE_BITBUCKET === "true",
}
```

Use in components:
```tsx
{FEATURES.BITBUCKET_ENABLED && (
  <Button onClick={() => signIn("bitbucket")}>
    Continue with BitBucket
  </Button>
)}
```

---

## Appendix

### Environment Variables Checklist

```env
# Required for BitBucket support
BITBUCKET_CLIENT_ID=your_client_id
BITBUCKET_CLIENT_SECRET=your_client_secret

# Optional feature flag
FEATURE_BITBUCKET=true
```

### BitBucket OAuth App Setup

1. Go to BitBucket Settings → OAuth consumers
2. Create new consumer with:
   - Name: Sandboxed Agents
   - Callback URL: `https://your-domain.com/api/auth/callback/bitbucket`
   - Permissions:
     - Account: Read
     - Repositories: Read, Write, Admin
     - Pull Requests: Read, Write

### Files Changed Summary

| Category | New Files | Modified Files |
|----------|-----------|----------------|
| Database | - | `prisma/schema.prisma` |
| Auth | - | `lib/auth.ts` |
| Provider Layer | `lib/git-provider/types.ts`, `lib/git-provider/github.ts`, `lib/git-provider/bitbucket.ts`, `lib/git-provider/index.ts` | - |
| API Routes | `app/api/git/[provider]/*` (7 files) | `app/api/sandbox/create/route.ts`, `app/api/sandbox/git/route.ts` |
| Frontend | `components/provider-selector.tsx`, `components/icons/bitbucket.tsx` | `app/login/page.tsx`, `components/add-repo-modal.tsx` |
| Config | - | `.env.example` |

### Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Auth & DB | 2-3 hours | None |
| Phase 2: Provider Layer | 4-6 hours | Phase 1 |
| Phase 3: API Routes | 4-6 hours | Phase 2 |
| Phase 4: Sandbox Integration | 3-4 hours | Phase 3 |
| Phase 5: Frontend | 3-4 hours | Phase 3 |
| Phase 6: Testing | 4-6 hours | All phases |

**Total Estimated Time: 20-29 hours**

---

*Document Version: 1.0*
*Last Updated: 2024*
*Author: AI Assistant*
