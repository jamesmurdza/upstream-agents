# Plan: Auto-generate English Chat Names with LLM

## Goal
Automatically generate human-readable English names for chats using an LLM, based on the user's first message.

## Current State
- `Chat.displayName` field exists but is always `null`
- UI falls back to "Untitled" when `displayName` is null
- User has API keys configured in settings (Anthropic, OpenAI, OpenCode, Gemini)

## Approach
Create a new API endpoint that uses the AI SDK to generate a short, descriptive chat title from the user's first prompt. Call this endpoint asynchronously after the first message is sent.

## Implementation Steps

### Step 1: Create API endpoint for chat name generation
**File:** `packages/simple-chat/app/api/chat/suggest-name/route.ts`

Create a new API endpoint that:
- Accepts `{ prompt: string, anthropicApiKey?: string, openaiApiKey?: string }`
- Uses the AI SDK (`generateText` from `ai` package) with user's API key
- Prompt: "Generate a short 2-5 word title for this chat. Reply with just the title, no quotes or punctuation. User's message: {prompt}"
- Uses fast/cheap models: Claude Haiku or GPT-4o-mini
- Returns `{ name: string }` or falls back to truncated prompt if no API key

### Step 2: Call the API after first message
**File:** `packages/simple-chat/lib/hooks/useChat.ts`

In the `sendMessage` function:
- After successfully starting the agent (after `startPolling` is called)
- Check if this is the first message (`chat.messages.length === 0` before adding user message)
- Call `/api/chat/suggest-name` in the background (don't await/block)
- On success, call `updateChat(chatId, { displayName: name })`

### Step 3: Fallback behavior
If no API keys are available or the call fails:
- Use first ~30 characters of the prompt, truncated at word boundary
- Example: "Build a todo app with React and..." → "Build a todo app with React"

## Files to Create/Modify
1. **Create:** `packages/simple-chat/app/api/chat/suggest-name/route.ts` - New API endpoint
2. **Modify:** `packages/simple-chat/lib/hooks/useChat.ts` - Call API on first message

## API Endpoint Details

```typescript
// POST /api/chat/suggest-name
// Request: { prompt: string, anthropicApiKey?: string, openaiApiKey?: string }
// Response: { name: string }

const PROMPT = `Generate a short 2-5 word title summarizing this request. Reply with just the title, no quotes, markdown, or extra punctuation.

User's message: {prompt}`
```

## Example Transformations
| User Prompt | LLM-Generated Name |
|-------------|-------------------|
| "Build a todo app with React" | "React Todo App" |
| "Help me create a login page with OAuth" | "OAuth Login Page" |
| "Fix the authentication bug in our API" | "API Auth Bug Fix" |
| "Add dark mode support to settings" | "Dark Mode Settings" |

## Dependencies
- `ai` package (AI SDK) - already in package.json
- `@ai-sdk/anthropic` and/or `@ai-sdk/openai` - need to verify/add
