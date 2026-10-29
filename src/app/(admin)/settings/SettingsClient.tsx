"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Pencil, X, Wrench, Database, Info } from "lucide-react";
import { Card, CardHeader, Badge, Button, Field, Spinner, inputClass } from "@/components/ui/primitives";
import { SaveBar } from "@/components/ui/SaveBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetcher, postJson, ApiError } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/providers/ToastProvider";
import { SUPPORTED_LANGUAGES } from "@/lib/constants";
import { generalSettingsSchema } from "@/lib/validation";

type GeneralSettings = {
  appDisplayName: string;
  defaultLanguage: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  supportEmail: string;
  privacyPolicyUrl: string;
  chatHistoryEnabled: boolean;
  chatRetentionDays: number;
  dataExportEnabled: boolean;
  configurationVersion: number;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
  publishedToFirestore: boolean;
};

export function SettingsClient() {
  const { data, error, isLoading, mutate } = useSWR<{ config: GeneralSettings }>("/api/config/general", fetcher);
  const { notify } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<GeneralSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [maintenanceConfirmOpen, setMaintenanceConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const form = draft ?? data?.config ?? null;

  const dirty = useMemo(() => {
    if (!data?.config || !form) return false;
    return JSON.stringify(data.config) !== JSON.stringify(form);
  }, [data, form]);

  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (error) return <Card className="p-6 text-sm text-app-text-muted">Failed to load general settings.</Card>;

  function update<K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) {
    setDraft((prev) => {
      const base = prev ?? data?.config;
      return base ? { ...base, [key]: value } : null;
    });
  }

  function cancelEdit() {
    setDraft(null);
    setFieldErrors({});
    setEditMode(false);
  }

  function requestSave() {
    if (form && data?.config && form.maintenanceMode !== data.config.maintenanceMode) {
      setMaintenanceConfirmOpen(true);
    } else {
      setConfirmOpen(true);
    }
  }

  async function doSave() {
    if (!form) return;
    const parsed = generalSettingsSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setFieldErrors(errs);
      notify({ kind: "error", title: "Please fix the highlighted fields" });
      setConfirmOpen(false);
      setMaintenanceConfirmOpen(false);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const result = await postJson<{ config: GeneralSettings; publish: { attempted: boolean; success: boolean; error?: string } }>(
        "/api/config/general",
        parsed.data,
        "PUT",
      );
      await mutate({ config: result.config }, { revalidate: false });
      setDraft(null);
      setEditMode(false);
      setConfirmOpen(false);
      setMaintenanceConfirmOpen(false);
      notify({
        kind: "success",
        title: "Settings published",
        description: result.publish.attempted
          ? result.publish.success
            ? "Synced to Firestore for the Android app."
            : `Saved, but Firestore sync failed: ${result.publish.error}`
          : "Saved to the dashboard database. Firestore sync is not configured yet.",
      });
    } catch (err) {
      notify({ kind: "error", title: "Save failed", description: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-app-text-muted">
          <span>
            Last updated {formatDateTime(form.updatedAt)} {form.updatedBy && `by ${form.updatedBy}`}
          </span>
          {form.publishedToFirestore ? <Badge tone="success">Synced to Firestore</Badge> : <Badge tone="warning">Not yet synced</Badge>}
          <Badge tone="accent">Config v{form.configurationVersion}</Badge>
        </div>
        {!editMode ? (
          <Button onClick={() => setEditMode(true)}>
            <Pencil className="h-4 w-4" /> Edit settings
          </Button>
        ) : (
          <Button variant="secondary" onClick={cancelEdit}>
            <X className="h-4 w-4" /> Exit edit mode
          </Button>
        )}
      </div>

      <Card>
        <CardHeader title="App identity" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Field label="App display name" error={fieldErrors.appDisplayName}>
            <input className={inputClass} disabled={!editMode} value={form.appDisplayName} onChange={(e) => update("appDisplayName", e.target.value)} />
          </Field>
          <Field label="Default language">
            <select className={inputClass} disabled={!editMode} value={form.defaultLanguage} onChange={(e) => update("defaultLanguage", e.target.value)}>
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Support email" error={fieldErrors.supportEmail}>
            <input className={inputClass} disabled={!editMode} value={form.supportEmail} onChange={(e) => update("supportEmail", e.target.value)} placeholder="support@example.com" />
          </Field>
          <Field label="Privacy policy URL" error={fieldErrors.privacyPolicyUrl}>
            <input className={inputClass} disabled={!editMode} value={form.privacyPolicyUrl} onChange={(e) => update("privacyPolicyUrl", e.target.value)} placeholder="https://…" />
          </Field>
        </div>
      </Card>

      <Card className={form.maintenanceMode ? "border-rose-300 dark:border-rose-500/40" : undefined}>
        <CardHeader title="Maintenance mode" description="Predictably pauses chat for users without weakening authentication" />
        <div className="space-y-4 p-5">
          <label className="flex items-center justify-between rounded-xl border border-app-border p-3">
            <span className="flex items-center gap-2 text-sm text-app-text">
              <Wrench className="h-4 w-4" /> Enable maintenance mode
            </span>
            <button
              type="button"
              disabled={!editMode}
              onClick={() => update("maintenanceMode", !form.maintenanceMode)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.maintenanceMode ? "bg-rose-500" : "bg-app-border"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.maintenanceMode ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </label>
          <Field label="Maintenance message" error={fieldErrors.maintenanceMessage}>
            <input className={inputClass} disabled={!editMode} value={form.maintenanceMessage} onChange={(e) => update("maintenanceMessage", e.target.value)} />
          </Field>
          <div className="flex items-start gap-2 rounded-xl bg-app-bg-soft p-3 text-xs text-app-text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            When enabled, the Android app should show this message and pause new AI chat requests.
            Authentication and existing data remain fully protected — maintenance mode never
            disables login security.
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Chat history & data controls" description="Settings only — this panel never reads or exports private conversations" />
        <div className="space-y-4 p-5">
          <ToggleRow label="Chat history persistence enabled" checked={form.chatHistoryEnabled} disabled={!editMode} onChange={(v) => update("chatHistoryEnabled", v)} />
          <Field label="Chat retention period (days)" hint="How long messages are kept before the app's own deletion policy applies" error={fieldErrors.chatRetentionDays}>
            <input type="number" className={inputClass} disabled={!editMode} value={form.chatRetentionDays} onChange={(e) => update("chatRetentionDays", Number(e.target.value))} />
          </Field>
          <ToggleRow label="Allow users to export their own data" checked={form.dataExportEnabled} disabled={!editMode} onChange={(v) => update("dataExportEnabled", v)} />
          <div className="flex items-start gap-2 rounded-xl border border-app-border p-3 text-xs text-app-text-muted">
            <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Aggregate chat statistics (message counts, active conversations) require the Android
            app&apos;s chat collection schema to be connected to this dashboard. That integration is not
            yet wired up — see the Integration &amp; System Status page for the connection checklist.
          </div>
        </div>
      </Card>

      {editMode && (
        <SaveBar dirty={dirty} saving={saving} onSave={requestSave} onCancel={cancelEdit} lastUpdatedLabel={`Version ${form.version}`} />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Publish general settings?"
        description="This updates app-wide configuration read by the Android app."
        confirmLabel="Publish changes"
        loading={saving}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmDialog
        open={maintenanceConfirmOpen}
        title={form.maintenanceMode ? "Turn ON maintenance mode?" : "Turn OFF maintenance mode?"}
        description={
          form.maintenanceMode
            ? "Users will see the maintenance message and the app should pause new AI chat requests until this is turned off."
            : "The app will resume normal AI chat functionality for all users."
        }
        danger={form.maintenanceMode}
        confirmLabel="Confirm & publish"
        loading={saving}
        onConfirm={doSave}
        onCancel={() => setMaintenanceConfirmOpen(false)}
      />
    </div>
  );
}

function ToggleRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-app-border p-3">
      <span className="text-sm text-app-text">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-gradient-to-r from-pink-500 to-purple-500" : "bg-app-border"} ${disabled ? "opacity-60" : ""}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}
