# Lazy Loading Message Content - Implementation Plan

## Goal
Reduce Neon database network transfer by ~80% by not fetching full message `content`, `toolCalls`, and `contentBlocks` until the user actually views a conversation.

## Current Problem
1. On page load, `use-repo-data.ts` fetches messages for **all running branches** in parallel
2. Each fetch returns **100 messages with full content** (unbounded `@db.Text`)
3. The `/api/sync` endpoint triggers message reloads when `lastMessageId` changes
4. Result: 500KB+ transferred from Neon per page load, most of it never viewed

## Implementation Strategy

### Phase 1: API Changes

#### 1.1 Modify `/api/branches/messages` GET endpoint
**File:** `app/api/branches/messages/route.ts`

Add a `summary` query parameter:
- `?summary=true` → Returns only: `id`, `role`, `createdAt`, `timestamp`, `commitHash`, `commitMessage`
- `?summary=false` (default for backwards compat) → Returns full message with `content`, `toolCalls`, `contentBlocks`

```typescript
// When summary=true, use Prisma select to fetch only metadata
const messages = await prisma.message.findMany({
  where: { branchId },
  select: summary ? {
    id: true,
    role: true,
    createdAt: true,
    timestamp: true,
    commitHash: true,
    commitMessage: true,
  } : undefined,  // undefined = select all (current behavior)
  orderBy: { createdAt: "asc" },
  take: limit,
})
```

#### 1.2 Create new endpoint `/api/messages/[id]` for single message fetch
**File:** `app/api/messages/[id]/route.ts` (new)

- GET with message ID returns full message content
- Verify ownership through branch → repo → user chain
- Used when user scrolls to view a message that hasn't been loaded yet

### Phase 2: Type Updates

#### 2.1 Add `MessageSummary` type
**File:** `lib/db-types.ts`

```typescript
export interface DbMessageSummary {
  id: string
  role: string
  createdAt: string
  timestamp: string | null
  commitHash: string | null
  commitMessage: string | null
}
```

#### 2.2 Update `Message` type to support partial loading
**File:** `lib/types.ts`

Add optional flag to indicate content hasn't been loaded:
```typescript
export interface Message {
  // ... existing fields
  contentLoaded?: boolean  // false = summary only, true or undefined = full content available
}
```

### Phase 3: Frontend Changes

#### 3.1 Update `use-repo-data.ts` initial load
**File:** `hooks/use-repo-data.ts`

Change the eager message loading to use `?summary=true`:
```typescript
const res = await fetch(`/api/branches/messages?branchId=${branch.id}&summary=true`)
```

#### 3.2 Add `loadMessageContent` function
**File:** `hooks/use-repo-data.ts`

New function to load full content for specific messages:
```typescript
const loadMessageContent = useCallback(async (messageId: string, branchId: string, repoId: string) => {
  const res = await fetch(`/api/messages/${messageId}`)
  // Update the message in state with full content
})
```

#### 3.3 Update `loadBranchMessages` to fetch full content
**File:** `hooks/use-repo-data.ts`

When user selects a branch, load full messages (not summaries):
```typescript
const res = await fetch(`/api/branches/messages?branchId=${branchId}`)  // no summary=true
```

This is the key optimization: **only load full content when user actually views the branch**.

#### 3.4 Update `use-sync-data.ts` message reload
**File:** `hooks/use-sync-data.ts`

When sync detects new messages on the **active branch**, fetch full content.
When sync detects new messages on **inactive branches**, don't fetch at all (just track the ID).

### Phase 4: UI Updates

#### 4.1 Update `MessageList` to handle partial messages
**File:** `components/chat/message-list.tsx`

Show placeholder/skeleton for messages where `contentLoaded === false`.
(Optional - could skip this if we always load full content when branch is selected)

#### 4.2 Update `MessageBubble` to handle missing content
**File:** `components/chat/message-bubble.tsx`

Handle case where `content` is empty string but message exists (during lazy load).

## Migration Path (Backwards Compatible)

1. `summary` parameter defaults to `false` - existing behavior unchanged
2. New `/api/messages/[id]` endpoint is additive
3. Frontend changes can be rolled out incrementally
4. No database schema changes required

## Expected Impact

| Scenario | Before | After | Reduction |
|----------|--------|-------|-----------|
| Page load (3 running branches, 50 msgs each) | ~500KB | ~15KB | **97%** |
| Select inactive branch | 0 (already loaded) | ~100KB | N/A (deferred) |
| Sync with new message (inactive branch) | ~100KB | 0 | **100%** |
| Total monthly (estimate) | 4.1GB | <1GB | **~75%** |

## Files to Modify

1. `app/api/branches/messages/route.ts` - Add `summary` param
2. `app/api/messages/[id]/route.ts` - **NEW** - Single message fetch
3. `lib/db-types.ts` - Add `DbMessageSummary` type
4. `lib/types.ts` - Add `contentLoaded` flag to `Message`
5. `hooks/use-repo-data.ts` - Use summaries on load, full content on branch select
6. `hooks/use-sync-data.ts` - Skip message fetch for inactive branches

## Testing Checklist

- [ ] Page loads with only message summaries (verify in Network tab)
- [ ] Selecting a branch loads full message content
- [ ] New messages during streaming display correctly
- [ ] Sync doesn't break when switching branches
- [ ] Cross-device sync still detects new messages
- [ ] Existing message operations (create, update) still work
