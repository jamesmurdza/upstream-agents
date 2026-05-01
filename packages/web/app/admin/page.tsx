"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Users,
  MessageSquare,
  FolderOpen,
  LogIn,
  Activity,
  TrendingUp,
  Clock,
  Trophy,
  LayoutDashboard,
} from "lucide-react"

import { StatCard } from "@/components/admin/StatCard"
import { ActivityFeed } from "@/components/admin/ActivityFeed"
import { UserTable } from "@/components/admin/UserTable"
import { ActivityChart } from "@/components/admin/charts/ActivityChart"
import { UserGrowthChart } from "@/components/admin/charts/UserGrowthChart"
import { TopUsersChart } from "@/components/admin/charts/TopUsersChart"
import { HourlyActivityChart } from "@/components/admin/charts/HourlyActivityChart"
import {
  useAdminStatsQuery,
  useAdminActivityQuery,
  useAdminUsersQuery,
  useUpdateUserMutation,
} from "@/lib/query/hooks"

type SectionKey = "overview" | "users" | "activity"

const sections: { key: SectionKey; label: string; icon: typeof Users }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "users", label: "Users", icon: Users },
  { key: "activity", label: "Activity", icon: Activity },
]

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Navigation state
  const [activeSection, setActiveSection] = useState<SectionKey>("overview")

  // User table state
  const [usersPage, setUsersPage] = useState(1)
  const [usersSearch, setUsersSearch] = useState("")

  // Activity state
  const [activityPage, setActivityPage] = useState(1)

  // Queries
  const statsQuery = useAdminStatsQuery()
  const activityQuery = useAdminActivityQuery({ page: activityPage, limit: 20 })
  const usersQuery = useAdminUsersQuery({ page: usersPage, search: usersSearch || undefined })
  const updateUserMutation = useUpdateUserMutation()

  // Redirect if not authenticated or forbidden
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  // Handle 403 errors by redirecting
  useEffect(() => {
    const isForbidden =
      statsQuery.error?.message?.includes("Forbidden") ||
      activityQuery.error?.message?.includes("Forbidden") ||
      usersQuery.error?.message?.includes("Forbidden")

    if (isForbidden) {
      router.push("/")
    }
  }, [statsQuery.error, activityQuery.error, usersQuery.error, router])

  // Loading state
  if (status === "loading" || statsQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // Not authenticated
  if (status === "unauthenticated") {
    return null
  }

  const stats = statsQuery.data?.stats
  const weeklyActiveUsers = statsQuery.data?.weeklyActiveUsers ?? []
  const activityTrends = statsQuery.data?.activityTrends ?? []
  const topUsers = statsQuery.data?.topUsers ?? []
  const hourlyActivity = statsQuery.data?.hourlyActivity ?? []

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r bg-card">
        <div className="sticky top-0 p-4">
          <h1 className="mb-6 text-lg font-semibold">Admin</h1>
          <nav className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon
              const isActive = activeSection === section.key
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </button>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-8 p-8">
          {/* Overview Section */}
          {activeSection === "overview" && (
            <>
              {/* Stats Grid */}
              <section>
                <h2 className="mb-4 text-lg font-semibold">Overview</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    icon={Users}
                    label="Total Users"
                    value={stats?.totalUsers ?? 0}
                  />
                  <StatCard
                    icon={FolderOpen}
                    label="Total Chats"
                    value={stats?.totalChats ?? 0}
                    subValue={`${stats?.chatsCreatedToday ?? 0} today`}
                  />
                  <StatCard
                    icon={MessageSquare}
                    label="Messages This Week"
                    value={stats?.messagesCreatedThisWeek ?? 0}
                    subValue={`${stats?.messagesCreatedToday ?? 0} today`}
                  />
                  <StatCard
                    icon={LogIn}
                    label="Logins This Week"
                    value={stats?.loginsThisWeek ?? 0}
                    subValue={`${stats?.loginsToday ?? 0} today`}
                  />
                </div>
              </section>

              {/* Charts Row 1 */}
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-lg border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Activity Over Time</h3>
                  </div>
                  <ActivityChart data={activityTrends} />
                </div>

                <div className="rounded-lg border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Peak Hours (Last 14 Days)</h3>
                  </div>
                  <HourlyActivityChart data={hourlyActivity} />
                </div>
              </section>

              {/* Charts Row 2 */}
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-lg border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Top Active Users (Last 30 Days)</h3>
                  </div>
                  <TopUsersChart data={topUsers} />
                </div>

                <div className="rounded-lg border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Weekly Active Users</h3>
                  </div>
                  <UserGrowthChart data={weeklyActiveUsers} />
                </div>
              </section>
            </>
          )}

          {/* Users Section */}
          {activeSection === "users" && (
            <section>
              <h2 className="mb-4 text-lg font-semibold">User Management</h2>
              <UserTable
                users={usersQuery.data?.users ?? []}
                pagination={
                  usersQuery.data?.pagination ?? {
                    page: 1,
                    limit: 20,
                    total: 0,
                    totalPages: 0,
                  }
                }
                isLoading={usersQuery.isLoading}
                searchQuery={usersSearch}
                onSearchChange={(search) => {
                  setUsersSearch(search)
                  setUsersPage(1)
                }}
                onPageChange={setUsersPage}
                onToggleAdmin={(userId, isAdmin) => {
                  updateUserMutation.mutate({ userId, isAdmin })
                }}
                isUpdating={updateUserMutation.isPending ? updateUserMutation.variables?.userId : null}
                currentUserId={session?.user?.id}
              />
            </section>
          )}

          {/* Activity Section */}
          {activeSection === "activity" && (
            <section>
              <h2 className="mb-4 text-lg font-semibold">Recent Activity</h2>
              <div className="rounded-lg border bg-card p-6">
                <ActivityFeed
                  activities={activityQuery.data?.activities ?? []}
                  isLoading={activityQuery.isLoading}
                  hasMore={
                    activityQuery.data
                      ? activityQuery.data.pagination.page <
                        activityQuery.data.pagination.totalPages
                      : false
                  }
                  onLoadMore={() => setActivityPage((p) => p + 1)}
                />
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
