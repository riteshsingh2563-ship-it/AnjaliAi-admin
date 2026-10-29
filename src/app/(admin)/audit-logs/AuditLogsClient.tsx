"use client";

import { useState } from "react";
import useSWR from "swr";
import { ScrollText, Search } from "lucide-react";
import { Card, Badge, Spinner, EmptyState, inputClass } from "@/components/ui/primitives";
import { fetcher } from "@/lib/fetcher";
import { formatDateTime, formatRelativeTime, ACTION_LABELS } from "@/lib/format";

type AuditLogRow = {
  id: number;
  timestamp: string;
  adminEmail: string;
  actionType: string;
  metadata: Record<string, unknown>;
  result: string;
};

type AuditLogsResponse = {
  logs: AuditLogRow[];
  total: number;
};

export function AuditLogsClient() {
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<"all" | "success" | "failure">("all");
  const { data, error, isLoading } = useSWR<AuditLogsResponse>("/api/audit-logs?limit=100", fetcher, {
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
    return <Card className="p-6 text-sm text-app-text-muted">Failed to load audit logs.</Card>;
  }

  const filtered = data.logs.filter((row) => {
    const matchesResult = resultFilter === "all" || row.result === resultFilter;
    const q = search.trim().toLowerCase();
    const label = (ACTION_LABELS[row.actionType] ?? row.actionType).toLowerCase();
    const matchesSearch =
      !q ||
      row.adminEmail.toLowerCase().includes(q) ||
      row.actionType.toLowerCase().includes(q) ||
      label.includes(q);
    return matchesResult && matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Filter by admin email or action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-app-bg-soft p-1 text-xs">
          {(["all", "success", "failure"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setResultFilter(r)}
              className={`rounded-md px-3 py-1.5 font-medium capitalize transition ${
                resultFilter === r ? "bg-app-surface text-app-text shadow-sm" : "text-app-text-muted"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <Badge tone="neutral">
          {filtered.length} shown of {data.total}
        </Badge>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="h-8 w-8" />}
            title="No audit events found"
            description="Sign-in events and configuration updates made by admins will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-app-border bg-app-bg-soft text-xs uppercase tracking-wide text-app-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Admin</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-xs text-app-text-muted" title={formatDateTime(log.timestamp)}>
                      <span className="block font-medium text-app-text">{formatRelativeTime(log.timestamp)}</span>
                      <span>{formatDateTime(log.timestamp)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-app-text">{log.adminEmail}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-medium text-app-text">
                        {ACTION_LABELS[log.actionType] ?? log.actionType}
                      </span>
                      <span className="block font-mono text-[11px] text-app-text-muted">{log.actionType}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-app-text-muted">
                      {log.metadata && Object.keys(log.metadata).length > 0
                        ? JSON.stringify(log.metadata)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={log.result === "success" ? "success" : "danger"}>{log.result}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
