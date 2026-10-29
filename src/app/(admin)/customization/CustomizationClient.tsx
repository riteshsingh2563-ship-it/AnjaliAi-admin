"use client";

import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Pencil, X, UploadCloud, ImageOff } from "lucide-react";
import { Card, CardHeader, Badge, Button, Field, Spinner, inputClass } from "@/components/ui/primitives";
import { SaveBar } from "@/components/ui/SaveBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetcher, postJson, ApiError } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/providers/ToastProvider";
import { CHAT_THEMES, ALLOWED_IMAGE_TYPES, MAX_AVATAR_UPLOAD_BYTES } from "@/lib/constants";
import { customizationSchema } from "@/lib/validation";

type Customization = {
  displayName: string;
  avatarUrl: string;
  welcomeMessage: string;
  chatTheme: string;
  accentColor: string;
  backgroundColor: string;
  bannerEnabled: boolean;
  bannerText: string;
  showMoodTracker: boolean;
  showVoiceButton: boolean;
  showGallery: boolean;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
  publishedToFirestore: boolean;
};

export function CustomizationClient() {
  const { data, error, isLoading, mutate } = useSWR<{ config: Customization }>("/api/config/customization", fetcher);
  const { notify } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<Customization | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  if (error) return <Card className="p-6 text-sm text-app-text-muted">Failed to load customization settings.</Card>;

  function update<K extends keyof Customization>(key: K, value: Customization[K]) {
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

  async function handleFileSelected(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      notify({ kind: "error", title: "Unsupported file type", description: "Use PNG, JPEG or WEBP." });
      return;
    }
    if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
      notify({ kind: "error", title: "File too large", description: `Max size is ${MAX_AVATAR_UPLOAD_BYTES / 1024 / 1024}MB.` });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/config/customization/upload", { method: "POST", body: fd, credentials: "include" });
      const info = await res.json();
      if (!res.ok) throw new Error(info.error ?? "Upload failed");
      update("avatarUrl", info.url);
      notify({ kind: "success", title: "Avatar uploaded" });
    } catch (err) {
      notify({
        kind: "error",
        title: "Upload unavailable",
        description: err instanceof Error ? err.message : "Please paste a direct image URL instead.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function doSave() {
    if (!form) return;
    const parsed = customizationSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setFieldErrors(errs);
      notify({ kind: "error", title: "Please fix the highlighted fields" });
      setConfirmOpen(false);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const result = await postJson<{ config: Customization; publish: { attempted: boolean; success: boolean; error?: string } }>(
        "/api/config/customization",
        parsed.data,
        "PUT",
      );
      await mutate({ config: result.config }, { revalidate: false });
      setDraft(null);
      setEditMode(false);
      setConfirmOpen(false);
      notify({
        kind: "success",
        title: "Customization published",
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
        </div>
        {!editMode ? (
          <Button onClick={() => setEditMode(true)}>
            <Pencil className="h-4 w-4" /> Edit configuration
          </Button>
        ) : (
          <Button variant="secondary" onClick={cancelEdit}>
            <X className="h-4 w-4" /> Exit edit mode
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader title="Identity & avatar" />
            <div className="space-y-4 p-5">
              <Field label="Display name" error={fieldErrors.displayName}>
                <input className={inputClass} disabled={!editMode} value={form.displayName} onChange={(e) => update("displayName", e.target.value)} />
              </Field>
              <Field label="Welcome message" error={fieldErrors.welcomeMessage}>
                <input className={inputClass} disabled={!editMode} value={form.welcomeMessage} onChange={(e) => update("welcomeMessage", e.target.value)} />
              </Field>
              <Field label="Avatar image URL" error={fieldErrors.avatarUrl} hint="Paste a direct image URL, or upload a file (requires Firebase Storage configuration)">
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    disabled={!editMode}
                    placeholder="https://…"
                    value={form.avatarUrl}
                    onChange={(e) => update("avatarUrl", e.target.value)}
                  />
                  {editMode && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ALLOWED_IMAGE_TYPES.join(",")}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileSelected(f);
                          e.target.value = "";
                        }}
                      />
                      <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                        <UploadCloud className="h-4 w-4" /> Upload
                      </Button>
                    </>
                  )}
                </div>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Theme" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
              <Field label="Chat theme">
                <select className={inputClass} disabled={!editMode} value={form.chatTheme} onChange={(e) => update("chatTheme", e.target.value)}>
                  {CHAT_THEMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Accent color" error={fieldErrors.accentColor}>
                <div className="flex items-center gap-2">
                  <input type="color" disabled={!editMode} value={form.accentColor} onChange={(e) => update("accentColor", e.target.value)} className="h-10 w-10 rounded-lg border border-app-border" />
                  <input className={inputClass} disabled={!editMode} value={form.accentColor} onChange={(e) => update("accentColor", e.target.value)} />
                </div>
              </Field>
              <Field label="Background color" error={fieldErrors.backgroundColor}>
                <div className="flex items-center gap-2">
                  <input type="color" disabled={!editMode} value={form.backgroundColor} onChange={(e) => update("backgroundColor", e.target.value)} className="h-10 w-10 rounded-lg border border-app-border" />
                  <input className={inputClass} disabled={!editMode} value={form.backgroundColor} onChange={(e) => update("backgroundColor", e.target.value)} />
                </div>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Banner / announcement" />
            <div className="space-y-4 p-5">
              <ToggleRow label="Show in-app banner" checked={form.bannerEnabled} disabled={!editMode} onChange={(v) => update("bannerEnabled", v)} />
              <Field label="Banner text" error={fieldErrors.bannerText}>
                <input className={inputClass} disabled={!editMode || !form.bannerEnabled} value={form.bannerText} onChange={(e) => update("bannerText", e.target.value)} placeholder="e.g. New voice replies coming soon!" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Feature visibility" />
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
              <ToggleRow label="Mood tracker" checked={form.showMoodTracker} disabled={!editMode} onChange={(v) => update("showMoodTracker", v)} />
              <ToggleRow label="Voice button" checked={form.showVoiceButton} disabled={!editMode} onChange={(v) => update("showVoiceButton", v)} />
              <ToggleRow label="Gallery" checked={form.showGallery} disabled={!editMode} onChange={(v) => update("showGallery", v)} />
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="sticky top-20">
            <CardHeader title="Preview" description="Approximate chat header appearance" />
            <div className="p-5">
              <div
                className="overflow-hidden rounded-2xl border border-app-border"
                style={{ backgroundColor: form.backgroundColor }}
              >
                <div className="flex items-center gap-3 p-4" style={{ backgroundColor: form.accentColor }}>
                  {form.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.avatarUrl} alt="" className="h-10 w-10 rounded-full border-2 border-white/60 object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30 text-white">
                      <ImageOff className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">{form.displayName || "Anjali"}</p>
                    <p className="text-xs text-white/80">online</p>
                  </div>
                </div>
                {form.bannerEnabled && form.bannerText && (
                  <div className="bg-black/5 px-4 py-2 text-xs text-app-text">{form.bannerText}</div>
                )}
                <div className="space-y-2 p-4">
                  <div className="inline-block max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-xs text-slate-700 shadow-sm">
                    {form.welcomeMessage || "Hey! Kaise ho?"}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-app-text-muted">
                Theme: {form.chatTheme} · Mood tracker {form.showMoodTracker ? "on" : "off"} · Voice {form.showVoiceButton ? "on" : "off"} · Gallery {form.showGallery ? "on" : "off"}
              </p>
            </div>
          </Card>
        </div>
      </div>

      {editMode && (
        <SaveBar dirty={dirty} saving={saving} onSave={() => setConfirmOpen(true)} onCancel={cancelEdit} lastUpdatedLabel={`Version ${form.version}`} />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Publish customization changes?"
        description="This updates branding, theme and feature visibility used by the Android app."
        confirmLabel="Publish changes"
        loading={saving}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
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
