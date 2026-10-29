import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/init";
import { adminAllowlist, auditLogs, usageLogs } from "@/db/schema";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import { getAiConfig, getGeneralSettings } from "@/lib/config-service";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { syncFirestoreUsageIfNeeded } from "@/lib/nvidia-ai";
import { isVerifiedModel } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuthorizedAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureDatabaseSchema();
    await syncFirestoreUsageIfNeeded();

    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get("days") ?? 14) || 14, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [ai, general] = await Promise.all([getAiConfig(), getGeneralSettings()]);

    const [{ count: adminCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminAllowlist)
      .where(eq(adminAllowlist.active, true));

    const [{ count: totalRequests }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usageLogs)
      .where(gte(usageLogs.timestamp, since));

    const [{ count: requests24h }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usageLogs)
      .where(gte(usageLogs.timestamp, since24h));

    const [{ count: failures }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usageLogs)
      .where(and(gte(usageLogs.timestamp, since), eq(usageLogs.status, "failure")));

    const dailySeries = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${usageLogs.timestamp}), 'YYYY-MM-DD')`,
        requests: sql<number>`count(*)::int`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.timestamp, since))
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const recentActivity = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(8);

    let androidUserCount: number | null = null;
    const admin = getFirebaseAdmin();
    if (admin) {
      try {
        const result = await admin.auth.listUsers(1000);
        androidUserCount = result.users.length;
      } catch {
        androidUserCount = null;
      }
    }

    return NextResponse.json({
      adminCount,
      androidUserCount,
      androidUsersConfigured: Boolean(admin),
      usage: {
        totalRequests,
        requests24h,
        failures,
        successRate:
          totalRequests > 0
            ? Math.round(((totalRequests - failures) / totalRequests) * 1000) / 10
            : null,
      },
      dailySeries,
      aiModel: {
        selectedModel: ai.selectedModel,
        verified: isVerifiedModel(ai.selectedModel),
      },
      maintenanceMode: general.maintenanceMode,
      configurationVersion: general.configurationVersion,
      recentActivity,
    });
  } catch (error) {
    console.error("[api/dashboard/overview] failed:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard overview." },
      { status: 500 },
    );
  }
}
