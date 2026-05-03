# Scheduled Agents - Design Plan

## Overview

Agents that run automatically on a schedule, execute a prompt against a repo, and create PRs if there are commits.

---

## UI Design

### Creation
- Clock icon (⏰) in prompt field, left of agent selector
- Click opens modal with: repo, branch, agent, model, interval, prompt, auto-PR toggle
- Current chat context pre-fills defaults

### Sidebar
- Single item: "⏰ Scheduled Jobs"
- Click opens table view

### Table View

| NAME | REPO | EVERY | LAST RUN |
|------|------|-------|----------|
| Dep updates | acme/app | 6h | ✓ 2h ago PR #142 |
| Code audit | acme/lib | 1w | ✓ 3d ago no changes |
| Security scan | acme/api | 1d | ✗ failed |

- Click row → opens chat view for that job

### Chat View
- **Header**: Title (left), timestamp dropdown (right)
- **Body**: Messages from that run (same as regular chat)
- **Timestamp dropdown**: Lists all past runs with status (✓/✗), select to view that run
- **Navigation**: Click "Scheduled Jobs" in sidebar to go back to table

### Edit
- From table: row menu or click into chat then edit
- Same form as creation, pre-filled

---

## User Flows

### Flow 1: Create a Scheduled Job

1. User is in a chat (or empty prompt)
2. Clicks ⏰ icon next to agent selector
3. Modal opens with form
4. Clicks "Create"
5. **Navigates to Scheduled Jobs table, new job highlighted**

### Flow 2: View Scheduled Jobs

1. User clicks "⏰ Scheduled Jobs" in sidebar
2. Table appears showing all jobs with last run status
3. User scans to see what's running, what failed, recent PRs

### Flow 3: View a Specific Run

1. From table, user clicks a job row
2. Chat view opens showing latest run's messages
3. Header shows: job name (left), run timestamp (right)
4. User reads agent output, sees commits made, PR created

### Flow 4: View Past Runs

1. User is in a job's chat view
2. Clicks timestamp dropdown (top right)
3. Dropdown shows list of all runs with ✓/✗ status
4. User selects an older run
5. Chat view updates to show that run's messages

### Flow 5: Edit a Job

1. User is viewing a job (chat view) or in table
2. Opens edit (via menu or button)
3. Same modal as create, pre-filled with current config
4. User modifies interval, prompt, etc.
5. Clicks "Save"
6. **Returns to Scheduled Jobs table**

### Flow 6: Pause/Resume a Job

1. From table or job view
2. User clicks pause/resume action
3. Job stops/starts running on schedule
4. Status indicator updates (🟢 → ⏸️)

### Flow 7: Delete a Job

1. From table or job view
2. User clicks delete
3. Confirmation prompt
4. Job and run history removed
5. **Returns to Scheduled Jobs table**

### Flow 8: Run Now (Manual Trigger)

1. From table or job view
2. User clicks "Run Now"
3. Job executes immediately (outside normal schedule)
4. User can watch progress in chat view

---

## Database Schema

### New Tables

```prisma
model ScheduledJob {
  id            String   @id @default(cuid())
  userId        String

  // Config
  name          String
  prompt        String   @db.Text
  repo          String
  baseBranch    String
  agent         String
  model         String?

  // Schedule
  intervalMinutes Int              // e.g., 360 = every 6 hours
  enabled       Boolean  @default(true)
  nextRunAt     DateTime

  // Auto-PR
  autoPR        Boolean  @default(true)

  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  runs ScheduledJobRun[]

  @@index([userId])
  @@index([enabled, nextRunAt])
}

model ScheduledJobRun {
  id          String    @id @default(cuid())
  jobId       String

  // Execution
  status      String    // "pending" | "running" | "completed" | "error"
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  // Results
  sandboxId   String?
  branch      String?
  commitCount Int       @default(0)
  prUrl       String?
  prNumber    Int?
  error       String?   @db.Text

  // Link to chat for full message history
  chatId      String?   @unique
  chat        Chat?     @relation(fields: [chatId], references: [id])

  job ScheduledJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId, startedAt])
}
```

### Modifications to Existing Tables

```prisma
model Chat {
  // ... existing fields ...

  // Hide scheduled run chats from sidebar
  isScheduledRun  Boolean  @default(false)

  // Link back to run
  scheduledJobRun ScheduledJobRun?
}
```

Chats created for scheduled runs are hidden from the main sidebar (filtered by `isScheduledRun: false`). They're only accessible via the Scheduled Jobs table.

---

## API Endpoints

### CRUD

```
GET    /api/scheduled-jobs                  # List user's jobs
POST   /api/scheduled-jobs                  # Create job
GET    /api/scheduled-jobs/[id]             # Get job with recent runs
PATCH  /api/scheduled-jobs/[id]             # Update job config
DELETE /api/scheduled-jobs/[id]             # Delete job + runs
```

### Actions

```
POST   /api/scheduled-jobs/[id]/toggle      # Pause/resume
POST   /api/scheduled-jobs/[id]/run         # Trigger immediate run
```

### Run History

```
GET    /api/scheduled-jobs/[id]/runs        # List all runs
GET    /api/scheduled-jobs/[id]/runs/[runId] # Get run with messages
```

---

## Cron Implementation

### Approach: Vercel Cron + Database Polling

Two cron jobs running every minute:

1. **Dispatcher**: Finds due jobs, starts execution
2. **Completion Checker**: Polls running jobs, finalizes when done

### Cron 1: Job Dispatcher

`GET /api/cron/dispatch-scheduled-jobs`

```typescript
async function handler() {
  // Find due jobs
  const jobs = await prisma.scheduledJob.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: new Date() },
      // Not already running
      runs: { none: { status: "running" } }
    }
  })

  for (const job of jobs) {
    // Create run record (claims the job)
    const run = await prisma.scheduledJobRun.create({
      data: { jobId: job.id, status: "running" }
    })

    // Update next run time
    await prisma.scheduledJob.update({
      where: { id: job.id },
      data: { nextRunAt: addMinutes(new Date(), job.intervalMinutes) }
    })

    // Start execution (fire-and-forget)
    await startJobExecution(job, run)
  }
}
```

### Cron 2: Completion Checker

`GET /api/cron/check-scheduled-runs`

```typescript
async function handler() {
  // Find running jobs
  const runs = await prisma.scheduledJobRun.findMany({
    where: { status: "running" },
    include: { job: true }
  })

  for (const run of runs) {
    const snapshot = await snapshotBackgroundAgent(run.sandboxId, run.backgroundSessionId)

    if (snapshot.status === "completed") {
      await finalizeRun(run, snapshot)
    } else if (snapshot.status === "error") {
      await failRun(run, snapshot.error)
    }
    // else still running, check again next minute
  }
}
```

### Vercel Config

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/dispatch-scheduled-jobs",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/check-scheduled-runs",
      "schedule": "* * * * *"
    }
  ]
}
```

---

## Job Execution Flow

```typescript
async function startJobExecution(job: ScheduledJob, run: ScheduledJobRun) {
  // 1. Create chat for this run (hidden from sidebar)
  const chat = await prisma.chat.create({
    data: {
      userId: job.userId,
      repo: job.repo,
      baseBranch: job.baseBranch,
      agent: job.agent,
      model: job.model,
      isScheduledRun: true
    }
  })

  // 2. Create sandbox
  const sandbox = await createSandbox({
    repo: job.repo,
    branch: job.baseBranch
  })

  // 3. Create unique branch for this run
  const branch = `scheduled/${job.id}/${format(new Date(), "yyyyMMdd-HHmmss")}`
  await sandbox.exec(`git checkout -b ${branch}`)

  // 4. Get user credentials
  const user = await prisma.user.findUnique({ where: { id: job.userId } })
  const credentials = decrypt(user.credentials)

  // 5. Start agent session
  const session = await createBackgroundAgentSession({
    sandbox,
    agent: job.agent,
    model: job.model,
    prompt: job.prompt,
    credentials
  })

  // 6. Store session info for completion checker
  await prisma.scheduledJobRun.update({
    where: { id: run.id },
    data: {
      chatId: chat.id,
      sandboxId: sandbox.id,
      backgroundSessionId: session.id,
      branch
    }
  })
}
```

---

## Run Finalization

```typescript
async function finalizeRun(run: ScheduledJobRun, snapshot: AgentSnapshot) {
  const job = run.job

  // 1. Save messages to linked chat
  for (const msg of snapshot.messages) {
    await prisma.message.create({
      data: {
        chatId: run.chatId,
        role: msg.role,
        content: msg.content,
        // ... other fields
      }
    })
  }

  // 2. Count commits
  const commitCount = await getCommitCount(run.sandboxId, job.baseBranch, run.branch)

  // 3. Maybe create PR
  let prUrl, prNumber
  if (job.autoPR && commitCount > 0) {
    await pushBranch(run.sandboxId, run.branch)

    const pr = await createPR({
      repo: job.repo,
      head: run.branch,
      base: job.baseBranch,
      title: `[Scheduled] ${job.name} - ${format(run.startedAt, "MMM d")}`,
    })
    prUrl = pr.url
    prNumber = pr.number
  }

  // 4. Update run record
  await prisma.scheduledJobRun.update({
    where: { id: run.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      commitCount,
      prUrl,
      prNumber
    }
  })
}
```

---

## Summary

| Component | Purpose |
|-----------|---------|
| `ScheduledJob` | Stores job config, schedule, next run time |
| `ScheduledJobRun` | Stores each execution's results, links to Chat |
| `Chat.isScheduledRun` | Hides scheduled run chats from sidebar |
| `/api/cron/dispatch-scheduled-jobs` | Finds due jobs, starts execution |
| `/api/cron/check-scheduled-runs` | Polls running jobs, finalizes when done |
| Clock icon in prompt | Entry point to create scheduled job |
| Scheduled Jobs sidebar item | Entry point to view/manage jobs |
