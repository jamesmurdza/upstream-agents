"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface MessagesByModelData {
  model: string
  count: number
}

interface MessagesByModelChartProps {
  data: MessagesByModelData[]
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(250, 60%, 55%)",
  "hsl(180, 60%, 55%)",
  "hsl(30, 60%, 55%)",
  "hsl(330, 60%, 55%)",
  "hsl(90, 60%, 55%)",
]

export function MessagesByModelChart({ data }: MessagesByModelChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-muted-foreground">
        No model usage data available for the past 24 hours
      </div>
    )
  }

  const sortedData = [...data].sort((a, b) => b.count - a.count).slice(0, 10)

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
          />
          <YAxis
            type="category"
            dataKey="model"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            width={100}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
            labelStyle={{ color: "hsl(var(--popover-foreground))" }}
            formatter={(value: number, name: string, props) => [value, "Messages"]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
