"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Pencil, X, ShieldAlert, Info } from "lucide-react";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  Field,
  Spinner,
  inputClass,
  textAreaClass,
} from "@/components/ui/primitives";
import { SaveBar } from "@/components/ui/SaveBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetcher, postJson, ApiError } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/providers/ToastProvider";
import { FALLBACK_BEHAVIORS, RESPONSE_STYLES, SUPPORTED_LANGUAGES, VERIFIED_GEMINI_MODELS } from "@/lib/constants";
import { aiConfigSchema, isVerifiedModel } from "@/lib/validation";

type AiConfig = {
  selectedModel: string;
  modelVerified: boolean;
  temperature: number;
  maxOutputTokens: number;
  supportedLanguages: string[];
  responseStyle: string;
  aiEnabled: boolean;
  voiceRepliesEnabled: boolean;
  proactiveMessagesEnabled: boolean;
  fallbackBehavior: string;
  fallbackMessage: string;
  perUserDailyLimit: number;
  globalDailyLimit: number;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
  publishedToFirestore: boolean;
};

export function AiConfigClient() {
  const { data, error, isLoading, mutate } = useSWR<{ config: AiConfig }>("/api/config/ai", fetcher);
  const { notify } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<AiConfig | null>(null);
  const [customModelOverride, setCustomModelOverride] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const form = draft ?? data?.config ?? null;
  const customModel =
    customModelOverride ??
    (form ? !(VERIFIED_GEMINI_MODELS as readonly string[]).includes(form.selectedModel) : false);
  const setCustomModel = (value: boolean) => setCustomModelOverride(value);

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
  if (error) return <Card className="p-6 text-sm text-app-text-muted">Failed to load AI configuration.</Card>;

  function update<K extends keyof AiConfig>(key: K, value: AiConfig[K]) {
    setDraft((prev) => {
      const base = prev ?? data?.config;
      return base ? { ...base, [key]: value } : null;
    });
  }

  function toggleLanguage(lang: string) {
    if (!form) return;
    const has = form.supportedLanguages.includes(lang);
    update("supportedLanguages", has ? form.supportedLanguages.filter((l) => l !== lang) : [...form.supportedLanguages, lang]);
  }

  function cancelEdit() {
    setDraft(null);
    setCustomModelOverride(null);
    setFieldErrors({});
    setEditMode(false);
  }

  async function doSave() {
    if (!form) return;
    const parsed = aiConfigSchema.safeParse(form);
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
      const result = await postJson<{ config: AiConfig; publish: { attempted: boolean; success: boolean; error?: string } }>(
        "/api/config/ai",
        parsed.data,
        "PUT",
      );
      await mutate({ config: result.config }, { revalidate: false });
      setDraft(null);
      setCustomModelOverride(null);
      setEditMode(false);
      setConfirmOpen(false);
      notify({
        kind: "success",
        title: "AI configuration published",
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

  const verified = isVerifiedModel(form.selectedModel);

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

      <Card>
        <CardHeader title="Model selection" description="Only switch to models your integration has verified" />
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            {verified ? <Badge tone="success">Verified model</Badge> : <Badge tone="warning">Unverified — not confirmed to work with your integration</Badge>}
          </div>
          <Field label="Selected Gemini model">
            {!customModel ? (
              <select
                className={inputClass}
                disabled={!editMode}
                value={form.selectedModel}
                onChange={(e) =>
                  e.target.value === "__custom__" ? setCustomModel(true) : update("selectedModel", e.target.value)
                }
              >
                {VERIFIED_GEMINI_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {!(VERIFIED_GEMINI_MODELS as readonly string[]).includes(form.selectedModel) && (
                  <option value={form.selectedModel}>{form.selectedModel} (custom)</option>
                )}
                <option value="__custom__">Enter custom model id…</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  disabled={!editMode}
                  value={form.selectedModel}
                  placeholder="e.g. gemini-2.5-flash"
                  onChange={(e) => update("selectedModel", e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={() => setCustomModel(false)}>
                  Use list
                </Button>
              </div>
            )}
          </Field>
          {!verified && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              This model identifier has not been verified against your actual Firebase AI Logic /
              Gemini integration. Confirm it is supported before publishing to production.
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Response behaviour" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Field label={`Temperature (${form.temperature.toFixed(2)})`} hint="0 = focused, 2 = very creative">
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              disabled={!editMode}
              value={form.temperature}
              onChange={(e) => update("temperature", Number(e.target.value))}
              className="w-full accent-pink-500"
            />
          </Field>
          <Field label="Maximum response length (tokens)" error={fieldErrors.maxOutputTokens}>
            <input
              type="number"
              className={inputClass}
              disabled={!editMode}
              value={form.maxOutputTokens}
              onChange={(e) => update("maxOutputTokens", Number(e.target.value))}
            />
          </Field>
          <Field label="Response style" error={fieldErrors.responseStyle}>
            <select className={inputClass} disabled={!editMode} value={form.responseStyle} onChange={(e) => update("responseStyle", e.target.value)}>
              {RESPONSE_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supported languages" error={fieldErrors.supportedLanguages}>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const active = form.supportedLanguages.includes(lang);
                return (
                  <button
                    type="button"
                    key={lang}
                    disabled={!editMode}
                    onClick={() => toggleLanguage(lang)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      active ? "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-500/40 dark:bg-pink-500/10 dark:text-pink-300" : "border-app-border text-app-text-muted"
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Feature flags" description="Enable/disable AI features without releasing a new APK" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <ToggleRow label="AI replies enabled" checked={form.aiEnabled} disabled={!editMode} onChange={(v) => update("aiEnabled", v)} />
          <ToggleRow label="Voice replies" checked={form.voiceRepliesEnabled} disabled={!editMode} onChange={(v) => update("voiceRepliesEnabled", v)} />
          <ToggleRow label="Proactive messages" checked={form.proactiveMessagesEnabled} disabled={!editMode} onChange={(v) => update("proactiveMessagesEnabled", v)} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Fallback & limits" description="What happens when the AI service is unavailable, and request limits" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Field label="Fallback behavior">
            <select className={inputClass} disabled={!editMode} value={form.fallbackBehavior} onChange={(e) => update("fallbackBehavior", e.target.value)}>
              {FALLBACK_BEHAVIORS.map((f) => (
                <option key={f} value={f}>
                  {f.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fallback message" error={fieldErrors.fallbackMessage}>
            <input className={inputClass} disabled={!editMode} value={form.fallbackMessage} onChange={(e) => update("fallbackMessage", e.target.value)} />
          </Field>
          <Field label="Per-user daily request limit" error={fieldErrors.perUserDailyLimit}>
            <input type="number" className={inputClass} disabled={!editMode} value={form.perUserDailyLimit} onChange={(e) => update("perUserDailyLimit", Number(e.target.value))} />
          </Field>
          <Field label="Global daily request threshold" error={fieldErrors.globalDailyLimit}>
            <input type="number" className={inputClass} disabled={!editMode} value={form.globalDailyLimit} onChange={(e) => update("globalDailyLimit", Number(e.target.value))} />
          </Field>
        </div>
        <div className="flex items-start gap-2 border-t border-app-border p-4 text-xs text-app-text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          These thresholds are published for the backend serving AI requests to enforce. This
          dashboard does not itself execute AI calls, so enforcement depends on your backend
          honoring the published configuration.
        </div>
      </Card>

      {editMode && (
        <SaveBar dirty={dirty} saving={saving} onSave={() => setConfirmOpen(true)} onCancel={cancelEdit} lastUpdatedLabel={`Version ${form.version}`} />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Publish AI configuration changes?"
        description={
          !verified
            ? "You are about to publish an unverified model identifier. Make sure your AI integration actually supports it before continuing."
            : "This updates the live AI configuration used to prepare Anjali's responses."
        }
        confirmLabel="Publish changes"
        danger={!verified}
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
