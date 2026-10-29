import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { env, isFirebaseAdminConfigured } from "@/lib/env";

// Lazily initialised Firebase Admin SDK. This file must never be imported
// from client components. It returns `null` handles whenever the service
// account is not configured so callers can render an honest "not connected"
// state instead of crashing the whole dashboard.

type AdminBundle = {
  app: App;
  auth: Auth;
  firestore: Firestore;
  storage: Storage;
  databaseId: string;
};

let cached: AdminBundle | null | undefined;

function decodeServiceAccount(raw: string) {
  // Accept either a raw JSON string or a base64-encoded JSON string so the
  // secret can be stored as a single-line environment variable.
  const trimmed = raw.trim();
  try {
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed);
    }
    const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON or base64-encoded JSON.",
    );
  }
}

export function getFirebaseAdmin(): AdminBundle | null {
  if (cached !== undefined) return cached;

  if (!isFirebaseAdminConfigured) {
    cached = null;
    return cached;
  }

  try {
    const serviceAccount = decodeServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_KEY as string);

    const app =
      getApps().length > 0
        ? getApps()[0]!
        : initializeApp({
            credential: cert(serviceAccount),
            projectId: env.FIREBASE_PROJECT_ID,
            storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          });

    const databaseId = env.FIREBASE_DATABASE_ID;
    const firestore =
      databaseId && databaseId !== "(default)"
        ? getFirestore(app, databaseId)
        : getFirestore(app);

    cached = {
      app,
      auth: getAuth(app),
      firestore,
      storage: getStorage(app),
      databaseId,
    };
    return cached;
  } catch (error) {
    console.error("[firebase-admin] failed to initialise:", error);
    cached = null;
    return cached;
  }
}
