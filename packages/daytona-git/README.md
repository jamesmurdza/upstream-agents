# @upstream/daytona-git

Git operations for Daytona sandboxes via `sandbox.process.executeCommand()`.

## Why?

- **No toolbox dependency** - Works with any Daytona sandbox
- **Credentials never stored** - Passed via git `-c` flags per-operation
- **Simple API** - Just pass the token, no username needed

## Installation

```bash
npm install @upstream/daytona-git
```

## Usage

```typescript
import { Daytona } from "@daytonaio/sdk"
import { createSandboxGit } from "@upstream/daytona-git"

const daytona = new Daytona({ apiKey })
const sandbox = await daytona.get(sandboxId)
const git = createSandboxGit(sandbox)

// Clone with auth
await git.clone(
  "https://github.com/owner/repo.git",
  "/home/daytona/project",
  "main",
  undefined,
  githubToken
)

// Branch operations
await git.createBranch("/home/daytona/project", "feature/new-feature")
await git.checkoutBranch("/home/daytona/project", "feature/new-feature")

// Status
const status = await git.status("/home/daytona/project")
console.log(`On branch: ${status.currentBranch}`)

// Pull and push
await git.pull("/home/daytona/project", githubToken)
await git.push("/home/daytona/project", githubToken)
```

## API

### `createSandboxGit(sandbox)`

Creates a `SandboxGit` interface from a Daytona sandbox.

### Methods

| Method | Description |
|--------|-------------|
| `clone(url, path, branch?, commitId?, token?)` | Clone a repository |
| `createBranch(path, branchName)` | Create a new branch |
| `checkoutBranch(path, branchName)` | Switch to a branch |
| `status(path)` | Get repository status |
| `pull(path, token?)` | Pull from remote |
| `push(path, token?)` | Push to remote |

## How Credentials Work

Credentials are passed via git's `-c` flag:

```bash
git -c http.extraHeader='Authorization: Basic <base64>' push
```

This means:
- No config files modified
- No cleanup needed
- Credential exists only for that command
