"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Pencil, X, ShieldAlert, Info, KeyRound, Sparkles } from "lucide-react";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  Field,
  Spinner,
  inputClass,
} from "@/components/ui/primitives";
import { SaveBar } from "@/components/ui/SaveBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetcher, postJson, ApiError } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/providers/ToastProvider";
import {
  AI_PROVIDERS,
  FALLBACK_BEHAVIORS,
  RESPONSE_STYLES,
  SUPPORTED_LANGUAGES,
  VERIFIED_GEMINI_MODELS,
} from "@/lib/constants";
import { aiConfigSchema, isVerifiedModel } from "@/lib/validation";

type AiConfig = {
  provider: "nvidia" | "gemini";
  apiEndpoint: string;
  backendUrl: string;
  apiKeyConfigured: boolean;
  apiKeySource: "env" | "database" | "none";
  apiKeyMasked: string;
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
  const [newApiKey, setNewApiKey] = useState("");
  const [customModelOverride, setCustomModelOverride] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const form = draft ?? data?.config ?? null;
  const customModel =
    customModelOverride ??
    (form ? !(VERIFIED_GEMINI_MODELS as readonly string[]).includes(form.selectedModel) : false);
  const setCustomModel = (value: boolean) => setCustomModelOverride(value);

  const dirty = useMemo(() => {
    if (!data?.config || !form) return false;
    return JSON.stringify(data.config) !== JSON.stringify(form) || newApiKey.trim().length > 0;
  }, [data, form, newApiKey]);

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
    update(
      "supportedLanguages",
      has ? form.supportedLanguages.filter((l) => l !== lang) : [...form.supportedLanguages, lang],
    );
  }

  function cancelEdit() {
    setDraft(null);
    setNewApiKey("");
    setCustomModelOverride(null);
    setFieldErrors({});
    setEditMode(false);
  }

  async function doSave() {
    if (!form) return;
    const payload = {
      ...form,
      ...(newApiKey.trim().length > 0 ? { apiKey: newApiKey.trim() } : {}),
    };
    const parsed = aiConfigSchema.safeParse(payload);
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
      const result = await postJson<{
        config: AiConfig;
        publish: { attempted: boolean; success: boolean; error?: string };
      }>("/api/config/ai", parsed.data, "PUT");
      await mutate({ config: result.config }, { revalidate: false });
      setDraft(null);
      setNewApiKey("");
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
      notify({
        kind: "error",
        title: "Save failed",
        description: err instanceof ApiError ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAiConnection() {
    setTesting(true);
    try {
      const res = await postJson<{
        ok: boolean;
        reply: string;
        model: string;
        usage: { totalTokens: number | null };
        latencyMs: number;
      }>("/api/ai/chat", {
        userPrompt: "Say a quick 1-sentence hello in Hinglish as Anjali!",
        requestType: "admin_connection_test",
      });
      notify({
        kind: "success",
        title: `Connected (${res.model} · ${res.latencyMs}ms)`,
        description: `${res.reply.slice(0, 140)}${
          res.usage.totalTokens !== null ? ` (${res.usage.totalTokens} tokens recorded)` : ""
        }`,
      });
    } catch (err) {
      notify({
        kind: "error",
        title: "AI connection test failed",
        description: err instanceof ApiError ? err.message : "Unable to reach AI provider",
      });
    } finally {
      setTesting(false);
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
          {form.publishedToFirestore ? (
            <Badge tone="success">Synced to Firestore</Badge>
          ) : (
            <Badge tone="warning">Not yet synced</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleTestAiConnection} loading={testing}>
            <Sparkles className="h-4 w-4" /> Test AI connection
          </Button>
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
      </div>

      <Card>
        <CardHeader
          title="Provider & model selection"
          description="Configure your NVIDIA AI endpoint, model identifier, and server-side API key"
        />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            {verified ? (
              <Badge tone="success">Verified model</Badge>
            ) : (
              <Badge tone="warning">Unverified — confirm compatibility with your endpoint</Badge>
            )}
            {form.apiKeyConfigured ? (
              <Badge tone="success">
                <KeyRound className="h-3 w-3" /> API Key Configured ({form.apiKeySource}: {form.apiKeyMasked})
              </Badge>
            ) : (
              <Badge tone="warning">
                <KeyRound className="h-3 w-3" /> Server API Key Missing (Set NVIDIA_API_KEY in Vercel or below)
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="AI Provider" error={fieldErrors.provider}>
              <select
                className={inputClass}
                disabled={!editMode}
                value={form.provider}
                onChange={(e) => update("provider", e.target.value as "nvidia" | "gemini")}
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Selected AI Model" error={fieldErrors.selectedModel}>
              {!customModel ? (
                <select
                  className={inputClass}
                  disabled={!editMode}
                  value={form.selectedModel}
                  onChange={(e) =>
                    e.target.value === "__custom__"
                      ? setCustomModel(true)
                      : update("selectedModel", e.target.value)
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
                    placeholder="e.g. google/gemma-4-31b-it"
                    onChange={(e) => update("selectedModel", e.target.value)}
                  />
                  <Button type="button" variant="secondary" onClick={() => setCustomModel(false)}>
                    Use list
                  </Button>
                </div>
              )}
            </Field>

            <Field
              label="API Endpoint"
              hint="Default NVIDIA endpoint: https://integrate.api.nvidia.com/v1/chat/completions"
              error={fieldErrors.apiEndpoint}
            >
              <input
                className={inputClass}
                disabled={!editMode}
                value={form.apiEndpoint}
                placeholder="https://integrate.api.nvidia.com/v1/chat/completions"
                onChange={(e) => update("apiEndpoint", e.target.value)}
              />
            </Field>

            <Field
              label="Server-side API Key (Write-only)"
              hint="Stored strictly on the server; leave blank to keep existing key"
              error={fieldErrors.apiKey}
            >
              <input
                type="password"
                autoComplete="new-password"
                className={inputClass}
                disabled={!editMode}
                value={newApiKey}
                placeholder={
                  form.apiKeyConfigured
                    ? `Current key active (${form.apiKeyMasked}) — enter new key to rotate`
                    : "Enter nvapi-... key (or set NVIDIA_API_KEY in Vercel)"
                }
                onChange={(e) => setNewApiKey(e.target.value)}
              />
            </Field>
          </div>

          {!verified && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              This model identifier is not in the default verified list. Confirm it is supported by
              your configured provider endpoint before publishing to production.
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
            <select
              className={inputClass}
              disabled={!editMode}
              value={form.responseStyle}
              onChange={(e) => update("responseStyle", e.target.value)}
            >
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
                      active
                        ? "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-500/40 dark:bg-pink-500/10 dark:text-pink-300"
                        : "border-app-border text-app-text-muted"
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
          <ToggleRow
            label="AI replies enabled"
            checked={form.aiEnabled}
            disabled={!editMode}
            onChange={(v) => update("aiEnabled", v)}
          />
          <ToggleRow
            label="Voice replies"
            checked={form.voiceRepliesEnabled}
            disabled={!editMode}
            onChange={(v) => update("voiceRepliesEnabled", v)}
          />
          <ToggleRow
            label="Proactive messages"
            checked={form.proactiveMessagesEnabled}
            disabled={!editMode}
            onChange={(v) => update("proactiveMessagesEnabled", v)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Fallback & limits"
          description="What happens when the AI service is unavailable, and request limits"
        />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Field label="Fallback behavior">
            <select
              className={inputClass}
              disabled={!editMode}
              value={form.fallbackBehavior}
              onChange={(e) => update("fallbackBehavior", e.target.value)}
            >
              {FALLBACK_BEHAVIORS.map((f) => (
                <option key={f} value={f}>
                  {f.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fallback message" error={fieldErrors.fallbackMessage}>
            <input
              className={inputClass}
              disabled={!editMode}
              value={form.fallbackMessage}
              onChange={(e) => update("fallbackMessage", e.target.value)}
            />
          </Field>
          <Field label="Per-user daily request limit" error={fieldErrors.perUserDailyLimit}>
            <input
              type="number"
              className={inputClass}
              disabled={!editMode}
              value={form.perUserDailyLimit}
              onChange={(e) => update("perUserDailyLimit", Number(e.target.value))}
            />
          </Field>
          <Field label="Global daily request threshold" error={fieldErrors.globalDailyLimit}>
            <input
              type="number"
              className={inputClass}
              disabled={!editMode}
              value={form.globalDailyLimit}
              onChange={(e) => update("globalDailyLimit", Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="flex items-start gap-2 border-t border-app-border p-4 text-xs text-app-text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Daily limits and provider settings are enforced automatically by the server-side{" "}
          <code className="rounded bg-app-bg-soft px-1">/api/ai/chat</code> endpoint and published
          live to Firestore (<code className="rounded bg-app-bg-soft px-1">app_config/ai</code>).
        </div>
      </Card>

      {editMode && (
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => setConfirmOpen(true)}
          onCancel={cancelEdit}
          lastUpdatedLabel={`Version ${form.version}`}
        />
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

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-app-border p-3">
      <span className="text-sm text-app-text">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-gradient-to-r from-pink-500 to-purple-500" : "bg-app-border"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
