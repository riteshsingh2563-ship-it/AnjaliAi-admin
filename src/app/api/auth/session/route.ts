import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminAllowlist } from "@/db/schema";
import { verifyFirebaseIdToken, FirebaseTokenError } from "@/lib/verifyFirebaseToken";
import { createAdminSessionToken, ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS } from "@/lib/session";
import { ensureAdminAllowlistSeeded } from "@/lib/bootstrap-admins";
import { getAuthorizedAdmin } from "@/lib/admin-auth";
import { recordAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/constants";
import { env, isAdminSessionSecretConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAdminSessionSecretConfigured) {
    return NextResponse.json(
      {
        error:
          "Server is missing ADMIN_SESSION_SECRET. Set it in your environment before admin login can be enabled.",
      },
      { status: 500 },
    );
  }
  if (!env.FIREBASE_PROJECT_ID) {
    return NextResponse.json(
      { error: "Server is missing FIREBASE_PROJECT_ID. Firebase is not configured yet." },
      { status: 500 },
    );
  }

  let idToken: string | undefined;
  try {
    const body = await request.json();
    idToken = body?.idToken;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken." }, { status: 400 });
  }

  let firebaseUser;
  try {
    firebaseUser = await verifyFirebaseIdToken(idToken);
  } catch (error) {
    const message = error instanceof FirebaseTokenError ? error.message : "Unable to verify sign-in.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (!firebaseUser.email || !firebaseUser.emailVerified) {
    return NextResponse.json(
      { error: "Your Google account email is not verified or missing." },
      { status: 403 },
    );
  }

  let allow;
  const email = firebaseUser.email.toLowerCase();
  try {
    await ensureAdminAllowlistSeeded();
    const rows = await db
      .select()
      .from(adminAllowlist)
      .where(eq(adminAllowlist.email, email))
      .limit(1);
    allow = rows[0];
  } catch (error) {
    console.error("[api/auth/session] database error:", error);
    return NextResponse.json(
      {
        error:
          "Database connection error while verifying admin allowlist. Verify DATABASE_URL in Vercel settings.",
      },
      { status: 500 },
    );
  }

  if (!allow || !allow.active) {
    await recordAuditLog({
      adminEmail: email,
      actionType: AUDIT_ACTIONS.LOGIN_DENIED,
      metadata: { reason: !allow ? "not_in_allowlist" : "inactive" },
      result: "failure",
    });
    return NextResponse.json(
      {
        error:
          "This Google account is not an authorized administrator for ANJALI. Ask an existing owner to add your email to the admin allowlist (or set ADMIN_EMAILS in Vercel).",
      },
      { status: 403 },
    );
  }

  const token = await createAdminSessionToken({
    email,
    name: firebaseUser.name,
    picture: firebaseUser.picture,
    role: allow.role,
  });

  await recordAuditLog({
    adminEmail: email,
    actionType: AUDIT_ACTIONS.LOGIN_SUCCESS,
    metadata: { role: allow.role },
    result: "success",
  });

  const response = NextResponse.json({ ok: true, email, role: allow.role });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  return response;
}

export async function DELETE() {
  try {
    const admin = await getAuthorizedAdmin();
    if (admin) {
      await recordAuditLog({ adminEmail: admin.email, actionType: AUDIT_ACTIONS.LOGOUT });
    }
  } catch {
    // ignore - logout should always succeed in clearing the cookie
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
