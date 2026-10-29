"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { EmptyState } from "@/components/ui/primitives";
import { BarChart3 } from "lucide-react";

export function UsageChart({ data }: { data: { day: string; requests: number }[] }) {
  if (!data || data.length === 0 || data.every((d) => d.requests === 0)) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-8 w-8" />}
        title="No usage data recorded yet"
        description="This chart plots real AI request events only. Once the Android app (or its backend) reports usage via the ingest API, activity will appear here automatically."
      />
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ec4899" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="requests" stroke="#ec4899" strokeWidth={2} fill="url(#usageFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
