import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS } from "@/lib/constants";
import { env } from "@/lib/env";

export type AdminSessionPayload = {
  email: string;
  name?: string;
  picture?: string;
  role: string;
};

function getSecretKey(): Uint8Array {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET is not configured. Set a long random string in your environment before enabling admin login.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createAdminSessionToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAdminSessionToken(
  token: string,
): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.email !== "string" || typeof payload.role !== "string") return null;
    return {
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function getAdminSessionFromCookies(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

export { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS };
