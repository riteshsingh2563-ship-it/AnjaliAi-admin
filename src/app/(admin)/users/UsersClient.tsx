"use client";

import { useState } from "react";
import useSWR from "swr";
import { Search, UserX, UserCheck, Users as UsersIcon, ShieldOff } from "lucide-react";
import { Card, Badge, Button, Spinner, EmptyState, inputClass } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetcher, postJson, ApiError } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/providers/ToastProvider";
import type { DirectoryUser } from "@/app/api/users/route";

type UsersResponse = {
  configured: boolean;
  users: DirectoryUser[];
  total?: number;
  message?: string;
};

export function UsersClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all");
  const [pendingAction, setPendingAction] = useState<DirectoryUser | null>(null);
  const [acting, setActing] = useState(false);
  const { notify } = useToast();

  const query = new URLSearchParams();
  if (search) query.set("q", search);
  if (status !== "all") query.set("status", status);

  const { data, error, isLoading, mutate } = useSWR<UsersResponse>(`/api/users?${query.toString()}`, fetcher);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (error) return <Card className="p-6 text-sm text-app-text-muted">Failed to load users.</Card>;
  if (!data) return null;

  if (!data.configured) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldOff className="h-8 w-8" />}
          title="Firebase Authentication is not connected"
          description={
            data.message ??
            "Configure FIREBASE_SERVICE_ACCOUNT_KEY so the dashboard can securely list real Android app accounts. No user data is fabricated here."
          }
        />
      </Card>
    );
  }

  async function updateStatus(user: DirectoryUser, disabled: boolean) {
    setActing(true);
    try {
      await postJson(`/api/users/${user.uid}`, { disabled }, "PATCH");
      await mutate();
      notify({ kind: "success", title: disabled ? "Account restricted" : "Account restored" });
    } catch (err) {
      notify({ kind: "error", title: "Action failed", description: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setActing(false);
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search by name, email, or UID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-app-bg-soft p-1 text-xs">
          {(["all", "active", "disabled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-md px-3 py-1.5 font-medium capitalize transition ${status === s ? "bg-app-surface text-app-text shadow-sm" : "text-app-text-muted"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <Badge tone="neutral">{data.users.length} shown{typeof data.total === "number" ? ` of ${data.total}` : ""}</Badge>
      </div>

      <Card className="overflow-hidden">
        {data.users.length === 0 ? (
          <EmptyState icon={<UsersIcon className="h-8 w-8" />} title="No users found" description="Try a different search or filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-app-border bg-app-bg-soft text-xs uppercase tracking-wide text-app-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Last active</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {data.users.map((u) => (
                  <tr key={u.uid}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-app-text">{u.displayName || "—"}</p>
                      <p className="text-xs text-app-text-muted">{u.email || u.uid}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-app-text-muted">{u.createdAt ? formatDateTime(u.createdAt) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-app-text-muted">{u.lastSignInAt ? formatDateTime(u.lastSignInAt) : "Never"}</td>
                    <td className="px-4 py-3">
                      {u.disabled ? <Badge tone="danger">Restricted</Badge> : <Badge tone="success">Active</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant={u.disabled ? "secondary" : "danger"} onClick={() => setPendingAction(u)}>
                        {u.disabled ? (
                          <>
                            <UserCheck className="h-4 w-4" /> Restore
                          </>
                        ) : (
                          <>
                            <UserX className="h-4 w-4" /> Restrict
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.disabled ? "Restore this account?" : "Restrict this account?"}
        description={
          pendingAction?.disabled
            ? `${pendingAction?.email ?? pendingAction?.uid} will regain access to sign in to ANJALI.`
            : `${pendingAction?.email ?? pendingAction?.uid} will be prevented from signing in to ANJALI immediately.`
        }
        danger={!pendingAction?.disabled}
        confirmLabel={pendingAction?.disabled ? "Restore account" : "Restrict account"}
        loading={acting}
        onConfirm={() => pendingAction && updateStatus(pendingAction, !pendingAction.disabled)}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
