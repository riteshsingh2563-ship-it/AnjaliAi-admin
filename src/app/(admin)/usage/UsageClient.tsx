"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Activity,
  AlertTriangle,
  Coins,
  Gauge,
  Info,
  RefreshCw,
  Users as UsersIcon,
} from "lucide-react";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  Spinner,
  EmptyState,
} from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/StatCard";
import { UsageChart } from "@/components/ui/UsageChart";
import { fetcher } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";

type UsageResponse = {
  rangeDays: number;
  ingestConfigured: boolean;
  firestoreSync?: {
    synced: number;
    available: boolean;
    reason?: string;
  };
  totals: {
    totalRequests: number;
    failedRequests: number;
    rateLimited: number;
    distinctUsers: number;
    totalTokens: number;
  };
  dailySeries: { day: string; requests: number; failures: number }[];
  recent: {
    id: number;
    timestamp: string;
    userId: string | null;
    requestType: string;
    status: string;
    tokensUsed: number | null;
    model: string | null;
    latencyMs: number | null;
  }[];
};

// Illustrative only — real NVIDIA / AI provider pricing varies by model and subscription.
const ILLUSTRATIVE_COST_PER_1K_TOKENS = 0.000263;

export function UsageClient() {
  const [days, setDays] = useState(14);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<UsageResponse>(
    `/api/usage?days=${days}`,
    fetcher,
    { refreshInterval: 30000 },
  );

  async function handleSyncFirestore() {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await fetcher<UsageResponse>(
        `/api/usage?days=${days}&sync=true`,
      );
      await mutate(res, false);
      if (res.firestoreSync?.available) {
        setSyncFeedback(
          res.firestoreSync.synced > 0
            ? `Successfully synced ${res.firestoreSync.synced} messages from Firestore!`
            : "Firestore check completed. All messages are up to date.",
        );
      } else {
        setSyncFeedback(
          res.firestoreSync?.reason ??
            "Firestore sync unavailable. Check server configuration.",
        );
      }
    } catch {
      setSyncFeedback("Sync request failed. Please check network connection.");
    } finally {
      setIsSyncing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (error || !data) {
    return (
      <Card className="p-6 text-sm text-app-text-muted">
        Failed to load usage data.
      </Card>
    );
  }

  const estimatedCost =
    (data.totals.totalTokens / 1000) * ILLUSTRATIVE_COST_PER_1K_TOKENS;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleSyncFirestore}
            disabled={isSyncing}
            className="flex items-center gap-1.5 text-xs py-1.5 px-3"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`}
            />
            {isSyncing ? "Syncing..." : "Sync App Chats"}
          </Button>
          {syncFeedback && (
            <span className="text-xs text-app-text-muted">{syncFeedback}</span>
          )}
        </div>

        <div className="flex gap-1 rounded-lg bg-app-bg-soft p-1 text-xs">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                days === d
                  ? "bg-app-surface text-app-text shadow-sm"
                  : "text-app-text-muted"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {data.firestoreSync && !data.firestoreSync.available && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                Historical App Chat Sync Requires Service Account
              </p>
              <p className="mt-1 leading-relaxed">
                To backfill chats previously sent in the Android application
                directly into this dashboard, set{" "}
                <code className="rounded bg-black/5 px-1 font-mono">
                  FIREBASE_SERVICE_ACCOUNT_KEY
                </code>{" "}
                in your Vercel Project Environment Variables. Live chats from
                updated APKs will automatically stream into this table via the
                ingest and chat endpoints.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total requests" value={data.totals.totalRequests} icon={<Activity className="h-5 w-5" />} />
        <StatCard
          label="Failed requests"
          value={data.totals.failedRequests}
          icon={<AlertTriangle className="h-5 w-5" />}
          footnote={data.totals.rateLimited > 0 ? <Badge tone="warning">{data.totals.rateLimited} rate-limited</Badge> : undefined}
        />
        <StatCard label="Distinct users" value={data.totals.distinctUsers} icon={<UsersIcon className="h-5 w-5" />} />
        <StatCard
          label="Estimated cost"
          value={data.totals.totalTokens > 0 ? `~$${estimatedCost.toFixed(4)}` : "—"}
          icon={<Coins className="h-5 w-5" />}
          footnote={
            data.totals.totalTokens > 0 ? (
              <span>Estimate only · {data.totals.totalTokens.toLocaleString()} tokens reported</span>
            ) : (
              "No token usage reported yet"
            )
          }
        />
      </div>

      <Card>
        <CardHeader title="Requests over time" description={`Last ${days} days of recorded AI usage events`} />
        <div className="p-5">
          <UsageChart data={data.dailySeries} />
        </div>
      </Card>

      {!data.ingestConfigured && (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Usage ingestion is not configured</p>
              <p className="mt-1 text-xs leading-relaxed">
                Set <code className="rounded bg-black/5 px-1">USAGE_INGEST_API_KEY</code> to enable{" "}
                <code className="rounded bg-black/5 px-1">POST /api/usage/ingest</code>. Have your backend
                (e.g. a Cloud Function sitting between the Android app and Gemini) report each AI
                request there so this page reflects real activity instead of staying empty.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Usage log" description="Most recent recorded events" />
        {data.recent.length === 0 ? (
          <EmptyState icon={<Gauge className="h-8 w-8" />} title="No usage events recorded yet" description="Events reported via the ingest API will appear here." />
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-app-border bg-app-bg-soft text-xs uppercase tracking-wide text-app-text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Model</th>
                  <th className="px-4 py-2.5 font-medium">Tokens</th>
                  <th className="px-4 py-2.5 font-medium">Latency</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {data.recent.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 text-xs text-app-text-muted">{formatDateTime(r.timestamp)}</td>
                    <td className="px-4 py-2.5 text-xs text-app-text-muted">{r.userId ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{r.requestType}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.model ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{r.tokensUsed ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{r.latencyMs ? `${r.latencyMs}ms` : "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.status === "success" ? "success" : r.status === "rate_limited" ? "warning" : "danger"}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-app-text-muted">
        Firebase AI Logic usage, direct Gemini API usage, and Google AI subscription benefits may be
        billed and rate-limited differently depending on your actual account configuration. Treat
        all cost figures here as rough estimates, not billing statements.
      </p>
    </div>
  );
}
