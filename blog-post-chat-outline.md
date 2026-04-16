# Blog Post Outline: Building a Chat Interface for Cloud Coding Agents

---

## Opening (2 short paragraphs)

The Background Agents SDK runs coding agents in sandboxes. But agents are only useful if users can interact with them. I built an example chat app to show how the pieces fit together: GitHub authentication, a message loop that polls for events, and git commands that let users push changes without leaving the chat.

---

## GitHub OAuth

Start here because it's the foundation. Everything else depends on having a GitHub token.

- Sign in with GitHub, get an access token
- Token lets you: clone private repos, push changes, create PRs
- Key insight: the token stays in your app, not in the sandbox
- This means the agent can modify files, but can't push without your app's involvement

Short code snippet showing NextAuth setup or the clone/push calls with token.

---

## The Message Loop

This is the core of the chat. Walk through the flow:

1. User sends a message
2. App creates sandbox (if needed), starts session
3. Poll `getEvents()` every second
4. Accumulate events, render to UI
5. Stop when `running: false`

Code example of the polling loop. Keep it simple—this is the pattern that matters.

---

## Rendering Tool Calls

The interesting UI problem. Agents don't just output text—they use tools.

The SDK normalizes tool names across agents, so you get consistent events:
- `tool_start` with name and input
- `tool_delta` for streaming output
- `tool_end` with result

Show how the UI handles this:
- Display tool name and what it's operating on (file path, command)
- Stream output as it arrives
- Collapse when done so it doesn't overwhelm the conversation

Maybe a before/after or a simple component structure.

---

## Git Integration

Each chat = a git branch. Natural workflow.

When you start a chat:
- App creates a sandbox
- Clones the repo
- Creates a new branch

Slash commands for git operations:
- `/pr` — create a pull request
- `/merge` — merge branches
- `/rebase` — rebase onto another branch

These use the GitHub token from OAuth. The agent never has direct access to push.

---

## Conclusion (1 paragraph)

Three pieces: GitHub OAuth for auth and git access, a message loop that bridges the SDK to the UI, and git integration that gives you a branch-per-conversation workflow. The app is intentionally minimal—no database, just local storage—so you can see the pattern without extra complexity.

Link to source.

---

## Notes on structure

- **GitHub OAuth first** because it enables everything else
- **Message loop second** because it's the technical core
- **Tool calls third** because it's the interesting UI challenge
- **Git integration last** because it's the workflow payoff

Each section builds on the previous. OAuth → you can clone repos. Message loop → you can run agents. Tool calls → you can see what agents do. Git → you can ship the results.

---

## Open questions

1. Should I include actual screenshots of the UI?
2. How much code to show? (I'm thinking 2-3 short snippets max)
