"use client"

import type { TopUsersRange } from "@/lib/query/hooks"

interface TopUserData {
  name: string
  image?: string | null
  messageCount: number
  chatCount: number
}

interface TopUsersTableProps {
  data: TopUserData[]
  isLoading?: boolean
  selectedRange: TopUsersRange
  onRangeChange: (range: TopUsersRange) => void
}

const rangeOptions: { value: TopUsersRange; label: string }[] = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
]

export function TopUsersTable({ data, isLoading, selectedRange, onRangeChange }: TopUsersTableProps) {
  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex gap-2">
        {rangeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onRangeChange(option.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedRange === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-right font-medium">Messages</th>
                <th className="px-4 py-3 text-right font-medium">Conversations</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                      <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="ml-auto h-4 w-12 rounded bg-muted animate-pulse" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="ml-auto h-4 w-12 rounded bg-muted animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-muted-foreground">
          No user activity data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-right font-medium">Messages</th>
                <th className="px-4 py-3 text-right font-medium">Conversations</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user, index) => (
                <tr key={index} className="border-b last:border-b-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt=""
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {user.name[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{user.messageCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{user.chatCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
