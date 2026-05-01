"use client"

interface TopUserData {
  name: string
  image?: string | null
  messageCount: number
  chatCount: number
}

interface TopUsersTableProps {
  data: TopUserData[]
}

export function TopUsersTable({ data }: TopUsersTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground">
        No user activity data available
      </div>
    )
  }

  return (
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
  )
}
