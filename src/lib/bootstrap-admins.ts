import "server-only";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/init";
import { adminAllowlist } from "@/db/schema";
import { env } from "@/lib/env";

let seeded = false;

/**
 * Ensures the database schema is present and seeds the admin_allowlist table
 * from the ADMIN_EMAILS environment variable (comma separated). Uses
 * ON CONFLICT (email) DO NOTHING so it never overwrites or removes
 * existing admin rows.
 */
export async function ensureAdminAllowlistSeeded() {
  await ensureDatabaseSchema();

  if (seeded) return;
  seeded = true;

  if (!env.ADMIN_EMAILS) return;

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
    .onConflictDoNothing({ target: adminAllowlist.email });
}
