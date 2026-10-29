import "server-only";
import { db } from "@/db";
import { adminAllowlist } from "@/db/schema";
import { env } from "@/lib/env";

let seeded = false;

/**
 * Seeds the admin_allowlist table from the ADMIN_EMAILS environment variable
 * (comma separated) the first time it is needed, but only if the table is
 * currently empty. This never overwrites or removes manually-managed rows.
 */
export async function ensureAdminAllowlistSeeded() {
  if (seeded) return;
  seeded = true;

  if (!env.ADMIN_EMAILS) return;

  const existing = await db.select({ id: adminAllowlist.id }).from(adminAllowlist).limit(1);
  if (existing.length > 0) return;

  const emails = env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) return;

  await db
    .insert(adminAllowlist)
    .values(
      emails.map((email, index) => ({
        email,
        role: index === 0 ? "owner" : "admin",
        addedBy: "env:ADMIN_EMAILS",
      })),
    )
    .onConflictDoNothing();
}
