import "server-only";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/init";
import { auditLogs } from "@/db/schema";

export async function recordAuditLog(entry: {
  adminEmail: string;
  actionType: string;
  metadata?: Record<string, unknown>;
  result?: "success" | "failure";
}) {
  try {
    await ensureDatabaseSchema();
    await db.insert(auditLogs).values({
      adminEmail: entry.adminEmail,
      actionType: entry.actionType,
      metadata: entry.metadata ?? {},
      result: entry.result ?? "success",
    });
  } catch (error) {
    console.error("[audit] failed to record audit log:", error);
  }
}
