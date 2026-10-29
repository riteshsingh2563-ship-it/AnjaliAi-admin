import "server-only";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { env } from "@/lib/env";

// Verifies a Firebase Authentication ID token WITHOUT requiring the Firebase
// Admin SDK / a service account. This works because Firebase ID tokens are
// standard signed JWTs; Google publishes the public signing keys, and the
// project id (not a secret) is enough to check the audience/issuer claims.
//
// This lets "verify the admin's identity" work even before a service account
// has been provisioned for this deployment. Privileged operations (Firestore
// sync, managing Android app users, Storage uploads) still require the full
// Admin SDK — see src/lib/firebase-admin.ts.

const GOOGLE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  }
  return jwks;
}

export type VerifiedFirebaseUser = {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

export class FirebaseTokenError extends Error {}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new FirebaseTokenError(
      "FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID) is not configured.",
    );
  }

  let payload;
  try {
    const result = await jwtVerify(idToken, getJwks(), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    payload = result.payload;
  } catch (error) {
    throw new FirebaseTokenError(
      error instanceof Error ? `Invalid ID token: ${error.message}` : "Invalid ID token",
    );
  }

  const uid = String(payload.user_id ?? payload.sub ?? "");
  if (!uid) {
    throw new FirebaseTokenError("ID token does not contain a valid user ID.");
  }

  const email = typeof payload.email === "string" ? payload.email : undefined;

  return {
    uid,
    email,
    emailVerified: Boolean(payload.email_verified),
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}
