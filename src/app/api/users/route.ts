import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import { getFirebaseAdmin } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type DirectoryUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  disabled: boolean;
};

export async function GET(request: NextRequest) {
  try {
    await requireAuthorizedAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return NextResponse.json({
      configured: false,
      users: [],
      message:
        "Firebase Admin SDK is not configured for this deployment, so real Android app user accounts cannot be listed yet. Configure FIREBASE_SERVICE_ACCOUNT_KEY to enable User Management.",
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("q") ?? "").toLowerCase().trim();
    const statusFilter = searchParams.get("status"); // "active" | "disabled"

    const users: DirectoryUser[] = [];
    let pageToken: string | undefined;
    // Firebase Admin returns at most 1000 users per page; fetch a handful of
    // pages (bounded) so the dashboard stays responsive for large user bases.
    for (let page = 0; page < 5; page++) {
      const result = await admin.auth.listUsers(1000, pageToken);
      for (const u of result.users) {
        users.push({
          uid: u.uid,
          email: u.email ?? null,
          displayName: u.displayName ?? null,
          createdAt: u.metadata.creationTime ?? null,
          lastSignInAt: u.metadata.lastSignInTime ?? null,
          disabled: u.disabled,
        });
      }
      if (!result.pageToken) break;
      pageToken = result.pageToken;
    }

    let filtered = users;
    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.email?.toLowerCase().includes(search) ||
          u.displayName?.toLowerCase().includes(search) ||
          u.uid.toLowerCase().includes(search),
      );
    }
    if (statusFilter === "active") filtered = filtered.filter((u) => !u.disabled);
    if (statusFilter === "disabled") filtered = filtered.filter((u) => u.disabled);

    return NextResponse.json({ configured: true, users: filtered, total: users.length });
  } catch (error) {
    console.error("[users] listUsers failed:", error);
    return NextResponse.json(
      { configured: true, users: [], error: "Failed to fetch users from Firebase Authentication." },
      { status: 500 },
    );
  }
}
