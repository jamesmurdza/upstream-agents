# Remote MCP Server Integration Plan

## Overview

Integrate remote MCP (Model Context Protocol) servers into the sandboxed-agents platform, allowing users to connect external tools and services (GitHub, Sentry, Notion, databases, etc.) that AI agents can use during coding sessions.

---

## Key Design Decisions

### 1. Configuration Scope: **Per-Repository**
- MCP servers configured at the repository level (like environment variables)
- Different repos can have different MCP tools (frontend → Figma, backend → database MCP)
- Stored in `Repo` model or separate `RepoMcpServer` model
- Better security isolation and cleaner agent context

### 2. Credential Storage: **User-Level (Shared Across Repos)**
- OAuth tokens and API keys stored per-user (like `UserCredentials`)
- User authenticates once with Notion, can enable for multiple repos
- Avoids re-authenticating the same service for each repo

### 3. Execution Model: **Inside Sandbox** (Primary)
- MCP tools execute from within the Daytona sandbox
- Agents (Claude Code, OpenCode) have native MCP support
- Write MCP config file to sandbox before agent starts
- *Fallback*: Backend proxy available if needed for specific servers

### 4. Authentication: **OAuth 2.0 Primary, API Keys Secondary**
- Most commercial MCP servers use OAuth (Notion, Figma, GitHub, etc.)
- OAuth tokens stored encrypted, auto-refreshed
- API key fallback for servers that support it

### 5. Transport: **HTTP (Streamable)** Only
- HTTP streamable transport is the standard for remote servers
- SSE is deprecated - no need to support it initially
- Simplifies implementation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Account                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  McpCredential (per service, shared across repos)   │    │
│  │  - Notion: OAuth token                              │    │
│  │  - Figma: OAuth token                               │    │
│  │  - Sentry: API key                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│           ┌───────────────┼───────────────┐                 │
│           ▼               ▼               ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Repo A    │  │   Repo B    │  │   Repo C    │         │
│  │ (frontend)  │  │ (backend)   │  │ (mobile)    │         │
│  │             │  │             │  │             │         │
│  │ Enabled:    │  │ Enabled:    │  │ Enabled:    │         │
│  │ - Figma ✓   │  │ - Sentry ✓  │  │ - Figma ✓   │         │
│  │ - Notion ✓  │  │ - Notion ✓  │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Model: `McpCredential` (User-Level)

Stores authenticated MCP services per user (OAuth tokens, API keys).

```prisma
model McpCredential {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Service identification (from registry or custom)
  slug        String  // "notion", "figma", "sentry", or custom slug
  name        String  // Display name
  url         String  // MCP server URL
  iconUrl     String? // Icon from registry

  // Authentication (encrypted)
  authType          String  @default("oauth") // "oauth" | "api-key"
  oauthAccessToken  String? @db.Text
  oauthRefreshToken String? @db.Text
  oauthTokenExpiry  DateTime?
  apiKey            String? @db.Text
  headerName        String? // For API key auth
  headerPrefix      String? // "Bearer ", "Api-Key ", etc.

  // Status
  status    String   @default("connected") // "connected" | "expired" | "error"
  lastError String?  @db.Text

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  repoMcpServers RepoMcpServer[]

  @@unique([userId, slug]) // One credential per service per user
  @@index([userId])
}
```

### New Model: `RepoMcpServer` (Repo-Level)

Links MCP credentials to specific repositories.

```prisma
model RepoMcpServer {
  id     String @id @default(cuid())
  repoId String
  repo   Repo   @relation(fields: [repoId], references: [id], onDelete: Cascade)

  // Link to user's credential for this service
  mcpCredentialId String
  mcpCredential   McpCredential @relation(fields: [mcpCredentialId], references: [id], onDelete: Cascade)

  // Enabled state (can disable without deleting)
  enabled Boolean @default(true)

  createdAt DateTime @default(now())

  @@unique([repoId, mcpCredentialId]) // One per repo-service combo
  @@index([repoId])
}
```

### Updated Models

```prisma
model User {
  // ... existing fields ...
  mcpCredentials McpCredential[]
}

model Repo {
  // ... existing fields ...
  mcpServers RepoMcpServer[]
}
```

---

## API Routes

### User MCP Credentials (Account-Level)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/user/mcp-credentials` | GET | List user's authenticated MCP services |
| `/api/user/mcp-credentials` | POST | Add new MCP credential (manual) |
| `/api/user/mcp-credentials/[credentialId]` | DELETE | Remove credential |
| `/api/user/mcp-credentials/[credentialId]/oauth` | GET | Start OAuth flow |
| `/api/auth/mcp-callback` | GET | OAuth callback handler |

### Repo MCP Servers (Repo-Level)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/repo/[repoId]/mcp-servers` | GET | List MCP servers enabled for repo |
| `/api/repo/[repoId]/mcp-servers` | POST | Enable MCP server for repo |
| `/api/repo/[repoId]/mcp-servers/[serverId]` | DELETE | Disable MCP server for repo |

### MCP Registry (Discovery)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/mcp-registry` | GET | Proxy to Anthropic registry with search |

---

## UI Components

### 1. Repo Settings Modal - New "MCP Servers" Tab

Extend existing `repo-settings-modal.tsx` with a second tab:

```
Tabs: [Environment Variables] [MCP Servers]
```

#### MCP Tab Contents:

**Section 1: Enabled Servers**
- List of MCP servers enabled for this repo
- Each shows: Icon, Name, Status indicator, Disable button
- Empty state: "No MCP servers enabled for this repository"

**Section 2: Available Servers**
- Shows user's authenticated MCP credentials that aren't enabled for this repo
- Each shows: Icon, Name, "Enable" button
- If no authenticated credentials: "Connect an MCP service in account settings"

**Section 3: Browse Registry Button**
- Opens registry browser modal
- User can discover and connect new services

### 2. Account Settings - MCP Credentials Section

Add to existing settings modal or create new section:

**Connected Services**
- List of authenticated MCP services
- Each shows: Icon, Name, Status, "Disconnect" button
- "Connect New Service" button → Opens registry browser

### 3. Registry Browser Modal

```tsx
// components/mcp/mcp-registry-browser.tsx
interface McpRegistryBrowserProps {
  onConnect: (server: RegistryServer) => void  // Triggers OAuth flow
  connectedSlugs: string[]  // Already connected services
}
```

**Features**:
- Search bar with debounced search
- Category filter chips (All, Productivity, Design, Development)
- Server cards: Icon, Name, Description, Tools count, "Connect" button
- Infinite scroll pagination
- "Already connected" state for authenticated services

### 4. New Components

| Component | Purpose |
|-----------|---------|
| `components/mcp/mcp-server-list.tsx` | List of MCP servers (for repo settings) |
| `components/mcp/mcp-credential-list.tsx` | List of credentials (for account settings) |
| `components/mcp/mcp-registry-browser.tsx` | Browse + search registry |
| `components/mcp/mcp-server-card.tsx` | Individual server card |

---

## User Flows

### Flow 1: Connect New MCP Service

```
1. User opens Repo Settings → MCP Servers tab
2. Clicks "Browse Registry"
3. Searches for "Notion", clicks "Connect"
4. OAuth popup opens → User authorizes
5. Callback saves credential to McpCredential
6. Automatically enables for current repo (RepoMcpServer)
7. Shows success, server appears in "Enabled Servers"
```

### Flow 2: Enable Existing Service for Another Repo

```
1. User opens different Repo Settings → MCP Servers tab
2. Sees Notion in "Available Servers" (already authenticated)
3. Clicks "Enable"
4. Creates RepoMcpServer link
5. Notion now available in this repo's sandboxes
```

### Flow 3: Manage Account Credentials

```
1. User opens Account Settings → MCP Services
2. Sees all connected services
3. Can disconnect (deletes McpCredential + all RepoMcpServer links)
4. Can connect new services from registry
```

---

## Sandbox Integration

### Modify `lib/sandbox-resume.ts`

```typescript
// 1. Fetch repo's enabled MCP servers with credentials
const repoMcpServers = await prisma.repoMcpServer.findMany({
  where: { repoId, enabled: true },
  include: { mcpCredential: true }
})

// 2. Decrypt and build config
const mcpConfig = buildMcpConfigJson(repoMcpServers)

// 3. Write to sandbox
if (Object.keys(mcpConfig.mcpServers).length > 0) {
  await sandbox.process.executeCommand(
    `mkdir -p ~/.claude && echo '${base64Encode(JSON.stringify(mcpConfig))}' | base64 -d > ~/.claude/mcp_servers.json`
  )
}
```

### MCP Config Format

```json
{
  "mcpServers": {
    "notion": {
      "type": "http",
      "url": "https://mcp.notion.com/mcp",
      "headers": {
        "Authorization": "Bearer <decrypted_token>"
      }
    },
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp",
      "headers": {
        "Authorization": "Bearer <decrypted_token>"
      }
    }
  }
}
```

---

## MCP Server Registry

### Registry API

**Endpoint**: `GET https://api.anthropic.com/mcp-registry/v0/servers?visibility=commercial`

**Our Proxy**: `GET /api/mcp-registry?search=notion&limit=20`

### Transformed Response

```typescript
interface RegistryServer {
  slug: string           // "notion"
  name: string           // "Notion"
  description: string    // "Connect your Notion workspace..."
  iconUrl: string        // "https://notion.so/logo.svg"
  url: string            // "https://mcp.notion.com/mcp"
  documentation: string  // Link to docs
  tools: string[]        // ["search", "create-pages", ...]
  requiresAuth: boolean  // true (most do)
  useCases: string[]     // ["productivity"]
}
```

---

## OAuth Flow

```
1. User clicks "Connect" on Notion in registry
         ↓
2. Frontend → GET /api/user/mcp-credentials/oauth?slug=notion&repoId=xxx
         ↓
3. Backend:
   - Looks up OAuth config for Notion from registry
   - Generates state token with {userId, slug, repoId}
   - Returns authorization URL
         ↓
4. Frontend opens popup/redirect to Notion OAuth
         ↓
5. User authorizes in Notion
         ↓
6. Notion → GET /api/auth/mcp-callback?code=xxx&state=xxx
         ↓
7. Backend:
   - Validates state
   - Exchanges code for tokens
   - Creates/updates McpCredential (encrypted)
   - If repoId in state, creates RepoMcpServer
   - Redirects with success
         ↓
8. Frontend shows success, refreshes lists
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `app/api/user/mcp-credentials/route.ts` | CRUD for user's MCP credentials |
| `app/api/user/mcp-credentials/[credentialId]/route.ts` | Individual credential ops |
| `app/api/user/mcp-credentials/oauth/route.ts` | Start OAuth flow |
| `app/api/auth/mcp-callback/route.ts` | OAuth callback |
| `app/api/repo/[repoId]/mcp-servers/route.ts` | Repo MCP server management |
| `app/api/mcp-registry/route.ts` | Registry proxy |
| `lib/mcp-oauth.ts` | OAuth helpers, token refresh |
| `components/mcp/mcp-server-list.tsx` | Server list for repo |
| `components/mcp/mcp-credential-list.tsx` | Credential list for account |
| `components/mcp/mcp-registry-browser.tsx` | Registry browser modal |
| `components/mcp/mcp-server-card.tsx` | Server card component |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add McpCredential, RepoMcpServer models |
| `lib/constants.ts` | Add MCP paths |
| `lib/api-helpers.ts` | Add MCP decryption helpers |
| `lib/sandbox-resume.ts` | Write MCP config to sandbox |
| `components/repo-settings-modal.tsx` | Add MCP Servers tab |
| `components/settings-modal.tsx` | Add MCP Credentials section (optional) |

---

## Implementation Phases

### Phase 1: Foundation (2-3 days)
- [ ] Add Prisma schema + migration
- [ ] Create MCP credential CRUD API routes
- [ ] Create repo MCP server API routes
- [ ] Add decryption helpers

### Phase 2: OAuth Flow (2-3 days)
- [ ] Implement OAuth initiation endpoint
- [ ] Create callback handler with token exchange
- [ ] Add token storage (encrypted)
- [ ] Add token refresh logic

### Phase 3: Repo Settings UI (2 days)
- [ ] Add "MCP Servers" tab to repo settings modal
- [ ] Create server list component
- [ ] Create enable/disable functionality
- [ ] Show available (authenticated) servers

### Phase 4: Registry Browser (2 days)
- [ ] Create registry proxy API
- [ ] Build registry browser modal
- [ ] Add search + category filtering
- [ ] Connect OAuth flow to registry

### Phase 5: Sandbox Integration (1-2 days)
- [ ] Modify `ensureSandboxReady` to inject MCP configs
- [ ] Build MCP config JSON generator
- [ ] Test with Claude Code agent + real MCP server

### Phase 6: Polish (1 day)
- [ ] Error handling + status indicators
- [ ] Token expiry handling + auto-refresh
- [ ] End-to-end testing

**Total: ~10-13 days**

---

## Other Recommendations

### 1. Start Simple - OAuth Only for Initial Launch
Most commercial MCP servers (Notion, Figma, Canva, Slack, GitHub) use OAuth. Skip API key support initially to reduce complexity. Add later if needed.

### 2. Pre-populate Popular Servers
Instead of starting from empty, consider showing 5-10 popular servers in the UI even before browsing registry:
- Notion, Figma, Canva, Slack, GitHub, Sentry, Linear

### 3. Connection Testing
Add a "Test Connection" button that calls `listTools()` on the MCP server to verify the token works. Show tool count on success.

### 4. Token Expiry Handling
- Check token expiry before each agent execution
- Auto-refresh if expired and refresh token available
- Show "Reconnect" button in UI if refresh fails

### 5. Error Recovery
When MCP server fails in sandbox:
- Log error to `lastError` field
- Show status indicator in UI
- Don't block agent execution - just skip that server

### 6. Future: Custom MCP Servers
Allow users to add custom MCP servers by URL (not from registry). Useful for:
- Self-hosted servers
- Internal company tools
- Development/testing

---

## Security Considerations

1. **Encryption**: All tokens use AES encryption via `lib/encryption.ts`
2. **OAuth State**: Encrypted to prevent CSRF
3. **HTTPS Only**: All MCP server URLs must be HTTPS
4. **Sandbox Isolation**: Tokens only exist inside sandbox during execution
5. **Token Scope**: OAuth scopes limited to what MCP server needs
6. **Cascading Deletes**: Removing credential removes all repo links
