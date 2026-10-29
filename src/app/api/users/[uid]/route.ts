import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { recordAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ disabled: z.boolean() });

export async function PATCH(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  let admin;
  try {
    admin = await requireAuthorizedAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uid } = await context.params;
  const fbAdmin = getFirebaseAdmin();
  if (!fbAdmin) {
    return NextResponse.json(
      { error: "Firebase Admin SDK is not configured, so account restrictions cannot be applied." },
      { status: 503 },
    );
  }

  try {
    const { disabled } = bodySchema.parse(await request.json());
    await fbAdmin.auth.updateUser(uid, { disabled });

    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.USER_STATUS_CHANGE,
      metadata: { uid, disabled },
      result: "success",
    });

    return NextResponse.json({ ok: true, uid, disabled });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed." }, { status: 422 });
    }
    console.error("[users/:uid] update failed:", error);
    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.USER_STATUS_CHANGE,
      metadata: { uid, error: String(error) },
      result: "failure",
    });
    return NextResponse.json({ error: "Failed to update user status." }, { status: 500 });
  }
}
