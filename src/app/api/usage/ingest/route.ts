import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { usageLogs } from "@/db/schema";
import { env, isUsageIngestConfigured } from "@/lib/env";
import { verifyFirebaseIdToken, FirebaseTokenError } from "@/lib/verifyFirebaseToken";

export const dynamic = "force-dynamic";

// Ingestion endpoint supporting:
// 1. Trusted backend services (authorized via `x-api-key: USAGE_INGEST_API_KEY`)
// 2. Authenticated Android mobile app clients (authorized via `Authorization: Bearer <FirebaseIdToken>`)
const bodySchema = z.object({
  userId: z.string().max(200).optional().nullable(),
  requestType: z.string().max(60).default("chat_message"),
  status: z.enum(["success", "failure", "rate_limited"]).default("success"),
  tokensUsed: z.number().int().min(0).max(1000000).optional().nullable(),
  promptTokens: z.number().int().min(0).max(1000000).optional().nullable(),
  completionTokens: z.number().int().min(0).max(1000000).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  provider: z.string().max(60).optional().nullable(),
  latencyMs: z.number().int().min(0).max(600000).optional().nullable(),
  requestId: z.string().max(100).optional().nullable(),
  errorMessage: z.string().max(500).optional().nullable(),
  source: z.string().max(60).optional().nullable(),
});

export async function POST(request: NextRequest) {
  let authorizedSource: "ingest_api" | "android_app" | null = null;
  let authUid: string | null = null;

  // 1. Check shared secret API key
  const providedApiKey = request.headers.get("x-api-key");
  if (isUsageIngestConfigured && providedApiKey && providedApiKey === env.USAGE_INGEST_API_KEY) {
    authorizedSource = "ingest_api";
  }

  // 2. Check Firebase ID Token (for Android app telemetry fallback)
  if (!authorizedSource) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      try {
        const verifiedUser = await verifyFirebaseIdToken(token);
        authorizedSource = "android_app";
        authUid = verifiedUser.uid;
      } catch (tokenErr) {
        const msg = tokenErr instanceof FirebaseTokenError ? tokenErr.message : "Invalid ID token";
        return NextResponse.json({ error: `Unauthorized: ${msg}` }, { status: 401 });
      }
    }
  }

  if (!authorizedSource) {
    return NextResponse.json(
      {
        error:
          "Unauthorized: Missing or invalid credentials. Provide either 'x-api-key' or 'Authorization: Bearer <FirebaseIdToken>'.",
      },
      { status: 401 },
    );
  }

  try {
    const body = bodySchema.parse(await request.json());

    const totalTokens =
      body.tokensUsed ??
      (body.promptTokens != null && body.completionTokens != null
        ? body.promptTokens + body.completionTokens
        : null);

    await db.insert(usageLogs).values({
      userId: body.userId || authUid || null,
      requestType: body.requestType,
      status: body.status,
      tokensUsed: totalTokens,
      model: body.model || null,
      latencyMs: body.latencyMs != null ? Math.round(body.latencyMs) : null,
      source: authorizedSource === "android_app" ? "android_app" : (body.source || "ingest_api"),
    });

    return NextResponse.json({ ok: true, source: authorizedSource });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", details: error.flatten() }, { status: 422 });
    }
    console.error("[api/usage/ingest] Error persisting usage log:", error);
    return NextResponse.json({ error: "Failed to record usage event." }, { status: 500 });
  }
}
