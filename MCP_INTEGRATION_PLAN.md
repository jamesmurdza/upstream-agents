# Remote MCP Server Integration Plan

## Overview

Integrate remote MCP (Model Context Protocol) servers into the sandboxed-agents platform, allowing users to connect external tools and services (GitHub, Sentry, Notion, databases, etc.) that AI agents can use during coding sessions.

---

## Key Design Decisions

### 1. Configuration Scope: **Per-User**
- Each user configures their own MCP servers (like API keys in `UserCredentials`)
- Servers available across all user's repos/branches
- Encrypted storage following existing patterns

### 2. Execution Model: **Inside Sandbox** (Primary)
- MCP tools execute from within the Daytona sandbox
- Agents (Claude Code, OpenCode) have native MCP support
- Write MCP config file to sandbox before agent starts
- *Fallback*: Backend proxy available if needed for specific servers

### 3. Authentication: **API Keys + OAuth 2.0**
- Start with API key/header authentication (simpler)
- Full OAuth 2.0 support with token storage and refresh
- Encrypted storage for all credentials

### 4. Transport: **HTTP (Primary) + SSE (Legacy)**
- HTTP streamable transport is recommended
- SSE supported for legacy servers

---

## Database Schema

### New Model: `McpServerConfig`

```prisma
model McpServerConfig {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Server identification
  name        String  // User-friendly name (e.g., "GitHub MCP")
  url         String  // Server URL (https://mcp.example.com)
  description String? @db.Text

  // Transport
  transportType String @default("http") // "http" | "sse"

  // Authentication
  authType String @default("none") // "none" | "api-key" | "oauth"

  // API Key auth (encrypted)
  apiKey       String? @db.Text
  headerName   String? @default("Authorization")
  headerPrefix String? @default("Bearer ")

  // OAuth auth (encrypted)
  oauthClientId     String? @db.Text
  oauthClientSecret String? @db.Text
  oauthAccessToken  String? @db.Text
  oauthRefreshToken String? @db.Text
  oauthTokenExpiry  DateTime?
  oauthScopes       String?

  // Status
  status      String   @default("pending") // "pending" | "connected" | "error" | "oauth-required"
  lastError   String?  @db.Text
  lastChecked DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, name])
  @@index([userId])
}
```

Add relation to User model:
```prisma
model User {
  // ... existing fields ...
  mcpServers McpServerConfig[]
}
```

---

## API Routes

### MCP Server CRUD
| Route | Method | Description |
|-------|--------|-------------|
| `/api/user/mcp-servers` | GET | List user's MCP servers (with `hasApiKey`, `hasOAuthToken` booleans) |
| `/api/user/mcp-servers` | POST | Add new MCP server |
| `/api/user/mcp-servers/[serverId]` | GET | Get server details |
| `/api/user/mcp-servers/[serverId]` | PATCH | Update server config |
| `/api/user/mcp-servers/[serverId]` | DELETE | Remove server |
| `/api/user/mcp-servers/[serverId]/test` | POST | Test connection |

### OAuth Flow
| Route | Method | Description |
|-------|--------|-------------|
| `/api/user/mcp-servers/[serverId]/oauth` | GET | Get OAuth authorization URL |
| `/api/auth/mcp-callback` | GET | OAuth callback handler |

---

## UI Components

### Settings Modal: New "MCP Servers" Tab

Add fourth tab to existing settings modal (`components/settings-modal.tsx`):

```
Tabs: [Agents] [Sandboxes] [Automation] [MCP Servers]
```

#### MCP Tab Contents:
1. **Server List**
   - Name, URL, status indicator (green=connected, yellow=pending, red=error)
   - Quick actions: Edit, Test, Delete
   - "Connect" button for OAuth servers

2. **Add Server Button** → Opens form:
   - Name (required)
   - URL (required, HTTPS validation)
   - Description (optional)
   - Transport Type (HTTP recommended / SSE deprecated)
   - Authentication Method:
     - None
     - API Key → Key input, header name, prefix
     - OAuth → Client ID/Secret or "Connect with OAuth" button

3. **Popular Servers** (optional enhancement):
   - Quick-add buttons for common servers (GitHub, Sentry, Notion)
   - Pre-filled URL, user provides credentials

### New Components to Create:
- `components/mcp/mcp-server-list.tsx`
- `components/mcp/mcp-server-form.tsx`
- `components/mcp/mcp-oauth-connect.tsx`

---

## Sandbox Integration

### Modify `lib/sandbox-resume.ts`

Pass MCP configs to sandbox during `ensureSandboxReady()`:

```typescript
// 1. Fetch user's MCP servers
const mcpServers = await prisma.mcpServerConfig.findMany({
  where: { userId, status: "connected" }
})

// 2. Decrypt credentials
const decryptedConfigs = decryptMcpServerConfigs(mcpServers)

// 3. Build MCP config JSON for agent
const mcpConfig = buildMcpConfigJson(decryptedConfigs)

// 4. Write to sandbox
await sandbox.process.executeCommand(
  `mkdir -p ~/.claude && echo '${base64Encode(mcpConfig)}' | base64 -d > ~/.claude/mcp_servers.json`
)
```

### MCP Config Format (Claude Code)

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    },
    "sentry": {
      "type": "http",
      "url": "https://mcp.sentry.dev/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```

---

## OAuth Flow

```
1. User clicks "Connect with OAuth" for server
         ↓
2. Frontend → GET /api/user/mcp-servers/[id]/oauth
         ↓
3. Backend returns authorization URL with:
   - client_id, redirect_uri, state (encrypted), scope
         ↓
4. User authorizes in popup/redirect
         ↓
5. Provider → GET /api/auth/mcp-callback?code=xxx&state=xxx
         ↓
6. Backend exchanges code for tokens, stores encrypted
         ↓
7. Redirect to settings with success message
```

### Token Refresh
- Check token expiry before agent execution
- Auto-refresh using stored refresh token
- Update stored tokens after refresh

---

## Files to Create/Modify

### New Files:
| File | Purpose |
|------|---------|
| `app/api/user/mcp-servers/route.ts` | CRUD for MCP servers |
| `app/api/user/mcp-servers/[serverId]/route.ts` | Individual server operations |
| `app/api/user/mcp-servers/[serverId]/test/route.ts` | Connection testing |
| `app/api/user/mcp-servers/[serverId]/oauth/route.ts` | OAuth initiation |
| `app/api/auth/mcp-callback/route.ts` | OAuth callback |
| `lib/mcp-client.ts` | MCP client for testing connections |
| `lib/mcp-oauth.ts` | OAuth token management |
| `components/mcp/mcp-server-list.tsx` | Server list UI |
| `components/mcp/mcp-server-form.tsx` | Add/edit form |

### Modified Files:
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add McpServerConfig model + User relation |
| `lib/constants.ts` | Add MCP paths |
| `lib/api-helpers.ts` | Add `decryptMcpServerConfigs()` |
| `lib/sandbox-resume.ts` | Write MCP config to sandbox |
| `components/settings-modal.tsx` | Add MCP Servers tab |
| `app/api/user/me/route.ts` | Include MCP server count/status |

---

## Implementation Phases

### Phase 1: Foundation (2-3 days)
- [ ] Add Prisma schema + migration
- [ ] Create MCP server CRUD API routes
- [ ] Add decryption helpers for MCP configs

### Phase 2: UI (2 days)
- [ ] Add "MCP Servers" tab to settings modal
- [ ] Create server list component
- [ ] Create add/edit form with auth options
- [ ] Add connection test UI

### Phase 3: Sandbox Integration (1-2 days)
- [ ] Modify `ensureSandboxReady` to inject MCP configs
- [ ] Create MCP config JSON builder
- [ ] Test with Claude Code agent + real MCP server

### Phase 4: OAuth (2 days)
- [ ] Implement OAuth initiation endpoint
- [ ] Create callback handler
- [ ] Add token storage + refresh logic
- [ ] Create OAuth connect UI

### Phase 5: Polish (1 day)
- [ ] Error handling improvements
- [ ] Status indicators and feedback
- [ ] End-to-end testing

---

## Verification Plan

### Manual Testing:
1. Add API-key authenticated MCP server (e.g., with custom header)
2. Test connection from UI
3. Start agent session, verify MCP tools available
4. Execute MCP tool from agent, verify results

### OAuth Testing:
1. Add OAuth MCP server (e.g., GitHub MCP)
2. Complete OAuth flow
3. Verify tokens stored and refreshed
4. Test agent access to OAuth-protected server

### Integration Testing:
1. Multiple MCP servers configured
2. Agent uses tools from different servers in single session
3. Token expiry and refresh during session

---

## Security Considerations

1. **Encryption**: All secrets use AES encryption via `lib/encryption.ts`
2. **OAuth State**: Encrypted to prevent CSRF attacks
3. **HTTPS Only**: URL validation enforces HTTPS
4. **Sandbox Isolation**: MCP calls from sandbox, not main app
5. **Token Exposure**: Tokens only in sandbox, not browser

---

## MCP Server Registry (Discovery)

### Overview

Anthropic maintains an official MCP server registry at `api.anthropic.com/mcp-registry`. Users can browse, search, and one-click add popular MCP servers instead of manually entering URLs.

### Registry API

**Endpoint**: `GET https://api.anthropic.com/mcp-registry/v0/servers`

**Query Parameters**:
| Parameter | Description |
|-----------|-------------|
| `search` | Substring search on server names |
| `visibility` | Filter (use `commercial` for production servers) |
| `limit` | Results per page (default: 50) |
| `cursor` | Pagination token for next page |
| `version` | Use `latest` for current versions |

**Response Structure**:
```json
{
  "servers": [
    {
      "server": {
        "name": "com.notion/mcp",
        "title": "Notion",
        "description": "Connect your Notion workspace...",
        "version": "1.0.1",
        "remotes": [
          { "type": "streamable-http", "url": "https://mcp.notion.com/mcp" }
        ]
      },
      "_meta": {
        "com.anthropic.api/mcp-registry": {
          "displayName": "Notion",
          "oneLiner": "Connect your Notion workspace to search, update...",
          "iconUrl": "https://www.notion.so/images/notion-logo-block-main.svg",
          "documentation": "https://developers.notion.com/docs/mcp",
          "toolNames": ["search", "fetch", "create-pages", ...],
          "isAuthless": false,
          "worksWith": ["claude", "claude-api", "claude-code"],
          "claudeCodeCopyText": "claude mcp add --transport http notion https://mcp.notion.com/mcp",
          "useCases": ["productivity"],
          "popularityScore": 19424,
          "trendingScore": 81110
        }
      }
    }
  ],
  "metadata": { "count": 50, "nextCursor": "..." }
}
```

### API Route for Registry

| Route | Method | Description |
|-------|--------|-------------|
| `/api/mcp-registry` | GET | Proxy to Anthropic registry with search/pagination |
| `/api/mcp-registry/[slug]` | GET | Get details for a specific server |

**Why proxy?**
- Add caching (registry doesn't change frequently)
- Filter for Claude Code compatible servers (`worksWith` includes `claude-code`)
- Transform response for frontend needs
- Avoid CORS issues

### Registry API Implementation

```typescript
// app/api/mcp-registry/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const cursor = searchParams.get("cursor") || ""
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50)

  // Fetch from Anthropic registry
  const url = new URL("https://api.anthropic.com/mcp-registry/v0/servers")
  url.searchParams.set("visibility", "commercial")
  url.searchParams.set("limit", String(limit))
  if (search) url.searchParams.set("search", search)
  if (cursor) url.searchParams.set("cursor", cursor)

  const response = await fetch(url, {
    next: { revalidate: 300 } // Cache for 5 minutes
  })

  const data = await response.json()

  // Transform and filter for Claude Code compatibility
  const servers = data.servers
    .filter(s => s._meta?.["com.anthropic.api/mcp-registry"]?.worksWith?.includes("claude-code"))
    .map(s => ({
      slug: s._meta?.["com.anthropic.api/mcp-registry"]?.slug,
      name: s.server.title || s.server.name,
      description: s._meta?.["com.anthropic.api/mcp-registry"]?.oneLiner || s.server.description,
      iconUrl: s._meta?.["com.anthropic.api/mcp-registry"]?.iconUrl,
      url: s.server.remotes?.[0]?.url,
      transportType: s.server.remotes?.[0]?.type === "streamable-http" ? "http" : "sse",
      documentation: s._meta?.["com.anthropic.api/mcp-registry"]?.documentation,
      tools: s._meta?.["com.anthropic.api/mcp-registry"]?.toolNames || [],
      requiresAuth: !s._meta?.["com.anthropic.api/mcp-registry"]?.isAuthless,
      useCases: s._meta?.["com.anthropic.api/mcp-registry"]?.useCases || [],
      popularityScore: s._meta?.["com.anthropic.api/mcp-registry"]?.popularityScore || 0,
    }))

  return Response.json({
    servers,
    nextCursor: data.metadata?.nextCursor
  })
}
```

### UI: Registry Browser Component

```tsx
// components/mcp/mcp-registry-browser.tsx
interface McpRegistryBrowserProps {
  onAddServer: (server: RegistryServer) => void
  existingServerUrls: string[] // To show "Already added" state
}
```

**Features**:
1. **Search Bar** - Real-time search through registry
2. **Server Cards** - Icon, name, description, tools count, "Add" button
3. **Categories** - Filter by use case (productivity, design, development, etc.)
4. **Infinite Scroll** - Load more with cursor pagination
5. **Quick Add** - One-click add pre-fills URL and name, prompts for auth if needed

### UI Flow

```
User opens MCP Servers tab
         ↓
Sees two sections:
  1. "Your Servers" - List of configured servers
  2. "Add Server" button + "Browse Registry" button
         ↓
Clicks "Browse Registry"
         ↓
Opens modal/drawer with:
  - Search input
  - Category chips (All, Productivity, Design, Development...)
  - Grid of server cards
         ↓
User clicks "Add" on a server (e.g., Notion)
         ↓
If requiresAuth:
  - Show auth form (OAuth connect button)
Else:
  - Add immediately, show success
         ↓
Server appears in "Your Servers" list
```

### New Files for Registry

| File | Purpose |
|------|---------|
| `app/api/mcp-registry/route.ts` | Proxy + transform registry API |
| `components/mcp/mcp-registry-browser.tsx` | Browsable registry UI |
| `components/mcp/mcp-server-card.tsx` | Individual server card in registry |

### Modified Phase Timeline

Add to **Phase 2: UI**:
- [ ] Create registry browser component
- [ ] Add search and category filtering
- [ ] Implement one-click add from registry

---

## Updated Implementation Phases

### Phase 1: Foundation (2-3 days)
- [ ] Add Prisma schema + migration
- [ ] Create MCP server CRUD API routes
- [ ] Add decryption helpers for MCP configs

### Phase 2: UI + Registry (3 days)
- [ ] Add "MCP Servers" tab to settings modal
- [ ] Create server list component
- [ ] Create add/edit form with auth options
- [ ] **Create registry browser with search**
- [ ] **Implement one-click add from registry**
- [ ] Add connection test UI

### Phase 3: Sandbox Integration (1-2 days)
- [ ] Modify `ensureSandboxReady` to inject MCP configs
- [ ] Create MCP config JSON builder
- [ ] Test with Claude Code agent + real MCP server

### Phase 4: OAuth (2 days)
- [ ] Implement OAuth initiation endpoint
- [ ] Create callback handler
- [ ] Add token storage + refresh logic
- [ ] Create OAuth connect UI

### Phase 5: Polish (1 day)
- [ ] Error handling improvements
- [ ] Status indicators and feedback
- [ ] End-to-end testing

**Updated Total: ~10-12 days**
