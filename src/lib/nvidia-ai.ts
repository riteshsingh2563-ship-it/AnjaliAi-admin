import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/init";
import { usageLogs } from "@/db/schema";
import {
  getAiConfig,
  getGeneralSettings,
  getPersonalityConfig,
  resolveServerNvidiaApiKey,
} from "@/lib/config-service";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { DEFAULT_NVIDIA_API_ENDPOINT } from "@/lib/env";

export type UsageEventInput = {
  userId?: string | null;
  requestType?: string;
  status: "success" | "failure" | "rate_limited";
  tokensUsed?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  model?: string | null;
  provider?: string | null;
  latencyMs?: number | null;
  requestId?: string | null;
  errorMessage?: string | null;
  source?: string;
  timestamp?: Date;
};

export function sanitizeErrorMessage(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw ?? "Unknown error");
  // Redact any Bearer tokens or API keys that might appear in error strings
  return text
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
    .replace(/nvapi-[A-Za-z0-9._\-]+/gi, "nvapi-[REDACTED]")
    .slice(0, 300);
}

/**
 * Records a real AI usage event in Neon PostgreSQL `usage_logs`.
 * Uses `request_id` deduplication when provided so retries or dual reporting
 * paths never double-count the same request.
 */
export async function recordUsageEvent(event: UsageEventInput): Promise<void> {
  await ensureDatabaseSchema();

  const cleanRequestId =
    typeof event.requestId === "string" && event.requestId.trim().length > 0
      ? event.requestId.trim().slice(0, 160)
      : null;

  const values = {
    timestamp: event.timestamp ?? new Date(),
    userId: event.userId ? event.userId.slice(0, 200) : null,
    requestType: (event.requestType || "chat_message").slice(0, 60),
    status: event.status,
    tokensUsed:
      typeof event.tokensUsed === "number" && Number.isFinite(event.tokensUsed)
        ? Math.max(0, Math.round(event.tokensUsed))
        : null,
    promptTokens:
      typeof event.promptTokens === "number" && Number.isFinite(event.promptTokens)
        ? Math.max(0, Math.round(event.promptTokens))
        : null,
    completionTokens:
      typeof event.completionTokens === "number" && Number.isFinite(event.completionTokens)
        ? Math.max(0, Math.round(event.completionTokens))
        : null,
    model: event.model ? event.model.slice(0, 120) : null,
    provider: event.provider ? event.provider.slice(0, 40) : "nvidia",
    latencyMs:
      typeof event.latencyMs === "number" && Number.isFinite(event.latencyMs)
        ? Math.max(0, Math.round(event.latencyMs))
        : null,
    requestId: cleanRequestId,
    errorMessage: event.errorMessage ? sanitizeErrorMessage(event.errorMessage) : null,
    source: (event.source || "ingest_api").slice(0, 60),
  };

  if (cleanRequestId) {
    await db
      .insert(usageLogs)
      .values(values)
      .onConflictDoNothing({ target: usageLogs.requestId });
  } else {
    await db.insert(usageLogs).values(values);
  }
}

const globalForUsageSync = globalThis as typeof globalThis & {
  __anjaliLastFirestoreUsageSyncMs?: number;
};

export type FirestoreUsageSyncResult = {
  synced: number;
  available: boolean;
  reason?: string;
};

/**
 * Syncs real AI replies (`sender == "anjali"`) stored in Cloud Firestore
 * (`users/{uid}/conversations/{cid}/messages/{mid}`) into `usage_logs` using
 * deterministic `request_id = "firestore_msg_" + mid`.
 *
 * This ensures that historical chats and chats from already-installed Android
 * APKs that write messages to Firestore are accurately counted without
 * inventing fake metrics or double-counting.
 */
export async function syncFirestoreUsageIfNeeded(
  force = false,
): Promise<FirestoreUsageSyncResult> {
  const now = Date.now();
  if (
    !force &&
    globalForUsageSync.__anjaliLastFirestoreUsageSyncMs &&
    now - globalForUsageSync.__anjaliLastFirestoreUsageSyncMs < 20_000
  ) {
    return { synced: 0, available: true, reason: "debounced" };
  }
  globalForUsageSync.__anjaliLastFirestoreUsageSyncMs = now;

  const admin = getFirebaseAdmin();
  if (!admin) {
    return {
      synced: 0,
      available: false,
      reason: "FIREBASE_SERVICE_ACCOUNT_KEY is not configured on the server.",
    };
  }

  try {
    await ensureDatabaseSchema();
    const ai = await getAiConfig();
    const defaultModel = ai.selectedModel || "google/gemma-4-31b-it";

    let messageDocs: Array<{ id: string; data: Record<string, any> }> = [];

    // 1. Try single efficient collectionGroup query across all users' messages
    try {
      const groupSnap = await admin.firestore
        .collectionGroup("messages")
        .limit(500)
        .get();

      messageDocs = groupSnap.docs.map((d) => ({
        id: d.id,
        data: d.data() as Record<string, any>,
      }));
    } catch (groupError) {
      console.warn(
        "[usage-sync] collectionGroup query failed, attempting per-user fallback:",
        groupError,
      );
    }

    // 2. Fallback: query per user if collectionGroup returned 0 or failed
    if (messageDocs.length === 0) {
      try {
        const usersSnap = await admin.firestore
          .collection("users")
          .limit(50)
          .get();
        for (const uDoc of usersSnap.docs) {
          const convSnap = await uDoc.ref
            .collection("conversations")
            .limit(20)
            .get();
          for (const cDoc of convSnap.docs) {
            const mSnap = await cDoc.ref
              .collection("messages")
              .limit(100)
              .get();
            for (const mDoc of mSnap.docs) {
              messageDocs.push({
                id: mDoc.id,
                data: mDoc.data() as Record<string, any>,
              });
            }
          }
        }
      } catch (userWalkError) {
        console.warn("[usage-sync] Per-user fallback failed:", userWalkError);
      }
    }

    let syncedCount = 0;
    for (const msg of messageDocs) {
      const data = msg.data;
      if (data.sender !== "anjali") continue;

      const createdAtRaw = data.createdAt;
      let ts = new Date();
      if (createdAtRaw && typeof createdAtRaw.toDate === "function") {
        ts = createdAtRaw.toDate();
      } else if (createdAtRaw instanceof Date) {
        ts = createdAtRaw;
      }

      await recordUsageEvent({
        userId: typeof data.userId === "string" ? data.userId : null,
        requestType: "chat_message",
        status: "success",
        tokensUsed: null, // Firestore chat docs do not store token counts; keep honest null
        model: defaultModel,
        provider: ai.provider || "nvidia",
        latencyMs: null,
        requestId: `firestore_msg_${msg.id}`,
        source: "firestore_sync",
        timestamp: ts,
      });
      syncedCount++;
    }

    return { synced: syncedCount, available: true };
  } catch (error) {
    const sanitized = sanitizeErrorMessage(error);
    console.warn("[usage-sync] Firestore usage sync skipped:", sanitized);
    return { synced: 0, available: false, reason: sanitized };
  }
}

export type NvidiaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type NvidiaChatCompletionResult = {
  reply: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  latencyMs: number;
  requestId: string;
};

export class AiProviderError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 502, code = "provider_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const FALLBACK_NVIDIA_MODELS = [
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "nemotron-3.5-lightning-30b-a3b",
  "google/gemma-4-31b-it",
];

/**
 * Executes a real chat completion against the configured NVIDIA AI API
 * (`https://integrate.api.nvidia.com/v1/chat/completions`), enforces
 * daily rate limits, extracts real provider-reported token usage, and
 * records the outcome in `usage_logs`.
 */
export async function executeServerNvidiaChatCompletion(params: {
  userId?: string | null;
  messages?: NvidiaChatMessage[];
  systemPrompt?: string;
  userPrompt?: string;
  modelOverride?: string;
  temperatureOverride?: number;
  maxTokensOverride?: number;
  requestType?: string;
  requestId?: string;
}): Promise<NvidiaChatCompletionResult> {
  await ensureDatabaseSchema();
  const startMs = Date.now();
  const requestId =
    params.requestId?.trim() ||
    `srv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const requestType = params.requestType || "chat_message";

  const [ai, personality, general] = await Promise.all([
    getAiConfig(),
    getPersonalityConfig(),
    getGeneralSettings(),
  ]);

  if (general.maintenanceMode) {
    throw new AiProviderError(general.maintenanceMessage, 503, "maintenance_mode");
  }

  if (!ai.aiEnabled) {
    throw new AiProviderError(ai.fallbackMessage, 503, "ai_disabled");
  }

  // Enforce global and per-user daily limits from actual usage_logs
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ count: global24h }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usageLogs)
    .where(gte(usageLogs.timestamp, since24h));

  if (global24h >= ai.globalDailyLimit) {
    await recordUsageEvent({
      userId: params.userId,
      requestType,
      status: "rate_limited",
      model: ai.selectedModel,
      provider: ai.provider,
      latencyMs: Date.now() - startMs,
      requestId,
      errorMessage: "Global daily request limit reached",
      source: "backend_ai_chat",
    });
    throw new AiProviderError(ai.fallbackMessage, 429, "global_rate_limit");
  }

  if (params.userId) {
    const [{ count: user24h }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usageLogs)
      .where(
        and(
          gte(usageLogs.timestamp, since24h),
          eq(usageLogs.userId, params.userId),
        ),
      );

    if (user24h >= ai.perUserDailyLimit) {
      await recordUsageEvent({
        userId: params.userId,
        requestType,
        status: "rate_limited",
        model: ai.selectedModel,
        provider: ai.provider,
        latencyMs: Date.now() - startMs,
        requestId,
        errorMessage: "Per-user daily request limit reached",
        source: "backend_ai_chat",
      });
      throw new AiProviderError(
        "Daily chat limit reached. Please try again tomorrow!",
        429,
        "user_rate_limit",
      );
    }
  }

  const resolvedKey = await resolveServerNvidiaApiKey(ai);
  if (!resolvedKey.key) {
    await recordUsageEvent({
      userId: params.userId,
      requestType,
      status: "failure",
      model: ai.selectedModel,
      provider: ai.provider,
      latencyMs: Date.now() - startMs,
      requestId,
      errorMessage: "NVIDIA_API_KEY is not configured on the server",
      source: "backend_ai_chat",
    });
    throw new AiProviderError(
      "NVIDIA_API_KEY is not configured on the server. Set NVIDIA_API_KEY in Vercel environment variables or in AI Configuration.",
      503,
      "missing_api_key",
    );
  }

  const endpoint = ai.apiEndpoint?.trim() || DEFAULT_NVIDIA_API_ENDPOINT;
  const rawModel = (
    params.modelOverride ||
    ai.selectedModel ||
    "nvidia/nemotron-3.5-lightning-30b-a3b"
  ).trim();
  const preferredModel =
    endpoint.includes("nvidia.com") && rawModel.startsWith("gemini-")
      ? "nvidia/nemotron-3.5-lightning-30b-a3b"
      : endpoint.includes("nvidia.com") &&
          !rawModel.includes("/") &&
          rawModel.startsWith("nemotron")
        ? `nvidia/${rawModel}`
        : rawModel;

  const modelCandidates = Array.from(
    new Set([preferredModel, ...FALLBACK_NVIDIA_MODELS]),
  );

  const temperature = Math.min(
    2,
    Math.max(0, params.temperatureOverride ?? ai.temperature ?? 0.75),
  );
  const isReasoning = preferredModel.includes("nemotron");
  const minTokens = isReasoning ? 2048 : 200;
  const maxTokens = Math.min(
    4096,
    Math.max(
      minTokens,
      params.maxTokensOverride ?? ai.maxOutputTokens ?? minTokens,
    ),
  );

  const messages: NvidiaChatMessage[] =
    params.messages && params.messages.length > 0
      ? params.messages
      : [
          {
            role: "system",
            content:
              params.systemPrompt?.trim() ||
              personality.additionalInstructions ||
              "You are Anjali, a warm, supportive AI bestie.",
          },
          {
            role: "user",
            content: params.userPrompt?.trim() || "Hello!",
          },
        ];

  let lastError: Error | null = null;
  let lastStatus = 502;

  for (const candidateModel of modelCandidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resolvedKey.key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: candidateModel,
          messages,
          temperature,
          top_p: 0.9,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const rawText = await response.text();
      if (!response.ok) {
        lastStatus = response.status;
        lastError = new Error(
          `NVIDIA HTTP ${response.status}: ${rawText.slice(0, 200)}`,
        );

        // Do not try fallback models on 401/403 (invalid API key)
        if (response.status === 401 || response.status === 403) {
          break;
        }
        continue;
      }

      const data = JSON.parse(rawText) as {
        model?: string;
        choices?: { message?: { content?: string } }[];
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!reply) {
        lastError = new Error("NVIDIA response contained empty message content.");
        continue;
      }

      const promptTokens =
        typeof data.usage?.prompt_tokens === "number"
          ? data.usage.prompt_tokens
          : null;
      const completionTokens =
        typeof data.usage?.completion_tokens === "number"
          ? data.usage.completion_tokens
          : null;
      const totalTokens =
        typeof data.usage?.total_tokens === "number"
          ? data.usage.total_tokens
          : promptTokens !== null && completionTokens !== null
            ? promptTokens + completionTokens
            : null;

      const latencyMs = Date.now() - startMs;
      const usedModel = data.model || candidateModel;

      await recordUsageEvent({
        userId: params.userId,
        requestType,
        status: "success",
        tokensUsed: totalTokens,
        promptTokens,
        completionTokens,
        model: usedModel,
        provider: ai.provider || "nvidia",
        latencyMs,
        requestId,
        source: "backend_ai_chat",
      });

      return {
        reply,
        model: usedModel,
        provider: ai.provider || "nvidia",
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
        latencyMs,
        requestId,
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        lastStatus = 504;
        lastError = new Error("NVIDIA API request timed out after 25s.");
      } else {
        lastError =
          error instanceof Error ? error : new Error("NVIDIA API request failed.");
      }
    }
  }

  const latencyMs = Date.now() - startMs;
  const isRateLimited = lastStatus === 429;
  const sanitizedErr = sanitizeErrorMessage(lastError);

  await recordUsageEvent({
    userId: params.userId,
    requestType,
    status: isRateLimited ? "rate_limited" : "failure",
    tokensUsed: null,
    model: preferredModel,
    provider: ai.provider || "nvidia",
    latencyMs,
    requestId,
    errorMessage: sanitizedErr,
    source: "backend_ai_chat",
  });

  throw new AiProviderError(
    sanitizedErr,
    lastStatus,
    isRateLimited ? "rate_limited" : "provider_error",
  );
}
