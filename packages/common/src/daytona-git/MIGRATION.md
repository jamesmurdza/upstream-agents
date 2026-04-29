# Migration Guide: Daytona SDK → daytona-git

## Quick Migration

The API is designed to be a drop-in replacement. Here's how to migrate each file:

---

## 1. `lib/sandbox.ts`

### Before
```typescript
import type { Daytona } from "@daytonaio/sdk"

// ... in createSandboxForChat():
await sandbox.git.clone(
  cloneUrl,
  repoPath,
  baseBranch,
  undefined,
  "x-access-token",
  githubToken!
)
await sandbox.git.createBranch(repoPath, newBranch)
await sandbox.git.checkoutBranch(repoPath, newBranch)
```

### After
```typescript
import type { Daytona } from "@daytonaio/sdk"
import { createSandboxGit } from "@upstream/common/daytona-git"

// ... in createSandboxForChat():
const git = createSandboxGit(sandbox)

await git.clone(
  cloneUrl,
  repoPath,
  baseBranch,
  undefined,
  "x-access-token",
  githubToken!
)
await git.createBranch(repoPath, newBranch)
await git.checkoutBranch(repoPath, newBranch)
```

---

## 2. `app/api/sandbox/git/route.ts`

### Before
```typescript
const currentStatus = await sandbox.git.status(repoPath)
await sandbox.git.pull(repoPath, "x-access-token", githubToken)
await sandbox.git.push(repoPath, "x-access-token", githubToken)
```

### After
```typescript
import { createSandboxGit } from "@upstream/common/daytona-git"

// At the top of try block:
const git = createSandboxGit(sandbox)

// Then replace:
const currentStatus = await git.status(repoPath)
await git.pull(repoPath, "x-access-token", githubToken)
await git.push(repoPath, "x-access-token", githubToken)
```

---

## 3. `app/api/git/push/route.ts`

### Before
```typescript
await sandbox.git.push(repoPath, "x-access-token", githubToken)
```

### After
```typescript
import { createSandboxGit } from "@upstream/common/daytona-git"

const git = createSandboxGit(sandbox)
await git.push(repoPath, "x-access-token", githubToken)
```

---

## 4. `app/api/agent/stream/route.ts`

### Before
```typescript
await sandbox.git.push(repoPath, "x-access-token", githubToken)
```

### After
```typescript
import { createSandboxGit } from "@upstream/common/daytona-git"

const git = createSandboxGit(sandbox)
await git.push(repoPath, "x-access-token", githubToken)
```

---

## Full Migration Checklist

- [ ] Add import: `import { createSandboxGit } from "@upstream/common/daytona-git"`
- [ ] Create git instance: `const git = createSandboxGit(sandbox)`
- [ ] Replace `sandbox.git.clone` → `git.clone`
- [ ] Replace `sandbox.git.createBranch` → `git.createBranch`
- [ ] Replace `sandbox.git.checkoutBranch` → `git.checkoutBranch`
- [ ] Replace `sandbox.git.status` → `git.status`
- [ ] Replace `sandbox.git.pull` → `git.pull`
- [ ] Replace `sandbox.git.push` → `git.push`

---

## Error Handling

The new package throws typed errors:

```typescript
import {
  createSandboxGit,
  GitError,
  GitAuthError,
  GitNotFoundError,
} from "@upstream/common/daytona-git"

try {
  await git.push(repoPath, "x-access-token", token)
} catch (error) {
  if (error instanceof GitAuthError) {
    // Token expired or invalid
    return Response.json({ error: "Authentication failed" }, { status: 401 })
  }
  if (error instanceof GitNotFoundError) {
    // Repo doesn't exist or no access
    return Response.json({ error: "Repository not found" }, { status: 404 })
  }
  if (error instanceof GitError) {
    // Other git error
    console.error(`Git failed: ${error.command} -> ${error.output}`)
    return Response.json({ error: error.message }, { status: 500 })
  }
  throw error
}
```

---

## Type Changes

The `GitStatus` type is similar but may have slight differences:

### Daytona SDK
```typescript
interface GitStatus {
  currentBranch: string
  // ... other fields
}
```

### daytona-git
```typescript
interface GitStatus {
  currentBranch: string
  ahead: number
  behind: number
  isPublished: boolean
  fileStatus: FileStatus[]
}
```

If you only use `currentBranch`, no changes needed. If you use other fields, check the type definitions.
