# MCP Integration Plan (Smithery Hosted)

## Problem Statement

Agents running in sandboxes cannot access GitHub issues, PRs, and other GitHub resources because:
1. The GitHub token (from user's OAuth) is stored server-side
2. Sharing tokens directly with agents is a **security risk**
3. Agents need authenticated GitHub access for useful operations

**Key Requirement**: Tokens must NEVER be accessible to agents.

---

## Solution: Smithery Hosted MCP Servers

Use **Smithery's hosted MCP servers** (like `@smithery-ai/github`) instead of building our own. Your server acts as a **proxy** that:
1. Looks up user's token from database
2. Connects to Smithery with the token
3. Exposes MCP endpoint to sandbox
4. Agent calls tools, gets results - **never sees token**

### Why Smithery Hosted?

1. **Pre-built MCP servers** - GitHub, Jira, Slack, Linear, etc. already exist
2. **Maintained by Smithery** - Bug fixes, API updates handled for you
3. **Easy to add apps** - Just add new connection, minimal code
4. **Standard MCP protocol** - Works with all MCP-compatible agents
5. **Token handling** - Tokens are ephemeral, not stored by Smithery

### Token Security

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR SERVER                              │
│                                                              │
│   1. Agent requests MCP connection                          │
│   2. Look up: sandboxId → Chat → userId → Account           │
│   3. Get GitHub token from YOUR database                    │
│   4. Pass token to Smithery in header (ephemeral)           │
│                                                              │
│   Token source: GitHub OAuth login (already stored)         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Token in Authorization header
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  SMITHERY PLATFORM                           │
│                                                              │
│   @smithery-ai/github  @smithery-ai/jira  @smithery-ai/slack│
│                                                              │
│   - Receives token (ephemeral, not stored)                  │
│   - Calls GitHub/Jira/Slack API                             │
│   - Returns tool results                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Only tool results (NO token)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     SANDBOX (Agent)                          │
│                                                              │
│   Agent receives: { issues: [...], prs: [...] }             │
│                                                              │
│   Agent CANNOT:                                              │
│   ❌ See the token                                           │
│   ❌ Make arbitrary API calls                                │
│   ❌ Access other repos                                      │
│                                                              │
│   Agent CAN only:                                            │
│   ✅ Use tools exposed by Smithery MCP servers               │
│   ✅ Get results for the chat's repo                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Agent MCP Support Matrix

| Agent | MCP Support | Config File | Config Format |
|-------|-------------|-------------|---------------|
| **Claude Code** | ✅ Native | `~/.claude.json` | JSON with `mcpServers` |
| **Codex (OpenAI)** | ✅ Native | `~/.codex/config.toml` | TOML with `[mcp.servers]` |
| **Gemini CLI** | ✅ Native | `~/.gemini/settings.json` | JSON with MCP config |
| **OpenCode** | ✅ Native | `.opencode/config.json` | JSON with `mcp` section |
| **Goose** | ✅ Native | `~/.config/goose/config.yaml` | YAML with `extensions` |
| **Pi** | ❌ No built-in | N/A | **Skipped** (uses CLI tools instead) |

**Note**: Pi coding agent doesn't have built-in MCP support. It uses a different philosophy (CLI tools with READMEs). MCP tools will not be available for Pi.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Web Application                              │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                 MCP Proxy Endpoint                             │  │
│  │                 /api/mcp/[sandboxId]/sse                       │  │
│  │                                                                │  │
│  │  1. Validate sandboxId → Chat → check mcpTools enabled        │  │
│  │  2. Get token from DB (Account.access_token)                  │  │
│  │  3. Connect to Smithery with @smithery/api                    │  │
│  │  4. Proxy MCP messages between agent and Smithery             │  │
│  │                                                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              ↑                                       │
│                              │ HTTP/SSE                              │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                    Daytona Sandbox                                    │
│                              ↓                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │      Agent (Claude, Codex, Gemini, OpenCode, Goose)           │  │
│  │                                                                │  │
│  │  MCP client connects to: https://{app}/api/mcp/{sandboxId}/sse│  │
│  │                                                                │  │
│  │  Available tools (from Smithery):                             │  │
│  │  GitHub: search_repositories, get_issue, create_issue,        │  │
│  │          list_pull_requests, get_pull_request, add_comment... │  │
│  │  Jira:   (future) search_issues, create_issue, ...            │  │
│  │  Slack:  (future) send_message, list_channels, ...            │  │
│  │                                                                │  │
│  │  Token: ❌ NEVER PRESENT                                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Per-Chat Opt-In Feature

Users must **explicitly enable** MCP tools for each chat (like environment variables).

### UI Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     CHAT SETTINGS                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Environment Variables                              │    │
│  │  [API_KEY] = [••••••••]                     [+ Add] │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  MCP Tools                                          │    │
│  │                                                      │    │
│  │  ☑ GitHub Tools                                     │    │
│  │    Issues, PRs, comments, code search               │    │
│  │    Using: @smithery-ai/github                       │    │
│  │                                                      │    │
│  │  ☐ Jira Tools (coming soon)                         │    │
│  │    Issues, projects, sprints                        │    │
│  │                                                      │    │
│  │  ☐ Slack Tools (coming soon)                        │    │
│  │    Messages, channels                               │    │
│  │                                                      │    │
│  │  ⚠️ Note: MCP tools not available for Pi agent      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│                                    [Save Settings]          │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Change

```prisma
model Chat {
  // ... existing fields ...

  // MCP tools configuration (JSONB for flexibility)
  // { github: true, jira: false, slack: false }
  mcpTools Json?
}
```

---

## Implementation Steps

### Phase 1: Install Smithery Packages

**File: `packages/web/package.json`**
```json
{
  "dependencies": {
    "@smithery/api": "^1.x",
    "@modelcontextprotocol/sdk": "^1.x"
  }
}
```

### Phase 2: Create MCP Proxy Endpoint

**File: `packages/web/app/api/mcp/[sandboxId]/sse/route.ts`**

```typescript
import { createConnection } from "@smithery/api/mcp"
import { prisma } from "@/lib/db/prisma"

export async function GET(
  req: Request,
  { params }: { params: { sandboxId: string } }
) {
  const { sandboxId } = await params

  // 1. Look up chat and validate
  const chat = await prisma.chat.findUnique({
    where: { sandboxId },
    include: { user: { include: { accounts: true } } }
  })

  if (!chat) {
    return new Response("Chat not found", { status: 404 })
  }

  // 2. Check if MCP tools are enabled for this chat
  const mcpTools = chat.mcpTools as { github?: boolean } | null
  if (!mcpTools?.github) {
    return new Response("GitHub tools not enabled for this chat", { status: 403 })
  }

  // 3. Get GitHub token from user's OAuth account
  const githubAccount = chat.user.accounts.find(a => a.provider === "github")
  if (!githubAccount?.access_token) {
    return new Response("GitHub not connected", { status: 401 })
  }

  // 4. Connect to Smithery's GitHub MCP server
  const { transport } = await createConnection({
    mcpUrl: "https://server.smithery.ai/@smithery-ai/github",
    headers: {
      "Authorization": `Bearer ${githubAccount.access_token}`
    }
  })

  // 5. Proxy MCP protocol to agent via SSE
  return transport.handleSSE(req)
}
```

**File: `packages/web/app/api/mcp/[sandboxId]/message/route.ts`**

```typescript
export async function POST(
  req: Request,
  { params }: { params: { sandboxId: string } }
) {
  // Same auth logic as SSE endpoint
  // Handle MCP messages from agent
}
```

### Phase 3: Database & API

**3.1 Update Prisma Schema**
```prisma
model Chat {
  // ... existing fields ...
  mcpTools Json?
}
```

**3.2 Create Settings API**
**File: `packages/web/app/api/chat/[id]/mcp-tools/route.ts`**

```typescript
// GET - Get current MCP tools settings
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const chat = await prisma.chat.findUnique({
    where: { id: params.id },
    select: { mcpTools: true }
  })
  return Response.json({ mcpTools: chat?.mcpTools ?? {} })
}

// PATCH - Update MCP tools settings
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { mcpTools } = await req.json()
  const chat = await prisma.chat.update({
    where: { id: params.id },
    data: { mcpTools }
  })
  return Response.json({ mcpTools: chat.mcpTools })
}
```

### Phase 4: UI Component

**File: `packages/web/components/chat/McpToolsSettings.tsx`**

```tsx
export function McpToolsSettings({ chatId, agent }: { chatId: string; agent: string }) {
  const [settings, setSettings] = useState<McpToolsConfig>({})

  // Pi doesn't support MCP
  const mcpSupported = agent !== "pi"

  const toggleGitHub = async (enabled: boolean) => {
    const newSettings = { ...settings, github: enabled }
    await fetch(`/api/chat/${chatId}/mcp-tools`, {
      method: "PATCH",
      body: JSON.stringify({ mcpTools: newSettings })
    })
    setSettings(newSettings)
  }

  if (!mcpSupported) {
    return (
      <div className="text-sm text-muted">
        MCP tools are not available for {agent} agent.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3>MCP Tools</h3>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">GitHub Tools</p>
          <p className="text-sm text-muted">Issues, PRs, comments, code search</p>
        </div>
        <Switch checked={settings.github} onCheckedChange={toggleGitHub} />
      </div>

      {/* Future: Jira, Slack, etc. */}
    </div>
  )
}
```

### Phase 5: Per-Agent MCP Configuration

**File: `packages/agent-configuration/src/mcp.ts`**

```typescript
/**
 * MCP Configuration Generator
 *
 * Generates the correct MCP config format for each agent type.
 * Each agent has a different config file location and format.
 */

export interface McpServerConfig {
  url: string
  transport: "sse" | "http"
}

export interface McpConfigResult {
  filePath: string
  content: string
}

/**
 * Agents that support MCP
 */
export const MCP_SUPPORTED_AGENTS = ["claude", "codex", "gemini", "opencode", "goose"] as const
export type McpSupportedAgent = typeof MCP_SUPPORTED_AGENTS[number]

/**
 * Check if an agent supports MCP
 */
export function agentSupportsMcp(agent: string): agent is McpSupportedAgent {
  return MCP_SUPPORTED_AGENTS.includes(agent as McpSupportedAgent)
}

/**
 * Generate MCP config for a specific agent
 */
export function generateMcpConfig(
  agent: string,
  sandboxId: string,
  baseUrl: string
): McpConfigResult | null {
  if (!agentSupportsMcp(agent)) {
    return null // Pi and others don't support MCP
  }

  const mcpUrl = `${baseUrl}/api/mcp/${sandboxId}/sse`

  switch (agent) {
    case "claude":
      return generateClaudeConfig(mcpUrl)
    case "codex":
      return generateCodexConfig(mcpUrl)
    case "gemini":
      return generateGeminiConfig(mcpUrl)
    case "opencode":
      return generateOpenCodeConfig(mcpUrl)
    case "goose":
      return generateGooseConfig(mcpUrl)
    default:
      return null
  }
}

/**
 * Claude Code: ~/.claude.json
 */
function generateClaudeConfig(mcpUrl: string): McpConfigResult {
  const config = {
    mcpServers: {
      "daytona-github": {
        type: "http",
        url: mcpUrl
      }
    }
  }
  return {
    filePath: "~/.claude.json",
    content: JSON.stringify(config, null, 2)
  }
}

/**
 * Codex (OpenAI): ~/.codex/config.toml
 */
function generateCodexConfig(mcpUrl: string): McpConfigResult {
  const config = `
[mcp.servers.daytona-github]
type = "http"
url = "${mcpUrl}"
`
  return {
    filePath: "~/.codex/config.toml",
    content: config.trim()
  }
}

/**
 * Gemini CLI: ~/.gemini/settings.json
 */
function generateGeminiConfig(mcpUrl: string): McpConfigResult {
  const config = {
    mcpServers: {
      "daytona-github": {
        type: "sse",
        url: mcpUrl
      }
    }
  }
  return {
    filePath: "~/.gemini/settings.json",
    content: JSON.stringify(config, null, 2)
  }
}

/**
 * OpenCode: .opencode/config.json (project-level)
 */
function generateOpenCodeConfig(mcpUrl: string): McpConfigResult {
  const config = {
    mcp: {
      servers: {
        "daytona-github": {
          url: mcpUrl,
          transport: "sse"
        }
      }
    }
  }
  return {
    filePath: ".opencode/config.json",
    content: JSON.stringify(config, null, 2)
  }
}

/**
 * Goose: ~/.config/goose/config.yaml
 */
function generateGooseConfig(mcpUrl: string): McpConfigResult {
  const config = `
extensions:
  daytona-github:
    type: sse
    uri: "${mcpUrl}"
    enabled: true
`
  return {
    filePath: "~/.config/goose/config.yaml",
    content: config.trim()
  }
}
```

### Phase 6: Update Agent Setup

**File: `packages/agents/src/setup/mcp.ts`**

```typescript
import { generateMcpConfig, agentSupportsMcp } from "@anthropic/agent-configuration/mcp"
import type { CodeAgentSandbox } from "../types/provider"

interface McpSetupOptions {
  agent: string
  sandboxId: string
  baseUrl: string
  mcpTools: { github?: boolean } | null
}

/**
 * Setup MCP configuration for an agent in the sandbox
 */
export async function setupMcpForAgent(
  sandbox: CodeAgentSandbox,
  options: McpSetupOptions
): Promise<void> {
  const { agent, sandboxId, baseUrl, mcpTools } = options

  // Skip if agent doesn't support MCP
  if (!agentSupportsMcp(agent)) {
    console.log(`[MCP] Skipping MCP setup for ${agent} (not supported)`)
    return
  }

  // Skip if no MCP tools enabled
  if (!mcpTools || !Object.values(mcpTools).some(Boolean)) {
    console.log(`[MCP] Skipping MCP setup for ${agent} (no tools enabled)`)
    return
  }

  // Generate config for this agent
  const config = generateMcpConfig(agent, sandboxId, baseUrl)
  if (!config) {
    return
  }

  // Ensure directory exists and write config
  const dir = config.filePath.substring(0, config.filePath.lastIndexOf("/"))
  await sandbox.commands.run(`mkdir -p ${dir}`)

  // Write the config file
  // Note: Need to handle ~ expansion properly
  const expandedPath = config.filePath.replace("~", "$HOME")
  await sandbox.commands.run(`cat > ${expandedPath} << 'EOF'
${config.content}
EOF`)

  console.log(`[MCP] Wrote MCP config for ${agent} to ${config.filePath}`)
}
```

**Update agent session creation:**

```typescript
// In packages/web/lib/agent-session.ts

import { setupMcpForAgent } from "@anthropic/agents/setup/mcp"

async function createBackgroundAgentSession(/* ... */) {
  // ... existing setup ...

  // Setup MCP if enabled
  await setupMcpForAgent(sandbox, {
    agent: chat.agent,
    sandboxId: chat.sandboxId,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
    mcpTools: chat.mcpTools as { github?: boolean } | null
  })

  // ... rest of session creation ...
}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `packages/web/app/api/mcp/[sandboxId]/sse/route.ts` | MCP proxy SSE endpoint |
| `packages/web/app/api/mcp/[sandboxId]/message/route.ts` | MCP message handler |
| `packages/web/app/api/chat/[id]/mcp-tools/route.ts` | MCP settings API |
| `packages/web/components/chat/McpToolsSettings.tsx` | Settings UI |
| `packages/web/lib/mcp/smithery.ts` | Smithery connection helpers |
| `packages/agent-configuration/src/mcp.ts` | Per-agent MCP config generation |
| `packages/agents/src/setup/mcp.ts` | MCP setup for sandbox |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/web/prisma/schema.prisma` | Add `mcpTools Json?` to Chat |
| `packages/web/package.json` | Add `@smithery/api` |
| `packages/web/lib/agent-session.ts` | Call `setupMcpForAgent()` |

---

## Per-Agent Config Reference

### Claude Code (`~/.claude.json`)
```json
{
  "mcpServers": {
    "daytona-github": {
      "type": "http",
      "url": "https://app.daytona.io/api/mcp/{sandboxId}/sse"
    }
  }
}
```

### Codex (`~/.codex/config.toml`)
```toml
[mcp.servers.daytona-github]
type = "http"
url = "https://app.daytona.io/api/mcp/{sandboxId}/sse"
```

### Gemini CLI (`~/.gemini/settings.json`)
```json
{
  "mcpServers": {
    "daytona-github": {
      "type": "sse",
      "url": "https://app.daytona.io/api/mcp/{sandboxId}/sse"
    }
  }
}
```

### OpenCode (`.opencode/config.json`)
```json
{
  "mcp": {
    "servers": {
      "daytona-github": {
        "url": "https://app.daytona.io/api/mcp/{sandboxId}/sse",
        "transport": "sse"
      }
    }
  }
}
```

### Goose (`~/.config/goose/config.yaml`)
```yaml
extensions:
  daytona-github:
    type: sse
    uri: "https://app.daytona.io/api/mcp/{sandboxId}/sse"
    enabled: true
```

### Pi
**Not supported** - Pi uses CLI tools with READMEs instead of MCP.

---

## Available Tools (from @smithery-ai/github)

Smithery's GitHub MCP server provides these tools:

| Tool | Description |
|------|-------------|
| `search_repositories` | Search GitHub repositories |
| `search_code` | Search code in repositories |
| `search_users` | Search GitHub users |
| `get_repository` | Get repository details |
| `get_issue` | Get issue details |
| `create_issue` | Create a new issue |
| `add_issue_comment` | Add comment to issue |
| `list_pull_requests` | List pull requests |
| `get_pull_request` | Get PR details |
| `get_pull_request_diff` | Get PR diff |
| `create_pull_request_review` | Review a PR |
| `get_file_contents` | Get file contents |
| `list_branches` | List branches |

---

## Adding More Apps (Future)

Adding Jira, Slack, etc. is simple:

```typescript
// In MCP proxy endpoint

const connections: Record<string, string> = {
  github: "https://server.smithery.ai/@smithery-ai/github",
  jira: "https://server.smithery.ai/@smithery-ai/jira",
  slack: "https://server.smithery.ai/@smithery-ai/slack",
  linear: "https://server.smithery.ai/@smithery-ai/linear",
}

// Connect to all enabled providers
const enabledConnections = Object.entries(mcpTools)
  .filter(([_, enabled]) => enabled)
  .map(([provider]) => createConnection({
    mcpUrl: connections[provider],
    headers: { Authorization: `Bearer ${tokens[provider]}` }
  }))
```

For each new provider:
1. Add to UI toggle
2. Store credentials (user connects Jira/Slack via OAuth)
3. Connect to Smithery's MCP server for that provider

---

## Security Considerations

### Token Flow
1. User logs in with GitHub OAuth → token stored in YOUR database
2. When agent needs tools → YOUR server looks up token
3. Token sent to Smithery in header (ephemeral, not stored)
4. Smithery calls GitHub API → returns results
5. Agent receives results only, NEVER the token

### Per-Chat Opt-In
- Tools disabled by default
- User explicitly enables per chat
- Can be revoked anytime

### Scoped Access
- Tools scoped to chat's repository
- Agent cannot access other repos

### Audit Trail
- Log all MCP tool invocations
- Track: userId, chatId, tool, timestamp

---

## Implementation Order

### Phase 1: Core (~2 days)
- [ ] Add `mcpTools` to Chat model, run migration
- [ ] Install `@smithery/api` package
- [ ] Create MCP proxy endpoint (`/api/mcp/[sandboxId]/sse`)

### Phase 2: Settings (~1 day)
- [ ] Create MCP settings API endpoint
- [ ] Create McpToolsSettings UI component
- [ ] Integrate into chat settings panel

### Phase 3: Agent Config (~2 days)
- [ ] Create per-agent MCP config generator
- [ ] Create MCP setup function for sandbox
- [ ] Update agent session to call MCP setup
- [ ] Test each agent (Claude, Codex, Gemini, OpenCode, Goose)

### Phase 4: Polish (~1 day)
- [ ] Add rate limiting
- [ ] Add audit logging
- [ ] Error handling & edge cases
- [ ] Show "not supported" message for Pi

**Total Estimated Time: ~6 days**

---

## Testing Strategy

### Integration Tests
- Enable GitHub tools → verify agent can use them
- Disable tools → verify 403 response
- Invalid sandboxId → verify 404
- Pi agent → verify graceful skip

### Per-Agent Tests
- [ ] Claude Code: Verify `~/.claude.json` written correctly
- [ ] Codex: Verify `~/.codex/config.toml` written correctly
- [ ] Gemini: Verify `~/.gemini/settings.json` written correctly
- [ ] OpenCode: Verify `.opencode/config.json` written correctly
- [ ] Goose: Verify `~/.config/goose/config.yaml` written correctly
- [ ] Pi: Verify MCP setup skipped gracefully

### End-to-End Tests
- Create issue via agent
- List PRs via agent
- Add comment via agent

### Security Tests
- Verify token never in response body
- Verify disabled tools blocked
- Verify cross-chat access denied
