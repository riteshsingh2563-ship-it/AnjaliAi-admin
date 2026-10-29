"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Users,
  MessagesSquare,
  Cpu,
  ShieldAlert,
  Activity,
  Wrench,
  Clock,
} from "lucide-react";
import { Card, CardHeader, Badge, Spinner, EmptyState } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/StatCard";
import { UsageChart } from "@/components/ui/UsageChart";
import { fetcher } from "@/lib/fetcher";
import { formatRelativeTime, formatDateTime, ACTION_LABELS } from "@/lib/format";

type Overview = {
  adminCount: number;
  androidUserCount: number | null;
  androidUsersConfigured: boolean;
  usage: { totalRequests: number; requests24h: number; failures: number; successRate: number | null };
  dailySeries: { day: string; requests: number }[];
  aiModel: { selectedModel: string; verified: boolean };
  maintenanceMode: boolean;
  configurationVersion: number;
  recentActivity: { id: number; timestamp: string; adminEmail: string; actionType: string; result: string }[];
};

export function DashboardClient() {
  const [days, setDays] = useState(14);
  const { data, error, isLoading } = useSWR<Overview>(`/api/dashboard/overview?days=${days}`, fetcher, {
    refreshInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <EmptyState title="Could not load dashboard data" description="Please refresh the page or check server logs." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Android app users"
          value={data.androidUsersConfigured ? data.androidUserCount ?? "—" : "Not connected"}
          icon={<Users className="h-5 w-5" />}
          footnote={
            data.androidUsersConfigured ? (
              "Live from Firebase Authentication"
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Connect Firebase Admin to track users</span>
            )
          }
        />
        <StatCard
          label={`AI requests (${days}d)`}
          value={data.usage.totalRequests}
          icon={<MessagesSquare className="h-5 w-5" />}
          footnote={
            data.usage.totalRequests > 0
              ? `${data.usage.requests24h} in the last 24h · ${data.usage.successRate}% success`
              : "No usage events recorded yet"
          }
        />
        <StatCard
          label="Current AI model"
          value={<span className="font-mono text-base">{data.aiModel.selectedModel}</span>}
          icon={<Cpu className="h-5 w-5" />}
          footnote={
            data.aiModel.verified ? (
              <Badge tone="success">Verified configuration</Badge>
            ) : (
              <Badge tone="warning">Unverified — confirm with your AI integration</Badge>
            )
          }
        />
        <StatCard
          label="Maintenance mode"
          value={data.maintenanceMode ? "ON" : "OFF"}
          icon={data.maintenanceMode ? <Wrench className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
          footnote={
            data.maintenanceMode ? (
              <Badge tone="danger">App is in maintenance mode</Badge>
            ) : (
              <Badge tone="success">App is live</Badge>
            )
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="AI usage over time"
            description="Based on real events reported to the usage ingest API"
            action={
              <div className="flex gap-1 rounded-lg bg-app-bg-soft p-1 text-xs">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      days === d ? "bg-app-surface text-app-text shadow-sm" : "text-app-text-muted"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            }
          />
          <div className="p-5">
            <UsageChart data={data.dailySeries} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent admin activity" description="Latest actions from the audit log" />
          <div className="max-h-80 divide-y divide-app-border overflow-y-auto scrollbar-thin">
            {data.recentActivity.length === 0 ? (
              <EmptyState
                icon={<Clock className="h-7 w-7" />}
                title="No activity yet"
                description="Configuration changes made by admins will show up here."
              />
            ) : (
              data.recentActivity.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <div
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${log.result === "success" ? "bg-emerald-500" : "bg-rose-500"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-app-text">
                      {ACTION_LABELS[log.actionType] ?? log.actionType}
                    </p>
                    <p className="truncate text-xs text-app-text-muted">{log.adminEmail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-app-text-muted" title={formatDateTime(log.timestamp)}>
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-app-text">Configuration version</p>
            <p className="text-xs text-app-text-muted">
              Increments every time published configuration changes across any settings page.
            </p>
          </div>
          <Badge tone="accent">v{data.configurationVersion}</Badge>
        </div>
      </Card>
    </div>
  );
}
