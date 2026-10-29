import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { usageLogs } from "@/db/schema";
import { env, isUsageIngestConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

// This endpoint is meant to be called by a TRUSTED backend (e.g. a Cloud
// Function sitting between the Android app and Gemini / Firebase AI Logic)
// to report real usage events, never directly by end-user devices. It is
// authorized with a shared secret header, not an admin session cookie.
const bodySchema = z.object({
  userId: z.string().max(200).optional(),
  requestType: z.string().max(60).default("chat_message"),
  status: z.enum(["success", "failure", "rate_limited"]).default("success"),
  tokensUsed: z.number().int().min(0).max(1000000).optional(),
  model: z.string().max(60).optional(),
  latencyMs: z.number().int().min(0).max(600000).optional(),
});

export async function POST(request: NextRequest) {
  if (!isUsageIngestConfigured) {
    return NextResponse.json(
      {
        error:
          "Usage ingestion is not configured. Set USAGE_INGEST_API_KEY on the server to enable this endpoint.",
      },
      { status: 503 },
    );
  }

  const providedKey = request.headers.get("x-api-key");
  if (!providedKey || providedKey !== env.USAGE_INGEST_API_KEY) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    await db.insert(usageLogs).values({ ...body, source: "ingest_api" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", details: error.flatten() }, { status: 422 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to record usage event." }, { status: 500 });
  }
}
