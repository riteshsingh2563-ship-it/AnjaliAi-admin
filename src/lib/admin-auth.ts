import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/init";
import { adminAllowlist } from "@/db/schema";
import { getAdminSessionFromCookies } from "@/lib/session";

export type AuthorizedAdmin = {
  email: string;
  name?: string;
  picture?: string;
  role: string;
};

/**
 * Resolves the current request's admin identity. This is the single source
 * of truth used by every server component and API route — it is NOT enough
 * to just have a valid session cookie; the email must also currently be
 * active in the admin_allowlist table. This means revoking an admin takes
 * effect immediately, without waiting for a token to expire.
 */
export async function getAuthorizedAdmin(): Promise<AuthorizedAdmin | null> {
  const session = await getAdminSessionFromCookies();
  if (!session) return null;

  try {
    await ensureDatabaseSchema();

    const rows = await db
      .select()
      .from(adminAllowlist)
      .where(eq(adminAllowlist.email, session.email.toLowerCase()))
      .limit(1);

    const row = rows[0];
    if (!row || !row.active) return null;

    return {
      email: row.email,
      name: session.name,
      picture: session.picture,
      role: row.role,
    };
  } catch (error) {
    console.error("[admin-auth] failed to verify admin allowlist:", error);
    return null;
  }
}

export class UnauthorizedError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Throws a typed error if there is no authorized admin. Use inside API routes. */
export async function requireAuthorizedAdmin(): Promise<AuthorizedAdmin> {
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    throw new UnauthorizedError("You must be signed in as an authorized administrator.", 401);
  }
  return admin;
}
