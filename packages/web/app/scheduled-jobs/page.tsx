"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Clock, Plus, MoreHorizontal, Play, Pencil, Trash2, AlertCircle, Check, X, ArrowLeft } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { ScheduledJobForm } from "@/components/scheduled-jobs/ScheduledJobForm"
import { ConfirmDialog } from "@/components/modals/ConfirmDialog"

// =============================================================================
// Types
// =============================================================================

interface ScheduledJob {
  id: string
  name: string
  prompt: string
  repo: string
  baseBranch: string
  agent: string
  model: string | null
  intervalMinutes: number
  enabled: boolean
  nextRunAt: number
  autoPR: boolean
  consecutiveFailures: number
  createdAt: number
  updatedAt: number
  lastRun: {
    id: string
    status: string
    startedAt: number
    completedAt: number | null
    prUrl: string | null
    prNumber: number | null
    error: string | null
  } | null
}

// =============================================================================
// Helpers
// =============================================================================

function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

function getStatusIcon(job: ScheduledJob) {
  if (!job.enabled) {
    return <X className="h-3.5 w-3.5 text-muted-foreground" />
  }
  if (job.lastRun?.status === "error") {
    return <AlertCircle className="h-3.5 w-3.5 text-destructive" />
  }
  if (job.lastRun?.status === "completed") {
    return <Check className="h-3.5 w-3.5 text-green-500" />
  }
  if (job.lastRun?.status === "running") {
    return <Clock className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
  }
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
}

function getLastRunText(job: ScheduledJob): string {
  if (!job.lastRun) return "Never run"

  const timeAgo = formatDistanceToNow(job.lastRun.startedAt, { addSuffix: true })

  if (job.lastRun.status === "running") {
    return `Running ${timeAgo}`
  }
  if (job.lastRun.status === "error") {
    return `Failed ${timeAgo}`
  }
  if (job.lastRun.prUrl) {
    return `PR #${job.lastRun.prNumber} ${timeAgo}`
  }
  if (job.lastRun.status === "completed") {
    return `No changes ${timeAgo}`
  }
  return timeAgo
}

// =============================================================================
// Component
// =============================================================================

export default function ScheduledJobsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null)
  const [deleteJob, setDeleteJob] = useState<ScheduledJob | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  // Fetch jobs
  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/scheduled-jobs")
      if (!res.ok) throw new Error("Failed to fetch jobs")
      const data = await res.json()
      setJobs(data.jobs)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchJobs()
      // Poll every 30 seconds
      const interval = setInterval(fetchJobs, 30000)
      return () => clearInterval(interval)
    }
  }, [session])

  // Handlers
  const handleCreate = () => {
    setEditingJob(null)
    setFormOpen(true)
  }

  const handleEdit = (job: ScheduledJob) => {
    setEditingJob(job)
    setFormOpen(true)
    setMenuOpenId(null)
  }

  const handleDelete = async () => {
    if (!deleteJob) return

    try {
      const res = await fetch(`/api/scheduled-jobs/${deleteJob.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete job")
      setJobs((prev) => prev.filter((j) => j.id !== deleteJob.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleteJob(null)
    }
  }

  const handleRunNow = async (job: ScheduledJob) => {
    setMenuOpenId(null)
    try {
      const res = await fetch(`/api/scheduled-jobs/${job.id}/run`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to trigger run")
      // Refresh to show running status
      fetchJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger run")
    }
  }

  const handleFormSuccess = (job: ScheduledJob) => {
    setFormOpen(false)
    setEditingJob(null)
    if (editingJob) {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)))
    } else {
      setJobs((prev) => [job, ...prev])
    }
  }

  const handleViewRuns = (job: ScheduledJob) => {
    router.push(`/scheduled-jobs/${job.id}`)
  }

  // Render
  if (status === "loading" || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Sign in required</h1>
          <p className="text-muted-foreground">Please sign in to view scheduled jobs</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Scheduled Jobs</h1>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Job
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-medium mb-2">No scheduled jobs yet</h2>
            <p className="text-muted-foreground mb-4">
              Create a scheduled job to run agents automatically
            </p>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create your first job
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Repository</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Every</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Last Run</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => handleViewRuns(job)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job)}
                        <span className={cn(
                          "text-sm font-medium",
                          !job.enabled && "text-muted-foreground"
                        )}>
                          {job.name}
                        </span>
                        {!job.enabled && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Disabled
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {job.repo}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {formatInterval(job.intervalMinutes)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <span className={cn(
                        job.lastRun?.status === "error" && "text-destructive"
                      )}>
                        {getLastRunText(job)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(menuOpenId === job.id ? null : job.id)
                          }}
                          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {menuOpenId === job.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setMenuOpenId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-md border border-border bg-popover py-1 shadow-lg">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEdit(job)
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRunNow(job)
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Run Now
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMenuOpenId(null)
                                  setDeleteJob(job)
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-accent"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Form Modal */}
      {formOpen && (
        <ScheduledJobForm
          job={editingJob}
          onClose={() => {
            setFormOpen(false)
            setEditingJob(null)
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteJob}
        title="Delete scheduled job?"
        description={`This will permanently delete "${deleteJob?.name}" and all its run history.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        onClose={() => setDeleteJob(null)}
      />
    </div>
  )
}
