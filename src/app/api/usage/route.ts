import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/init";
import { usageLogs } from "@/db/schema";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import { isUsageIngestConfigured } from "@/lib/env";
import { syncFirestoreUsageIfNeeded } from "@/lib/nvidia-ai";

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

    const { searchParams } = new URL(request.url);
    const forceSync = searchParams.get("sync") === "true";
    const firestoreSync = await syncFirestoreUsageIfNeeded(forceSync);

    const days = Math.min(Number(searchParams.get("days") ?? 14) || 14, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const whereClause = gte(usageLogs.timestamp, since);

    const [{ count: totalRequests }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usageLogs)
      .where(whereClause);

    const [{ count: failedRequests }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usageLogs)
      .where(and(whereClause, eq(usageLogs.status, "failure")));

    const [{ count: rateLimited }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usageLogs)
      .where(and(whereClause, eq(usageLogs.status, "rate_limited")));

    const [{ distinctUsers }] = await db
      .select({ distinctUsers: sql<number>`count(distinct ${usageLogs.userId})::int` })
      .from(usageLogs)
      .where(whereClause);

    const [{ totalTokens }] = await db
      .select({ totalTokens: sql<number>`coalesce(sum(${usageLogs.tokensUsed}), 0)::int` })
      .from(usageLogs)
      .where(whereClause);

    const dailySeries = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${usageLogs.timestamp}), 'YYYY-MM-DD')`,
        requests: sql<number>`count(*)::int`,
        failures: sql<number>`count(*) filter (where ${usageLogs.status} = 'failure')::int`,
      })
      .from(usageLogs)
      .where(whereClause)
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const recent = await db
      .select()
      .from(usageLogs)
      .orderBy(desc(usageLogs.timestamp))
      .limit(100);

    return NextResponse.json({
      rangeDays: days,
      ingestConfigured: isUsageIngestConfigured,
      firestoreSync,
      totals: {
        totalRequests,
        failedRequests,
        rateLimited,
        distinctUsers,
        totalTokens,
      },
      dailySeries,
      recent,
    });
  } catch (error) {
    console.error("[api/usage] failed to load usage data:", error);
    return NextResponse.json(
      { error: "Failed to load usage statistics." },
      { status: 500 },
    );
  }
}
