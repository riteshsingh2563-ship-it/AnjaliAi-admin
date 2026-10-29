import { NextRequest, NextResponse } from "next/server";
import { and, desc, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { usageLogs } from "@/db/schema";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import { isUsageIngestConfigured } from "@/lib/env";

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

  const { searchParams } = new URL(request.url);
  const days = Math.min(Number(searchParams.get("days") ?? 14) || 14, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const filters = [gte(usageLogs.timestamp, since)];
  const whereClause = and(...filters);

  const [{ count: totalRequests }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usageLogs)
    .where(whereClause);

  const [{ count: failedRequests }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usageLogs)
    .where(and(whereClause, sql`${usageLogs.status} = 'failure'`));

  const [{ count: rateLimited }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usageLogs)
    .where(and(whereClause, sql`${usageLogs.status} = 'rate_limited'`));

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
}
