# Blog Post Outline: Building a Chat Interface for Cloud Coding Agents

## Opening

The Background Agents SDK handles running agents in sandboxes. But to build a full application, you need authentication, a way to poll and display events, and git integration. I built an example chat app that shows how these pieces fit together.

---

## Section: Using the Background Agents SDK

Brief recap of how the app uses the SDK:
- Creates a Daytona sandbox
- Clones the user's repo
- Starts a session with `createSession()`
- Polls with `getEvents()`

Link back to the SDK blog post for details.

---

## Section: GitHub OAuth

- Users sign in with GitHub OAuth
- The app gets an access token
- Token is used for: cloning private repos, pushing changes, creating PRs
- Token is NOT stored in the sandbox (security benefit)

How this connects to the SDK: when creating a sandbox, the app clones the repo using the user's token. When pushing, the app calls `sandbox.git.push()` with the token.

---

## Section: The Message Loop

The core of the chat is a polling loop that:

1. Sends a message to start the agent
2. Polls `getEvents()` on an interval
3. Accumulates events and updates the UI
4. Stops when `running: false`

Show how events are rendered:
- `token` → streaming text
- `tool_start` / `tool_end` → collapsible tool calls with input/output
- `end` → stop polling

This is the bridge between the SDK and the UI.

---

## Section: Rendering Tool Calls

Tool calls are the interesting part of the UI. The SDK normalizes tool names (`read`, `write`, `edit`, `shell`, etc.) so you can render them consistently across agents.

Show how tool calls are displayed:
- Tool name and input (e.g., file path, command)
- Streaming output via `tool_delta`
- Final result on `tool_end`
- Collapsible UI so tool calls don't overwhelm the conversation

Maybe show a simple component or the data structure.

---

## Section: Git Commands

Each chat is tied to a git branch. The app creates a new branch when you start a chat.

Slash commands let you interact with git without leaving the chat:
- `/pr` — opens a pull request on GitHub
- `/merge` — merges branches
- `/rebase` — rebases onto another branch

These commands use the GitHub token held by the app, not the sandbox. The agent can modify files, but only the user can push or create PRs.

---

## Conclusion

Three pieces make the chat work: GitHub OAuth for authentication and git access, a message loop that polls the SDK and renders events, and git commands that let users push changes without leaving the chat.

---

## Questions

1. How deep into the React/Next.js code should I go?
2. Should I show the actual API routes or keep it conceptual?
3. Any specific code patterns you want highlighted?
