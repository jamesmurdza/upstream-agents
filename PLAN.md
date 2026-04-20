# Plan: Fix Merge Not Syncing Target Branch

## Problem
When merging Chat B into Chat A, the merge succeeds on GitHub but Chat A's sandbox doesn't get the changes because:
1. Target sandbox might be stopped
2. No mechanism to sync later when sandbox wakes up
3. Currently allows merging into a branch with a running agent (dangerous)

## Solution Overview

Three-part fix:
1. **Block merge into running branch** - Prevent conflicts/confusion
2. **Pull immediately if sandbox active** - Best case, instant sync
3. **Mark for sync + pull on wake** - Handles stopped sandboxes

---

## Implementation Steps

### Step 1: Add `needsSync` field to Chat type

**File:** `packages/simple-chat/lib/types.ts`

Add to Chat interface:
```typescript
needsSync?: boolean  // Set after merge into this branch when sandbox was stopped
```

This persists to localStorage automatically since Chat is persisted.

---

### Step 2: Block merge into running branch

**File:** `packages/simple-chat/components/modals/GitDialogs.tsx`

In `handleMerge`, before making the API call:
1. Add `getTargetChatStatus` callback to `UseGitDialogsOptions`
2. Check if target branch status is "running"
3. If running, show error message and abort

**File:** `packages/simple-chat/app/page.tsx`

Add callback:
```typescript
getTargetChatStatus: (branch) => {
  const target = chats.find(c => c.repo === currentChat.repo && c.branch === branch)
  return target?.status ?? null
}
```

---

### Step 3: Mark for sync when pull fails or sandbox stopped

**File:** `packages/simple-chat/app/api/sandbox/git/route.ts`

Update merge success handling:
```typescript
} else if (targetSandboxId) {
  try {
    const targetSandbox = await daytona.get(targetSandboxId)
    if (targetSandbox.state === "started") {
      await targetSandbox.git.pull(repoPath, "x-access-token", githubToken)
      return Response.json({ success: true })
    } else {
      // Sandbox not running, tell frontend to mark for sync
      return Response.json({ success: true, needsSync: true })
    }
  } catch {
    // Pull failed, tell frontend to mark for sync
    return Response.json({ success: true, needsSync: true })
  }
}
```

**File:** `packages/simple-chat/components/modals/GitDialogs.tsx`

After successful merge, check response:
```typescript
if (data.needsSync && onMarkBranchNeedsSync) {
  onMarkBranchNeedsSync(selectedBranch)
}
```

**File:** `packages/simple-chat/app/page.tsx`

Add callback:
```typescript
onMarkBranchNeedsSync: (branch) => {
  const target = chats.find(c => c.repo === currentChat.repo && c.branch === branch)
  if (target) updateChat(target.id, { needsSync: true })
}
```

---

### Step 4: Pull on sandbox wake-up if needsSync is true

**File:** `packages/simple-chat/app/api/agent/execute/route.ts`

After `sandbox.start()` (line 43-44), before executing:
1. Accept `needsSync` parameter from request body
2. If `needsSync` is true, pull before executing
3. Return `synced: true` in response so frontend can clear flag

```typescript
if (sandbox.state !== "started") {
  await sandbox.start(120)
}

// Sync if needed (after merge while sandbox was stopped)
if (needsSync) {
  try {
    await sandbox.git.pull(repoPath, "x-access-token", githubToken)
  } catch {
    // Best effort - continue with execution
  }
}
```

**File:** `packages/simple-chat/lib/hooks/useChat.ts`

In `sendMessage`, pass `needsSync` to execute API:
```typescript
body: JSON.stringify({
  sandboxId: chat.sandboxId,
  prompt: content,
  repoName,
  agent: chat.agent,
  needsSync: chat.needsSync,
})
```

After successful execute, clear the flag:
```typescript
if (chat.needsSync) {
  updateChat(chat.id, { needsSync: false })
}
```

---

## Files to Modify

1. `packages/simple-chat/lib/types.ts` - Add `needsSync` field
2. `packages/simple-chat/components/modals/GitDialogs.tsx` - Block running, handle needsSync response
3. `packages/simple-chat/app/page.tsx` - Add callbacks
4. `packages/simple-chat/app/api/sandbox/git/route.ts` - Check sandbox state, return needsSync
5. `packages/simple-chat/app/api/agent/execute/route.ts` - Pull on wake if needsSync
6. `packages/simple-chat/lib/hooks/useChat.ts` - Pass needsSync, clear after sync

---

## Edge Cases Handled

1. **Target sandbox running** → Pull immediately ✓
2. **Target sandbox stopped** → Mark needsSync, pull on next execute ✓
3. **Target branch has running agent** → Block merge with error ✓
4. **User refreshes before switching** → needsSync persisted in localStorage ✓
5. **Pull fails** → Mark needsSync, retry on next execute ✓

---

## Testing Checklist

- [ ] Merge B into A while A's sandbox is running → A gets changes immediately
- [ ] Merge B into A while A's sandbox is stopped → A gets changes on next message
- [ ] Try to merge B into A while A has running agent → Error message shown
- [ ] Refresh page after merge (while A stopped) → needsSync persists, syncs on next use
