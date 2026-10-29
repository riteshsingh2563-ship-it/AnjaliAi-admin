import { NextRequest, NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/init";
import { auditLogs } from "@/db/schema";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";

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
    const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 200);

    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(limit);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs);

    return NextResponse.json({ logs: rows, total: count });
  } catch (error) {
    console.error("[api/audit-logs] failed:", error);
    return NextResponse.json({ error: "Failed to load audit logs." }, { status: 500 });
  }
}
