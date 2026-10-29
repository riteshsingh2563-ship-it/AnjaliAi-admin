import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import { getAiConfig, saveAiConfig } from "@/lib/config-service";
import { aiConfigSchema, isVerifiedModel } from "@/lib/validation";
import { recordAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS, VERIFIED_GEMINI_MODELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthorizedAdmin();
    const config = await getAiConfig();
    return NextResponse.json({ config, verifiedModels: VERIFIED_GEMINI_MODELS });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
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

    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.AI_CONFIG_UPDATE,
      metadata: {
        selectedModel: input.selectedModel,
        verified: isVerifiedModel(input.selectedModel),
        version: row.version,
        firestoreSynced: publish.success,
      },
      result: "success",
    });

    return NextResponse.json({ config: row, publish });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed.", details: error.flatten() }, { status: 422 });
    }
    console.error(error);
    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.AI_CONFIG_UPDATE,
      metadata: { error: String(error) },
      result: "failure",
    });
    return NextResponse.json({ error: "Failed to save AI configuration." }, { status: 500 });
  }
}
