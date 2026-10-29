import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import { getPersonalityConfig, savePersonalityConfig } from "@/lib/config-service";
import { personalitySchema } from "@/lib/validation";
import { recordAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthorizedAdmin();
    const config = await getPersonalityConfig();
    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load personality configuration." }, { status: 500 });
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
    const input = personalitySchema.parse(body);
    const { row, publish } = await savePersonalityConfig(input, admin.email);

    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.PERSONALITY_UPDATE,
      metadata: { characterName: input.characterName, version: row.version, firestoreSynced: publish.success },
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
      actionType: AUDIT_ACTIONS.PERSONALITY_UPDATE,
      metadata: { error: String(error) },
      result: "failure",
    });
    return NextResponse.json({ error: "Failed to save personality configuration." }, { status: 500 });
  }
}
