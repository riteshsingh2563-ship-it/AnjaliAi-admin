import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizedAdmin } from "@/lib/admin-auth";
import { verifyFirebaseIdToken } from "@/lib/verifyFirebaseToken";
import { env } from "@/lib/env";
import { recordUsageEvent, sanitizeErrorMessage } from "@/lib/nvidia-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accepts usage events from:
// 1. Trusted server-to-server callers using `x-api-key: <USAGE_INGEST_API_KEY>`
// 2. Authenticated Android app users via `Authorization: Bearer <firebaseIdToken>`
// 3. Authorized administrators logged into the dashboard
const bodySchema = z.object({
  userId: z.string().max(200).optional(),
  requestType: z.string().max(60).default("chat_message"),
  status: z.enum(["success", "failure", "rate_limited"]).default("success"),
  tokensUsed: z.number().int().min(0).max(1000000).nullable().optional(),
  promptTokens: z.number().int().min(0).max(1000000).nullable().optional(),
  completionTokens: z.number().int().min(0).max(1000000).nullable().optional(),
  model: z.string().max(120).nullable().optional(),
  provider: z.string().max(40).nullable().optional(),
  latencyMs: z.number().int().min(0).max(600000).nullable().optional(),
  requestId: z.string().max(160).nullable().optional(),
  errorMessage: z.string().max(300).nullable().optional(),
  source: z.string().max(60).optional(),
});

async function authorizeUsageIngest(
  request: NextRequest,
): Promise<{ authorized: boolean; verifiedUserId: string | null; defaultSource: string }> {
  // 1. Check shared secret header
  const providedKey = request.headers.get("x-api-key");
  if (env.USAGE_INGEST_API_KEY && providedKey === env.USAGE_INGEST_API_KEY) {
    return { authorized: true, verifiedUserId: null, defaultSource: "ingest_api" };
  }

  // 2. Check Firebase ID token from the Android app
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const idToken = authHeader.slice(7).trim();
    if (idToken) {
      try {
        const verified = await verifyFirebaseIdToken(idToken);
        return {
          authorized: true,
          verifiedUserId: verified.uid,
          defaultSource: "android_app",
        };
      } catch {
        // Fall through
      }
    }
  }

  // 3. Check Admin session cookie
  const admin = await getAuthorizedAdmin();
  if (admin) {
    return {
      authorized: true,
      verifiedUserId: `admin:${admin.email}`,
      defaultSource: "admin_dashboard",
    };
  }

  return { authorized: false, verifiedUserId: null, defaultSource: "ingest_api" };
}

export async function POST(request: NextRequest) {
  const auth = await authorizeUsageIngest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      {
        error:
          "Unauthorized. Provide a valid Firebase ID token in Authorization: Bearer <token> or a valid x-api-key header.",
      },
      { status: 401 },
    );
  }

  try {
    const body = bodySchema.parse(await request.json());
    const resolvedTokens =
      typeof body.tokensUsed === "number"
        ? body.tokensUsed
        : typeof body.promptTokens === "number" &&
            typeof body.completionTokens === "number"
          ? body.promptTokens + body.completionTokens
          : null;

    await recordUsageEvent({
      userId: auth.verifiedUserId ?? body.userId ?? null,
      requestType: body.requestType,
      status: body.status,
      tokensUsed: resolvedTokens,
      promptTokens: body.promptTokens ?? null,
      completionTokens: body.completionTokens ?? null,
      model: body.model ?? null,
      provider: body.provider ?? "nvidia",
      latencyMs: body.latencyMs ?? null,
      requestId: body.requestId ?? null,
      errorMessage: body.errorMessage ?? null,
      source: body.source ?? auth.defaultSource,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("[api/usage/ingest] error:", sanitizeErrorMessage(error));
    return NextResponse.json(
      { error: "Failed to record usage event." },
      { status: 500 },
    );
  }
}
