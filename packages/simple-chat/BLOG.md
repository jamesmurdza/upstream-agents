# Building a Chat Interface for Cloud Coding Agents

The Background Agents SDK runs coding agents in sandboxes. But agents are only useful if users can interact with them. I built an example chat app to show how the pieces fit together: GitHub authentication, SSE streaming that polls for events server-side, and git commands that let users push changes without leaving the chat.

[Screenshot: chat interface overview]

## GitHub OAuth

Everything starts with authentication. The app uses NextAuth with GitHub OAuth to get an access token:

```typescript
GitHubProvider({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  authorization: {
    params: {
      scope: "repo read:user user:email",
    },
  },
})
```

The `repo` scope is important—it lets the app clone private repos, push changes, and create pull requests on the user's behalf.

The token stays in your app. When you create a sandbox and clone a repo, you pass the token to the Daytona SDK:

```typescript
await sandbox.git.clone(repoUrl, path, branch, undefined, "x-access-token", githubToken)
```

When you push changes after the agent finishes:

```typescript
await sandbox.git.push(repoPath, "x-access-token", githubToken)
```

The agent never sees the token. It can modify files in the sandbox, but it can't push to GitHub directly. Only your app can do that.

## SSE Streaming

The core of the chat is a Server-Sent Events (SSE) stream. When a user sends a message:

1. Create a sandbox (if this is the first message)
2. Clone the repo and create a branch
3. Start the agent with `createSession()` and `session.start()`
4. Open an SSE connection to `/api/agent/stream`
5. Server polls `getEvents()` every 500ms and pushes updates
6. Client accumulates events and updates the UI
7. Stop when `status: "completed"` or `status: "error"`

Here's the server-side streaming endpoint:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    let cursor = 0
    let heartbeatTimer: NodeJS.Timeout | null = null

    const sendEvent = (event: string, data: object) => {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      controller.enqueue(encoder.encode(payload))
    }

    // Start heartbeat timer (every 15 seconds)
    heartbeatTimer = setInterval(() => {
      sendEvent("heartbeat", { cursor, timestamp: Date.now() })
    }, 15000)

    // Poll loop
    while (!isStreamClosed) {
      const result = await pollBackgroundAgent(sandbox, backgroundSessionId, options)

      if (result.rawEvents?.length > 0 || result.status !== "running") {
        cursor += result.rawEvents?.length || 0
        sendEvent("update", {
          status: result.status,
          content: result.content,
          toolCalls: result.toolCalls,
          contentBlocks: result.contentBlocks,
          cursor,
        })
      }

      if (result.status === "completed" || result.status === "error") {
        sendEvent("complete", { status: result.status, cursor })
        clearInterval(heartbeatTimer)
        controller.close()
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  },
})

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  },
})
```

On the client, you open an EventSource and listen for events:

```typescript
const eventSource = new EventSource(`/api/agent/stream?${params}`)

eventSource.addEventListener("update", (event) => {
  const data = JSON.parse(event.data)

  // Accumulate content from each event
  accumulatedContent.current.content += data.content
  accumulatedContent.current.toolCalls.push(...data.toolCalls)
  accumulatedContent.current.contentBlocks.push(...data.contentBlocks)

  // Update the UI
  updateLastMessage({
    content: accumulatedContent.current.content,
    toolCalls: accumulatedContent.current.toolCalls,
    contentBlocks: accumulatedContent.current.contentBlocks,
  })
})

eventSource.addEventListener("complete", (event) => {
  const data = JSON.parse(event.data)
  eventSource.close()
  // Auto-push changes on completion
  if (data.status === "completed") {
    pushChanges()
  }
})
```

The key insight: the SDK returns incremental events, so you accumulate them on the client. Each update adds to what you already have.

[Screenshot: message streaming in progress]

## Heartbeat & Reconnection

SSE connections can die silently—proxies timeout, networks switch, connections half-close. The server sends a heartbeat every 15 seconds to keep the connection alive and enable smart reconnection:

```typescript
eventSource.addEventListener("heartbeat", (event) => {
  const data = JSON.parse(event.data)
  // Track cursor for reconnection
  cursorRef.current = data.cursor
  // Reset reconnect attempts on heartbeat
  reconnectAttemptsRef.current = 0
})

eventSource.onerror = () => {
  // Connection lost - attempt reconnection with cursor
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    setTimeout(() => {
      connect(cursorRef.current) // Resume from last known position
    }, 1000)
  }
}
```

The cursor tracks how many events have been processed, so reconnection can resume without duplicates.

## Rendering Tool Calls

Agents don't just output text—they use tools. The SDK normalizes tool events across different agents, so you get a consistent structure:

- `tool_start` — tool name and input (file path, command, etc.)
- `tool_end` — final result with output

The `buildContentBlocks` function processes these events and creates an ordered list of content blocks—text and tool calls interleaved in the order they occurred:

```typescript
function buildContentBlocks(events: Event[]): BuildContentBlocksResult {
  const blocks: ContentBlock[] = []
  let pendingText = ""
  let pendingToolCalls: ToolCall[] = []

  for (const event of events) {
    if (event.type === "token") {
      // Flush pending tool calls before adding text
      if (pendingToolCalls.length > 0) {
        blocks.push({ type: "tool_calls", toolCalls: [...pendingToolCalls] })
        pendingToolCalls = []
      }
      pendingText += event.text
    } else if (event.type === "tool_start") {
      // Flush pending text before adding tool call
      if (pendingText) {
        blocks.push({ type: "text", text: pendingText })
        pendingText = ""
      }
      const tool = mapToolName(event.name)
      const { summary } = getToolDetail(event.name, event.input)
      pendingToolCalls.push({ tool, summary })
    } else if (event.type === "tool_end") {
      // Attach output to the last tool call
      if (event.output?.trim() && pendingToolCalls.length > 0) {
        pendingToolCalls[pendingToolCalls.length - 1].output = event.output.trim()
      }
    }
  }

  // Flush remaining
  if (pendingToolCalls.length > 0) {
    blocks.push({ type: "tool_calls", toolCalls: pendingToolCalls })
  }
  if (pendingText) {
    blocks.push({ type: "text", text: pendingText })
  }

  return { content, toolCalls, contentBlocks: blocks }
}
```

The UI renders these inline with the conversation:

[Screenshot: tool calls displayed in chat]

Each tool call shows what it's operating on (a file path, a shell command) and can be expanded to show the full output. This keeps the conversation readable while still letting users see exactly what the agent did.

```typescript
function ToolCallRow({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = getToolIcon(tool.tool)
  const hasOutput = !!tool.output

  return (
    <div
      onClick={() => hasOutput && setExpanded(!expanded)}
      className={hasOutput ? "cursor-pointer" : ""}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="truncate">{tool.summary}</span>
        {hasOutput && (expanded ? <ChevronDown /> : <ChevronRight />)}
      </div>

      {expanded && tool.output && (
        <pre className="text-xs mt-1.5 pl-3 border-l-2 border-border">
          {tool.output}
        </pre>
      )}
    </div>
  )
}
```

## Git Integration

Each chat is tied to a git branch. When you start a new conversation, the app:

1. Creates a Daytona sandbox
2. Clones the repo
3. Creates a new branch (e.g., `swift-lunar-abc1`)
4. Checks out that branch

The agent works on that branch. When it's done, the app auto-pushes the changes.

[Screenshot: branch indicator in chat header]

Slash commands let you interact with git without leaving the chat:

- `/pr` — create a pull request
- `/merge` — merge branches
- `/rebase` — rebase onto another branch

These commands use the GitHub token from OAuth—the one your app holds, not the sandbox. The agent can modify files all day, but only you can merge to main.

[Screenshot: slash command menu]

## Conclusion

Three pieces make the chat work: GitHub OAuth for authentication and git access, SSE streaming that polls the SDK server-side and pushes events to the client, and git integration that ties each conversation to a branch.

The app is intentionally minimal—no database, just local storage—so you can see the pattern without extra complexity.

---

Find the source on [GitHub](https://github.com/jamesmurdza/upstream-agents/tree/main/packages/simple-chat).
