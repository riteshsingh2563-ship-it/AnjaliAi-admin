import "server-only";
import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { env, isFirebaseAdminConfigured } from "@/lib/env";

// Lazily initialised Firebase Admin SDK. This file is strictly server-only
// and never imported from client components. It supports both a full JSON /
// base64-encoded JSON service account in FIREBASE_SERVICE_ACCOUNT_KEY and
// split FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY variables.

type AdminBundle = {
  app: App;
  auth: Auth;
  firestore: Firestore;
  storage: Storage;
  databaseId: string;
};

let cached: AdminBundle | null = null;

function normalizePrivateKey(key: string): string {
  let clean = key.trim();
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1);
  }
  return clean.replace(/\\n/g, "\n");
}

function resolveServiceAccount(): ServiceAccount {
  if (env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    let trimmed = env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      trimmed = trimmed.slice(1, -1).trim();
    }

    let parsed: Record<string, unknown>;
    try {
      if (trimmed.startsWith("{")) {
        parsed = JSON.parse(trimmed) as Record<string, unknown>;
      } else {
        const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
        parsed = JSON.parse(decoded) as Record<string, unknown>;
      }
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON or base64-encoded JSON.",
      );
    }

    const privateKeyRaw =
      typeof parsed.private_key === "string"
        ? parsed.private_key
        : typeof parsed.privateKey === "string"
          ? parsed.privateKey
          : "";
    const clientEmail =
      typeof parsed.client_email === "string"
        ? parsed.client_email
        : typeof parsed.clientEmail === "string"
          ? parsed.clientEmail
          : "";
    const projectId =
      typeof parsed.project_id === "string"
        ? parsed.project_id
        : typeof parsed.projectId === "string"
          ? parsed.projectId
          : env.FIREBASE_PROJECT_ID;

    if (!privateKeyRaw || !clientEmail) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is missing client_email or private_key.",
      );
    }

    return {
      projectId,
      clientEmail,
      privateKey: normalizePrivateKey(privateKeyRaw),
    };
  }

  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL.trim(),
      privateKey: normalizePrivateKey(env.FIREBASE_PRIVATE_KEY),
    };
  }

  throw new Error("Firebase Admin credentials are not configured.");
}

export function getFirebaseAdmin(): AdminBundle | null {
  if (cached) return cached;

  if (!isFirebaseAdminConfigured) {
    return null;
  }

  try {
    const serviceAccount = resolveServiceAccount();
    const projectId = serviceAccount.projectId || env.FIREBASE_PROJECT_ID;

    const app =
      getApps().length > 0
        ? getApps()[0]!
        : initializeApp({
            credential: cert(serviceAccount),
            projectId,
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
    const message =
      error instanceof Error ? error.message : "Unknown initialization error";
    console.error("[firebase-admin] failed to initialise:", message);
    return null;
  }
}
