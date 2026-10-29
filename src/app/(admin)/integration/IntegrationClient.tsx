"use client";

import useSWR from "swr";
import { CheckCircle2, XCircle, Database, Cloud, ShieldCheck, RefreshCw, Cpu } from "lucide-react";
import { Card, CardHeader, Badge, Button, Spinner } from "@/components/ui/primitives";
import { fetcher } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";

type PublishSectionState = {
  version: number;
  publishedToFirestore: boolean;
  publishedAt: string | null;
};

type IntegrationStatusResponse = {
  database: { configured: boolean; ok: boolean };
  adminSession: { configured: boolean };
  adminAllowlist: { activeAdmins: number };
  firebaseClient: { configured: boolean; projectId: string | null };
  firebaseAdmin: {
    configured: boolean;
    firestoreReachable: boolean | null;
    databaseId: string;
    sharedDocumentPath: string;
  };
  nvidiaAi?: {
    configured: boolean;
    endpoint: string;
    model: string;
  };
  storage: { configured: boolean };
  usageIngest: { configured: boolean };
  publishState: {
    personality: PublishSectionState;
    ai: PublishSectionState;
    customization: PublishSectionState;
    general: PublishSectionState;
  } | null;
};

export function IntegrationClient() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<IntegrationStatusResponse>(
    "/api/integration/status",
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return <Card className="p-6 text-sm text-app-text-muted">Failed to load system status.</Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => mutate()} loading={isValidating}>
          <RefreshCw className="h-4 w-4" /> Refresh status
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatusItem
          icon={<Database className="h-5 w-5" />}
          title="PostgreSQL Database (Neon + Drizzle)"
          ok={data.database.configured && data.database.ok}
          badge={data.database.ok ? "Connected" : data.database.configured ? "Unreachable" : "Missing DATABASE_URL"}
          detail={`Active authorized admins in allowlist: ${data.adminAllowlist.activeAdmins}`}
        />

        <StatusItem
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Admin Authentication & Session"
          ok={data.adminSession.configured && data.firebaseClient.configured}
          badge={
            data.adminSession.configured && data.firebaseClient.configured ? "Configured" : "Action required"
          }
          detail={`Firebase Project ID: ${data.firebaseClient.projectId ?? "Not set"}`}
        />

        <StatusItem
          icon={<Cloud className="h-5 w-5" />}
          title="Firebase Admin & Cloud Firestore"
          ok={Boolean(data.firebaseAdmin.configured && data.firebaseAdmin.firestoreReachable)}
          badge={
            !data.firebaseAdmin.configured
              ? "Missing Service Account"
              : data.firebaseAdmin.firestoreReachable
                ? "Firestore Live"
                : "Firestore Unreachable"
          }
          detail={`Database ID: ${data.firebaseAdmin.databaseId} • Document: ${data.firebaseAdmin.sharedDocumentPath}`}
        />

        <StatusItem
          icon={<Cpu className="h-5 w-5" />}
          title="NVIDIA AI Provider & Usage Tracking"
          ok={Boolean(data.nvidiaAi?.configured && data.usageIngest.configured)}
          badge={
            data.nvidiaAi?.configured
              ? "AI & Usage Active"
              : "Set NVIDIA_API_KEY"
          }
          detail={`Model: ${data.nvidiaAi?.model ?? "google/gemma-4-31b-it"} • Usage Ingest: ${
            data.usageIngest.configured ? "Active" : "Not configured"
          }`}
        />
      </div>

      {data.publishState && (
        <Card>
          <CardHeader
            title="Firestore Sync Status (app_config/ai)"
            description="Every save publishes a unified configuration document to app_config/ai in the shared Android Firestore database."
          />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Personality", data.publishState.personality],
                ["AI Configuration", data.publishState.ai],
                ["Customization", data.publishState.customization],
                ["General Settings", data.publishState.general],
              ] as const
            ).map(([label, state]) => (
              <div key={label} className="rounded-xl border border-app-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-app-text">{label}</span>
                  <Badge tone={state.publishedToFirestore ? "success" : "warning"}>
                    v{state.version}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-app-text-muted">
                  {state.publishedToFirestore
                    ? `Synced ${state.publishedAt ? formatDateTime(state.publishedAt) : "to Firestore"}`
                    : "Saved in PostgreSQL (pending Firestore sync)"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusItem({
  icon,
  title,
  ok,
  badge,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  ok: boolean;
  badge: string;
  detail: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-app-bg-soft p-2 text-pink-600 dark:text-pink-300">{icon}</div>
          <div>
            <h3 className="text-sm font-semibold text-app-text">{title}</h3>
            <p className="mt-1 text-xs text-app-text-muted">{detail}</p>
          </div>
        </div>
        <Badge tone={ok ? "success" : "warning"}>
          {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {badge}
        </Badge>
      </div>
    </Card>
  );
}
