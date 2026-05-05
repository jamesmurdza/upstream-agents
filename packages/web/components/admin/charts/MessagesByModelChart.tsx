"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#0088fe",
  "#00c49f",
  "#ff8042",
  "#a4de6c",
  "#d0ed57",
  "#83a6ed",
]

interface MessagesByModelChartProps {
  data: Array<Record<string, number | string>>
}

export function MessagesByModelChart({ data }: MessagesByModelChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No model usage data available for the past 24 hours
      </div>
    )
  }

  // Extract model names (all keys except "hour")
  const modelKeys = Array.from(
    new Set(data.flatMap((entry) => Object.keys(entry).filter((key) => key !== "hour")))
  )

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
            }}
            labelStyle={{ color: "hsl(var(--popover-foreground))" }}
          />
          <Legend />
          {modelKeys.map((model, index) => (
            <Line
              key={model}
              type="monotone"
              dataKey={model}
              name={model}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
