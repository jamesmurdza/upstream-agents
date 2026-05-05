"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Users,
  MessageSquare,
  Activity,
  TrendingUp,
  Clock,
  Trophy,
  LayoutDashboard,
} from "lucide-react"
import { ActivityFeed } from "@/components/admin/ActivityFeed"
import { UserTable, type SortField, type SortOrder } from "@/components/admin/UserTable"
import { UserGrowthChart } from "@/components/admin/charts/UserGrowthChart"
import { MessagesByModelChart } from "@/components/admin/charts/MessagesByModelChart"
import { TopUsersTable } from "@/components/admin/TopUsersTable"
import { HourlyActivityChart } from "@/components/admin/charts/HourlyActivityChart"
import { DailyMessagesChatsChart } from "@/components/admin/charts/DailyMessagesChatsChart"
import {
  useAdminStatsQuery,
  useAdminActivityQuery,
  useAdminUsersQuery,
  useUpdateUserMutation,
  useAdminTopUsersQuery,
  type TopUsersRange,
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
  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  // Activity state
  const [activityPage, setActivityPage] = useState(1)
  const [activityFilters, setActivityFilters] = useState<{
    action?: string
    agent?: string
    model?: string
    dateFrom?: string
    dateTo?: string
  }>({})

  // Top users time range state
  const [topUsersRange, setTopUsersRange] = useState<TopUsersRange>("24h")

  // Queries
  const statsQuery = useAdminStatsQuery()
  const topUsersQuery = useAdminTopUsersQuery(topUsersRange)
  const activityQuery = useAdminActivityQuery({
    page: activityPage,
    limit: 20,
    ...activityFilters,
    includeFilters: true,
  })
  const usersQuery = useAdminUsersQuery({
    page: usersPage,
    search: usersSearch || undefined,
    sortField,
    sortOrder,
  })
  const updateUserMutation = useUpdateUserMutation()

  // Handle sort change
  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      // Toggle order if clicking same field
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      // New field, default to desc
      setSortField(field)
      setSortOrder("desc")
    }
    setUsersPage(1) // Reset to first page on sort change
  }

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

  const weeklyActiveUsers = statsQuery.data?.weeklyActiveUsers ?? []
  const topUsers = topUsersQuery.data?.topUsers ?? []
  const hourlyActivity = statsQuery.data?.hourlyActivity ?? []
  const dailyMessagesChats = statsQuery.data?.dailyMessagesChats ?? []
  const messagesByModel = statsQuery.data?.messagesByModel ?? []

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
              {/* Charts Row 1 */}
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-lg border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Daily Messages & Conversations</h3>
                  </div>
                  <DailyMessagesChatsChart data={dailyMessagesChats} />
                </div>

                <div className="rounded-lg border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Messages by Model (24h)</h3>
                  </div>
                  <MessagesByModelChart data={messagesByModel} />
                </div>
              </section>

              {/* Charts Row 2 */}
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-lg border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Weekly Active Users</h3>
                  </div>
                  <UserGrowthChart data={weeklyActiveUsers} />
                </div>

                <div className="rounded-lg border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Top Active Users</h3>
                  </div>
                  <TopUsersTable
                    data={topUsers}
                    isLoading={topUsersQuery.isLoading}
                    selectedRange={topUsersRange}
                    onRangeChange={setTopUsersRange}
                  />
                </div>
              </section>

              {/* Charts Row 3 */}
              <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-lg border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Peak Hours (Last 14 Days)</h3>
                  </div>
                  <HourlyActivityChart data={hourlyActivity} />
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
                sortField={sortField}
                sortOrder={sortOrder}
                onSearchChange={(search) => {
                  setUsersSearch(search)
                  setUsersPage(1)
                }}
                onPageChange={setUsersPage}
                onSortChange={handleSortChange}
                onToggleAdmin={(userId, isAdmin) => {
                  updateUserMutation.mutate({ userId, isAdmin })
                }}
                onTogglePro={(userId, isPro) => {
                  updateUserMutation.mutate({ userId, isPro })
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
                  filters={activityQuery.data?.filters}
                  filterState={activityFilters}
                  onFilterChange={(filters) => {
                    setActivityFilters(filters)
                    setActivityPage(1)
                  }}
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
