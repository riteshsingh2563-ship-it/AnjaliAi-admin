import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizedAdmin } from "@/lib/admin-auth";
import { verifyFirebaseIdToken } from "@/lib/verifyFirebaseToken";
import { env } from "@/lib/env";
import {
  executeServerNvidiaChatCompletion,
  AiProviderError,
  sanitizeErrorMessage,
} from "@/lib/nvidia-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(16000),
});

const chatBodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(40).optional(),
  systemPrompt: z.string().max(12000).optional(),
  userPrompt: z.string().min(1).max(8000).optional(),
  model: z.string().max(120).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(32).max(4096).optional(),
  userId: z.string().max(200).optional(),
  requestType: z.string().max(60).optional(),
  requestId: z.string().max(160).optional(),
});

async function resolveCallerIdentity(
  request: NextRequest,
): Promise<{ authorized: boolean; userId: string | null }> {
  // 1. Check shared API key header
  const providedKey = request.headers.get("x-api-key");
  if (env.USAGE_INGEST_API_KEY && providedKey === env.USAGE_INGEST_API_KEY) {
    return { authorized: true, userId: null };
  }

  // 2. Check Firebase ID token from Android client (Authorization: Bearer <idToken>)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const idToken = authHeader.slice(7).trim();
    if (idToken) {
      try {
        const verified = await verifyFirebaseIdToken(idToken);
        return { authorized: true, userId: verified.uid };
      } catch (err) {
        console.warn(
          "Firebase ID token verification failed in /api/ai/chat:",
          err instanceof Error ? err.message : err,
        );
        // Fall through to admin session check
      }
    }
  }

  // 3. Check Admin Dashboard session cookie
  const admin = await getAuthorizedAdmin();
  if (admin) {
    return { authorized: true, userId: `admin:${admin.email}` };
  }

  return { authorized: false, userId: null };
}

export async function POST(request: NextRequest) {
  const caller = await resolveCallerIdentity(request);
  if (!caller.authorized) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid Firebase ID token, x-api-key, or admin session." },
      { status: 401 },
    );
  }

  try {
    const body = chatBodySchema.parse(await request.json());
    const result = await executeServerNvidiaChatCompletion({
      userId: caller.userId ?? body.userId ?? null,
      messages: body.messages,
      systemPrompt: body.systemPrompt,
      userPrompt: body.userPrompt,
      modelOverride: body.model,
      temperatureOverride: body.temperature,
      maxTokensOverride: body.maxTokens,
      requestType: body.requestType ?? "chat_message",
      requestId: body.requestId,
    });

    return NextResponse.json({
      ok: true,
      reply: result.reply,
      model: result.model,
      provider: result.provider,
      usage: result.usage,
      latencyMs: result.latencyMs,
      requestId: result.requestId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request payload.", details: error.flatten() },
        { status: 422 },
      );
    }
    if (error instanceof AiProviderError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[api/ai/chat] unexpected error:", sanitizeErrorMessage(error));
    return NextResponse.json(
      { error: "AI request failed." },
      { status: 500 },
    );
  }
}
