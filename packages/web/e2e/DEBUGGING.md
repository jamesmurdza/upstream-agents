# Debugging E2E Test Failures

## The Core Problem

6 of 9 failing tests all show the same error:
```
No execution found for branch X after 5 polls
```

This happens when:
1. Agent starts executing
2. Page is reloaded or navigated away
3. Agent completes in background
4. Client polls `/api/agent/execution/active` to find the execution
5. **The execution record is not found**

## Why Executions Disappear

The `/api/agent/execution/active` endpoint queries:
```sql
SELECT * FROM AgentExecution
WHERE message.branchId = :branchId
ORDER BY startedAt DESC
LIMIT 1
```

The execution lookup depends on:
1. `AgentExecution.messageId` → `Message.id`
2. `Message.branchId` → `Branch.id`

**If any of these relationships are broken, the execution becomes orphaned.**

## Files to Investigate

### 1. `lib/agents/agent-session.ts` (527 lines)

**Problem**: This file does too many things:
- System prompt building
- Tool name mapping
- Content block reconstruction
- Session persistence
- Background session creation
- Background polling

**Suggested Refactors**:

```
lib/agents/
├── agent-session.ts          # Keep: Main exports, facade
├── system-prompt.ts          # Extract: buildSystemPrompt()
├── tool-mapping.ts           # Extract: mapToolName(), TOOL_NAME_MAP
├── content-blocks.ts         # Extract: buildContentBlocks(), getToolDetail()
├── session-persistence.ts    # Extract: persistSessionId(), readPersistedSessionId()
└── background-session.ts     # Extract: Background session logic
```

**Why this helps debugging**:
- Each file can be unit-tested independently
- Smaller files = easier to find bugs
- Content block reconstruction is a common source of state mismatch

### 2. `lib/core/polling/polling-state.ts` (385 lines)

**Problem**: The state machine is well-structured, but:
- No logging/tracing of state transitions
- Hard to know which action caused a state change
- `MAX_NOT_FOUND_RETRIES = 10` but test uses 5

**Suggested Refactors**:

```typescript
// Add transition logging
export function pollingReducer(
  state: PollingState,
  action: PollingAction
): PollingTransitionResult {
  const result = pollingReducerCore(state, action)

  // Debug logging (only in dev/test)
  if (process.env.NODE_ENV !== 'production') {
    console.log('[polling]', {
      action: action.type,
      prevStatus: state.status,
      nextStatus: result.state.status,
      effects: result.effects.map(e => e.type),
      retries: result.state.notFoundRetries,
    })
  }

  return result
}
```

**Why this helps debugging**:
- See exactly when `POLL_NOT_FOUND` is dispatched
- Track retry count progression
- Identify if effects are being dropped

### 3. `app/api/agent/execution/active/route.ts` (79 lines)

**Problem**: Silent failure when execution not found - returns `{ execution: null }`.

**Suggested Refactors**:

```typescript
// Add diagnostic info when execution not found
if (!execution) {
  // Count executions for this branch (helps distinguish "never created" vs "deleted")
  const executionCount = await prisma.agentExecution.count({
    where: { message: { branchId } }
  })

  // Check if message exists
  const messageExists = await prisma.message.findFirst({
    where: { branchId },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  })

  return Response.json({
    execution: null,
    debug: {
      executionCount,
      hasMessages: !!messageExists,
      branchId,
    }
  })
}
```

**Why this helps debugging**:
- Distinguish "execution never created" from "execution exists but query failed"
- Helps identify FK constraint issues

### 4. `app/api/agent/execute/route.ts` (224 lines)

**Problem**: Complex flow with many early returns. Hard to trace execution creation.

**Key section** (lines 142-148):
```typescript
const agentExecution = await prisma.agentExecution.create({
  data: {
    messageId,
    sandboxId: daytonaSandboxId,
    status: "running",
  },
})
```

**Suggested Refactors**:

1. Add a unique `executionId` field (UUID) that's returned to client immediately:
```typescript
const executionId = crypto.randomUUID()
const agentExecution = await prisma.agentExecution.create({
  data: {
    executionId,  // New field
    messageId,
    sandboxId: daytonaSandboxId,
    status: "running",
  },
})
// Client can now poll by executionId directly
return Response.json({
  success: true,
  messageId,
  executionId: agentExecution.id,
  executionUUID: executionId  // Direct lookup key
})
```

2. Add timing logs around each step:
```typescript
console.log('[execute] Step 1: Authenticated', { userId: auth.userId })
console.log('[execute] Step 2: Sandbox verified', { sandboxId })
console.log('[execute] Step 3: Message verified', { messageId })
console.log('[execute] Step 4: Execution created', { executionId: agentExecution.id })
console.log('[execute] Step 5: Agent started')
```

## Test Fixture Improvements

### `e2e/fixtures/agent-fixture.ts`

**Problem**: `waitForCompletionViaAPI` doesn't log enough context.

**Current** (lines 118-141):
```typescript
export async function waitForCompletionViaAPI(page: Page, branchId: string) {
  let undefinedCount = 0
  const maxUndefined = 5

  await expect(async () => {
    const res = await page.request.post("/api/agent/execution/active", {
      data: { branchId },
    })
    const data = await res.json()
    const status = data.execution?.status
    // ...
  }).toPass({ timeout: TIMEOUT.AGENT_COMPLETE })
}
```

**Suggested**:
```typescript
export async function waitForCompletionViaAPI(page: Page, branchId: string) {
  let undefinedCount = 0
  const maxUndefined = 5
  const startTime = Date.now()

  await expect(async () => {
    const res = await page.request.post("/api/agent/execution/active", {
      data: { branchId },
    })
    const data = await res.json()
    const status = data.execution?.status

    // Log every poll for debugging
    console.log('[poll]', {
      branchId: branchId.slice(0, 8),
      status,
      executionId: data.execution?.id?.slice(0, 8),
      elapsedMs: Date.now() - startTime,
      undefinedCount,
      debug: data.debug,  // Include diagnostic info
    })

    if (status === undefined) {
      undefinedCount++
      if (undefinedCount >= maxUndefined) {
        throw new Error(
          `No execution found for branch ${branchId} after ${maxUndefined} polls. ` +
          `Debug: ${JSON.stringify(data.debug)}`
        )
      }
    } else {
      undefinedCount = 0
    }

    expect(status).toMatch(/completed|error/)
  }).toPass({ timeout: TIMEOUT.AGENT_COMPLETE, intervals: [1000, 2000, 3000] })
}
```

## Hypothesis: Race Condition on Page Reload

When a test does:
1. `sendMessage(page, prompt)` → Creates Message, triggers `/api/agent/execute`
2. `page.reload()` before execution record is created
3. Poll fails because Message→Execution relationship hasn't been committed

**To verify**: Add a delay after `sendMessage` before any navigation:
```typescript
await sendMessage(page, prompt)
await page.waitForTimeout(2000)  // Let execution record commit
await page.reload()
```

If tests pass with this delay, the root cause is a race between:
- Frontend sending prompt → Creating message → Calling execute endpoint
- Execute endpoint creating AgentExecution record

## Quick Wins for Debugging

1. **Add `DEBUG=1` mode** that logs every API call
2. **Add execution ID to all log messages** for correlation
3. **Add branch ID to error messages** for identification
4. **Return diagnostic data** when execution not found
5. **Add test step annotations** with timing:
   ```typescript
   await test.step('Send message', async () => {
     await sendMessage(page, prompt)
   })
   await test.step('Wait for execution', async () => {
     await waitForCompletionViaAPI(page, branchId)
   })
   ```

## Database Query to Find Orphaned Executions

```sql
-- Find executions without valid message→branch chain
SELECT ae.id, ae."messageId", ae.status, ae."startedAt"
FROM "AgentExecution" ae
LEFT JOIN "Message" m ON ae."messageId" = m.id
WHERE m.id IS NULL OR m."branchId" IS NULL;
```
