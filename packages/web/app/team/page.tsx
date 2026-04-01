"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Users, Loader2, ArrowLeft, Plus, X, Search, LogOut, Trash2 } from "lucide-react"
import Link from "next/link"

interface TeamMember {
  id: string
  name: string | null
  githubLogin: string | null
  image: string | null
  joinedAt?: string
}

interface TeamOwner {
  id: string
  name: string | null
  githubLogin: string | null
  image: string | null
}

interface Team {
  id: string
  isOwner: boolean
  members?: TeamMember[]
  owner?: TeamOwner
}

interface SearchUser {
  id: string
  name: string | null
  githubLogin: string | null
  image: string | null
}

export default function TeamPage() {
  const { status } = useSession()
  const router = useRouter()

  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const fetchTeam = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/team")
      if (!res.ok) throw new Error("Failed to fetch team")
      const data = await res.json()
      setTeam(data.team)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated") {
      fetchTeam()
    }
  }, [status, router, fetchTeam])

  // Search users as they type
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/team/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.users)
        }
      } catch {
        // Ignore search errors
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const createTeam = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/team", { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create team")
      }
      const data = await res.json()
      setTeam(data.team)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  const deleteTeam = async () => {
    if (!confirm("Are you sure you want to delete your team? All members will be removed.")) {
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/team", { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to delete team")
      }
      setTeam(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  const addMember = async (githubUsername: string) => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUsername }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to add member")
      }
      const data = await res.json()
      setTeam((prev) =>
        prev ? { ...prev, members: [...(prev.members || []), data.member] } : prev
      )
      setSearchQuery("")
      setSearchResults([])
      setShowSearch(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  const removeMember = async (userId: string) => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/team/members/${userId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to remove member")
      }
      setTeam((prev) =>
        prev ? { ...prev, members: prev.members?.filter((m) => m.id !== userId) } : prev
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  const leaveTeam = async () => {
    if (!confirm("Are you sure you want to leave this team?")) {
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/team/leave", { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to leave team")
      }
      setTeam(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <main className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Team</h1>
                <p className="text-sm text-muted-foreground">Share your Claude subscription</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* No team */}
        {!team && (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-medium text-foreground mb-2">Create a Team</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Create a team to share your Claude subscription with others.
              Team members will automatically use your Claude credentials.
            </p>
            <button
              onClick={createTeam}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Team
            </button>
          </div>
        )}

        {/* Team owner view */}
        {team?.isOwner && (
          <div className="space-y-6">
            {/* Add member */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-foreground">Add Team Member</h2>
              </div>

              {showSearch ? (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by GitHub username..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        setShowSearch(false)
                        setSearchQuery("")
                        setSearchResults([])
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Search results */}
                  {(searchResults.length > 0 || searching) && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
                      {searching ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        searchResults.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => addMember(user.githubLogin || "")}
                            disabled={actionLoading}
                            className="flex w-full items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors disabled:opacity-50"
                          >
                            {user.image ? (
                              <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-secondary" />
                            )}
                            <div className="text-left">
                              <div className="text-sm font-medium text-foreground">
                                {user.name || user.githubLogin}
                              </div>
                              {user.githubLogin && (
                                <div className="text-xs text-muted-foreground">
                                  @{user.githubLogin}
                                </div>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowSearch(true)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add member by GitHub username
                </button>
              )}
            </div>

            {/* Members list */}
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-medium text-foreground">
                  Members ({team.members?.length || 0})
                </h2>
              </div>
              {team.members && team.members.length > 0 ? (
                <div className="divide-y divide-border">
                  {team.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        {member.image ? (
                          <img src={member.image} alt="" className="h-8 w-8 rounded-full" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-secondary" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {member.name || member.githubLogin}
                          </div>
                          {member.githubLogin && (
                            <div className="text-xs text-muted-foreground">
                              @{member.githubLogin}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeMember(member.id)}
                        disabled={actionLoading}
                        className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Remove member"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No members yet. Add team members to share your Claude subscription.
                </div>
              )}
            </div>

            {/* Delete team */}
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">Delete Team</h3>
                  <p className="text-xs text-muted-foreground">
                    This will remove all members from your team.
                  </p>
                </div>
                <button
                  onClick={deleteTeam}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Team member view */}
        {team && !team.isOwner && team.owner && (
          <div className="space-y-6">
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-6 text-center">
              <div className="flex justify-center mb-4">
                {team.owner.image ? (
                  <img src={team.owner.image} alt="" className="h-16 w-16 rounded-full" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-secondary" />
                )}
              </div>
              <h2 className="text-lg font-medium text-foreground mb-1">
                Using {team.owner.name || team.owner.githubLogin}&apos;s Claude Subscription
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                You&apos;re a member of @{team.owner.githubLogin}&apos;s team.
                Your Claude agent runs will use their subscription.
              </p>
              <button
                onClick={leaveTeam}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Leave Team
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
