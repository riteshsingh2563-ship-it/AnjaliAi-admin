"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Pencil, X, Sparkles, Info } from "lucide-react";
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
import {
  CONVERSATION_TONES,
  RESPONSE_LENGTHS,
  RESPONSE_STYLES,
  SUPPORTED_LANGUAGES,
} from "@/lib/constants";
import { personalitySchema } from "@/lib/validation";

type PersonalityConfig = {
  characterName: string;
  shortDescription: string;
  personalityTraits: string[];
  conversationTone: string;
  greetingMessage: string;
  languagePreferences: string[];
  responseStyle: string;
  responseLength: string;
  emojiUsage: boolean;
  friendlySupportive: boolean;
  additionalInstructions: string;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
  publishedToFirestore: boolean;
  publishedAt: string | null;
};

export function PersonalityClient() {
  const { data, error, isLoading, mutate } = useSWR<{ config: PersonalityConfig }>(
    "/api/config/personality",
    fetcher,
  );
  const { notify } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<PersonalityConfig | null>(null);
  const [traitInput, setTraitInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  if (error) {
    return (
      <Card className="p-6 text-sm text-app-text-muted">Failed to load personality configuration.</Card>
    );
  }

  function update<K extends keyof PersonalityConfig>(key: K, value: PersonalityConfig[K]) {
    setDraft((prev) => {
      const base = prev ?? data?.config;
      return base ? { ...base, [key]: value } : null;
    });
  }

  function addTrait() {
    const t = traitInput.trim();
    if (!t || !form) return;
    if (form.personalityTraits.includes(t)) {
      setTraitInput("");
      return;
    }
    update("personalityTraits", [...form.personalityTraits, t]);
    setTraitInput("");
  }

  function toggleLanguage(lang: string) {
    if (!form) return;
    const has = form.languagePreferences.includes(lang);
    update(
      "languagePreferences",
      has ? form.languagePreferences.filter((l) => l !== lang) : [...form.languagePreferences, lang],
    );
  }

  function cancelEdit() {
    setDraft(null);
    setFieldErrors({});
    setEditMode(false);
  }

  async function doSave() {
    if (!form) return;
    const parsed = personalitySchema.safeParse(form);
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
      const result = await postJson<{ config: PersonalityConfig; publish: { attempted: boolean; success: boolean; error?: string } }>(
        "/api/config/personality",
        parsed.data,
        "PUT",
      );
      await mutate({ config: result.config }, { revalidate: false });
      setDraft(null);
      setEditMode(false);
      setConfirmOpen(false);
      notify({
        kind: "success",
        title: "Personality published",
        description: result.publish.attempted
          ? result.publish.success
            ? "Synced to Firestore for the Android app."
            : `Saved, but Firestore sync failed: ${result.publish.error}`
          : "Saved to the dashboard database. Firestore sync is not configured yet.",
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to save.";
      notify({ kind: "error", title: "Save failed", description: message });
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
          {form.publishedToFirestore ? (
            <Badge tone="success">Synced to Firestore</Badge>
          ) : (
            <Badge tone="warning">Not yet synced to Firestore</Badge>
          )}
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
            <CardHeader title="Character identity" description="Core identity shown in chat and used in prompts" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <Field label="Character name" error={fieldErrors.characterName}>
                <input
                  className={inputClass}
                  disabled={!editMode}
                  value={form.characterName}
                  onChange={(e) => update("characterName", e.target.value)}
                />
              </Field>
              <Field label="Conversation tone" error={fieldErrors.conversationTone}>
                <select
                  className={inputClass}
                  disabled={!editMode}
                  value={form.conversationTone}
                  onChange={(e) => update("conversationTone", e.target.value)}
                >
                  {CONVERSATION_TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Short description" error={fieldErrors.shortDescription}>
                  <textarea
                    className={textAreaClass}
                    disabled={!editMode}
                    value={form.shortDescription}
                    onChange={(e) => update("shortDescription", e.target.value)}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Greeting message" error={fieldErrors.greetingMessage}>
                  <input
                    className={inputClass}
                    disabled={!editMode}
                    value={form.greetingMessage}
                    onChange={(e) => update("greetingMessage", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Personality traits" description="Short keywords that shape Anjali's character" />
            <div className="p-5">
              <div className="mb-3 flex flex-wrap gap-2">
                {form.personalityTraits.map((trait) => (
                  <span
                    key={trait}
                    className="flex items-center gap-1 rounded-full bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700 dark:bg-pink-500/10 dark:text-pink-300"
                  >
                    {trait}
                    {editMode && (
                      <button
                        onClick={() => update("personalityTraits", form.personalityTraits.filter((t) => t !== trait))}
                        className="ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
                {form.personalityTraits.length === 0 && (
                  <span className="text-xs text-app-text-muted">No traits added yet.</span>
                )}
              </div>
              {editMode && (
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Add a trait, e.g. playful"
                    value={traitInput}
                    onChange={(e) => setTraitInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTrait();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addTrait}>
                    Add
                  </Button>
                </div>
              )}
              {fieldErrors.personalityTraits && (
                <p className="mt-1 text-xs text-rose-500">{fieldErrors.personalityTraits}</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Language & response style" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <Field label="Language preferences" error={fieldErrors.languagePreferences}>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const active = form.languagePreferences.includes(lang);
                    return (
                      <button
                        type="button"
                        key={lang}
                        disabled={!editMode}
                        onClick={() => toggleLanguage(lang)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-500/40 dark:bg-pink-500/10 dark:text-pink-300"
                            : "border-app-border text-app-text-muted"
                        } ${!editMode ? "opacity-70" : ""}`}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
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
              <Field label="Response length preference" error={fieldErrors.responseLength}>
                <select
                  className={inputClass}
                  disabled={!editMode}
                  value={form.responseLength}
                  onChange={(e) => update("responseLength", e.target.value)}
                >
                  {RESPONSE_LENGTHS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex items-center gap-6 pt-6">
                <ToggleField
                  label="Emoji usage"
                  checked={form.emojiUsage}
                  disabled={!editMode}
                  onChange={(v) => update("emojiUsage", v)}
                />
                <ToggleField
                  label="Friendly & supportive"
                  checked={form.friendlySupportive}
                  disabled={!editMode}
                  onChange={(v) => update("friendlySupportive", v)}
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="System instructions"
              description="Large free-form instructions sent to the AI model alongside the personality fields above"
            />
            <div className="p-5">
              <textarea
                className={textAreaClass + " min-h-[220px] font-mono text-xs"}
                disabled={!editMode}
                value={form.additionalInstructions}
                onChange={(e) => update("additionalInstructions", e.target.value)}
              />
              {fieldErrors.additionalInstructions && (
                <p className="mt-1 text-xs text-rose-500">{fieldErrors.additionalInstructions}</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className="sticky top-20">
            <CardHeader title="Live preview" description="How this configuration reads at a glance" />
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3 rounded-xl bg-app-bg-soft p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-500 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-app-text">{form.characterName || "—"}</p>
                  <p className="truncate text-xs text-app-text-muted">{form.conversationTone} · {form.responseStyle}</p>
                </div>
              </div>
              <div className="rounded-xl border border-app-border p-3 text-sm text-app-text">
                {form.greetingMessage || "No greeting set"}
              </div>
              <p className="text-xs leading-relaxed text-app-text-muted">{form.shortDescription}</p>
              <div className="flex flex-wrap gap-1.5">
                {form.languagePreferences.map((l) => (
                  <Badge key={l} tone="info">
                    {l}
                  </Badge>
                ))}
                {form.emojiUsage && <Badge tone="accent">Emoji on 💕</Badge>}
                <Badge tone="neutral">{form.responseLength} replies</Badge>
              </div>
            </div>
            <div className="flex items-start gap-2 border-t border-app-border p-4 text-xs text-app-text-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Publishing writes this configuration to the shared <code>app_config</code> Firestore
              documents the Android app reads. No APK update is required for these fields.
            </div>
          </Card>
        </div>
      </div>

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
        title="Publish personality changes?"
        description="This updates the live configuration used to prepare Anjali's AI requests and (if Firebase is configured) syncs to Firestore for the Android app."
        confirmLabel="Publish changes"
        loading={saving}
        onConfirm={doSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function ToggleField({
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
    <label className="flex items-center gap-2.5">
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
      <span className="text-sm text-app-text">{label}</span>
    </label>
  );
}
