import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function recordAuditLog(entry: {
  adminEmail: string;
  actionType: string;
  metadata?: Record<string, unknown>;
  result?: "success" | "failure";
}) {
  await db.insert(auditLogs).values({
    adminEmail: entry.adminEmail,
    actionType: entry.actionType,
    metadata: entry.metadata ?? {},
    result: entry.result ?? "success",
  });
}
