import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import { getGeneralSettings, saveGeneralSettings } from "@/lib/config-service";
import { generalSettingsSchema } from "@/lib/validation";
import { recordAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthorizedAdmin();
    const config = await getGeneralSettings();
    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to load general settings." }, { status: 500 });
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
    const input = generalSettingsSchema.parse(body);
    const previous = await getGeneralSettings();
    const { row, publish } = await saveGeneralSettings(input, admin.email);

    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.GENERAL_SETTINGS_UPDATE,
      metadata: { version: row.version, firestoreSynced: publish.success },
      result: "success",
    });

    if (previous.maintenanceMode !== input.maintenanceMode) {
      await recordAuditLog({
        adminEmail: admin.email,
        actionType: AUDIT_ACTIONS.MAINTENANCE_MODE_TOGGLE,
        metadata: { maintenanceMode: input.maintenanceMode },
        result: "success",
      });
    }

    return NextResponse.json({ config: row, publish });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed.", details: error.flatten() }, { status: 422 });
    }
    console.error(error);
    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.GENERAL_SETTINGS_UPDATE,
      metadata: { error: String(error) },
      result: "failure",
    });
    return NextResponse.json({ error: "Failed to save general settings." }, { status: 500 });
  }
}
