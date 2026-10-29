import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { usageLogs } from "@/db/schema";
import { env, isNvidiaConfigured } from "@/lib/env";
import { verifyFirebaseIdToken, FirebaseTokenError } from "@/lib/verifyFirebaseToken";

export const dynamic = "force-dynamic";

const chatRequestSchema = z.object({
  systemPrompt: z.string().default("You are Anjali, a warm, caring, supportive AI bestie."),
  userPrompt: z.string().min(1, "userPrompt is required"),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.8),
  maxTokens: z.number().int().min(50).max(4096).default(500),
  userId: z.string().optional(),
  requestId: z.string().optional(),
});

const DEFAULT_NVIDIA_MODEL = "meta/llama-3.3-70b-instruct";
const FALLBACK_NVIDIA_MODELS = [
  "google/gemma-4-31b-it",
  "meta/llama-3.3-70b-instruct",
  "meta/llama-3.1-70b-instruct",
];

export async function POST(request: NextRequest) {
  const startMs = Date.now();

  // 1. Authenticate caller (Android app client via Firebase ID token)
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized: Missing Bearer ID token in Authorization header." },
      { status: 401 },
    );
  }

  const idToken = authHeader.substring(7).trim();
  let verifiedUid: string | null = null;
  try {
    const verifiedUser = await verifyFirebaseIdToken(idToken);
    verifiedUid = verifiedUser.uid;
  } catch (authErr) {
    const message = authErr instanceof FirebaseTokenError ? authErr.message : "Invalid ID token";
    return NextResponse.json({ error: `Unauthorized: ${message}` }, { status: 401 });
  }

  // 2. Validate request body
  let parsedBody;
  try {
    const raw = await request.json();
    parsedBody = chatRequestSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { systemPrompt, userPrompt, temperature, maxTokens, userId, requestId } = parsedBody;
  const effectiveUserId = verifiedUid || userId || null;

  // 3. Check server-side NVIDIA configuration
  if (!isNvidiaConfigured || !env.NVIDIA_API_KEY) {
    return NextResponse.json(
      { error: "Server-side NVIDIA AI API key is not configured (NVIDIA_API_KEY)." },
      { status: 503 },
    );
  }

  // Model resolution: if model is empty or starts with gemini-, use compatible NVIDIA model
  let requestedModel = (parsedBody.model || "").trim();
  if (!requestedModel || requestedModel.startsWith("gemini-")) {
    requestedModel = DEFAULT_NVIDIA_MODEL;
  }

  const candidateModels = [requestedModel, ...FALLBACK_NVIDIA_MODELS].filter(
    (m, i, arr) => arr.indexOf(m) === i,
  );

  let finalReply = "";
  let usedModel = requestedModel;
  let totalTokens: number | null = null;
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  let lastErrorMsg = "";
  let status: "success" | "failure" | "rate_limited" = "failure";

  for (const modelCandidate of candidateModels) {
    try {
      const response = await fetch(env.NVIDIA_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: modelCandidate,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          stream: false,
        }),
      });

      if (response.status === 429) {
        status = "rate_limited";
        lastErrorMsg = `NVIDIA API 429 Rate Limited on ${modelCandidate}`;
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        lastErrorMsg = `NVIDIA API ${response.status}: ${errText.slice(0, 200)}`;
        continue;
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content?.trim();
      if (content) {
        finalReply = content;
        usedModel = json.model || modelCandidate;
        promptTokens = json.usage?.prompt_tokens ?? null;
        completionTokens = json.usage?.completion_tokens ?? null;
        totalTokens =
          json.usage?.total_tokens ??
          (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null);
        status = "success";
        break;
      }
    } catch (fetchErr) {
      lastErrorMsg = fetchErr instanceof Error ? fetchErr.message : "Network fetch failed";
    }
  }

  const latencyMs = Math.max(0, Date.now() - startMs);

  // 4. Record usage in PostgreSQL
  try {
    await db.insert(usageLogs).values({
      userId: effectiveUserId,
      requestType: "chat_message",
      status,
      tokensUsed: totalTokens,
      model: usedModel,
      latencyMs,
      source: "backend_proxy",
    });
  } catch (dbErr) {
    console.error("[api/ai/chat] Failed to record usage log:", dbErr);
  }

  if (status !== "success" || !finalReply) {
    return NextResponse.json(
      {
        error: lastErrorMsg || "Failed to generate AI completion from NVIDIA provider.",
        status,
        requestId,
      },
      { status: status === "rate_limited" ? 429 : 502 },
    );
  }

  return NextResponse.json({
    reply: finalReply,
    model: usedModel,
    tokensUsed: totalTokens,
    latencyMs,
    requestId,
  });
}
