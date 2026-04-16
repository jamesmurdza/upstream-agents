# Building a Chat Interface for Cloud Coding Agents

The Background Agents SDK runs coding agents in sandboxes. But agents are only useful if users can interact with them. I built an example chat app to show how the pieces fit together: GitHub authentication, a message loop that polls for events, and git commands that let users push changes without leaving the chat.

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

## The Message Loop

The core of the chat is a polling loop. When a user sends a message:

1. Create a sandbox (if this is the first message)
2. Clone the repo and create a branch
3. Start the agent with `createSession()` and `session.start()`
4. Poll `getEvents()` every second
5. Accumulate events and update the UI
6. Stop when `running: false`

Here's the simplified polling logic:

```typescript
const poll = async () => {
  const response = await fetch(`/api/agent/status?sandboxId=${sandboxId}&sessionId=${sessionId}`)
  const data = await response.json()

  // Accumulate content from each poll
  accumulatedContent += data.content
  accumulatedToolCalls.push(...data.toolCalls)

  // Update the UI
  updateMessage({
    content: accumulatedContent,
    toolCalls: accumulatedToolCalls,
  })

  // Stop polling when done
  if (data.status === "completed" || data.status === "error") {
    clearInterval(pollingInterval)
  }
}

pollingInterval = setInterval(poll, 1000)
```

The key insight: the SDK returns incremental events, so you accumulate them on the client. Each poll adds to what you already have.

[Screenshot: message streaming in progress]

## Rendering Tool Calls

Agents don't just output text—they use tools. The SDK normalizes tool events across different agents, so you get a consistent structure:

- `tool_start` — tool name and input (file path, command, etc.)
- `tool_delta` — streaming output
- `tool_end` — final result

The UI renders these inline with the conversation:

[Screenshot: tool calls displayed in chat]

Each tool call shows what it's operating on (a file path, a shell command) and can be expanded to show the full output. This keeps the conversation readable while still letting users see exactly what the agent did.

```typescript
function ToolCallRow({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{tool.summary}</span>
        {expanded ? <ChevronDown /> : <ChevronRight />}
      </div>

      {expanded && tool.output && (
        <pre className="text-xs mt-1.5 pl-3 border-l-2">
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
3. Creates a new branch (e.g., `chat/fix-auth-bug`)
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

Three pieces make the chat work: GitHub OAuth for authentication and git access, a message loop that polls the SDK and renders events, and git integration that ties each conversation to a branch.

The app is intentionally minimal—no database, just local storage—so you can see the pattern without extra complexity.

---

Find the source on [GitHub](https://github.com/jamesmurdza/upstream-agents/tree/main/packages/simple-chat).
