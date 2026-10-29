import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import {
  getAiConfig,
  saveAiConfig,
  sanitizeAiConfigForClient,
} from "@/lib/config-service";
import { aiConfigSchema, isVerifiedModel } from "@/lib/validation";
import { recordAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS, VERIFIED_GEMINI_MODELS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthorizedAdmin();
    const row = await getAiConfig();
    const config = await sanitizeAiConfigForClient(row);
    return NextResponse.json({ config, verifiedModels: VERIFIED_GEMINI_MODELS });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[api/config/ai] GET failed:", error);
    return NextResponse.json({ error: "Failed to load AI configuration." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let admin;
  try {
    admin = await requireAuthorizedAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = aiConfigSchema.parse(body);
    const { row, publish } = await saveAiConfig(input, admin.email);
    const safeConfig = await sanitizeAiConfigForClient(row);

    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.AI_CONFIG_UPDATE,
      metadata: {
        provider: input.provider,
        apiEndpoint: input.apiEndpoint,
        selectedModel: input.selectedModel,
        verified: isVerifiedModel(input.selectedModel),
        apiKeyRotated: Boolean(input.apiKey && input.apiKey.trim().length > 0),
        version: row.version,
        firestoreSynced: publish.success,
      },
      result: "success",
    });

    return NextResponse.json({ config: safeConfig, publish });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed.", details: error.flatten() },
        { status: 422 },
      );
    }
    console.error("[api/config/ai] PUT failed:", error);
    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.AI_CONFIG_UPDATE,
      metadata: { error: error instanceof Error ? error.message : String(error) },
      result: "failure",
    });
    return NextResponse.json({ error: "Failed to save AI configuration." }, { status: 500 });
  }
}
