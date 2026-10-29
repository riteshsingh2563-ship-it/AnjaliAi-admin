// Centralised, explicit view of which optional integrations are configured.
// Nothing in this file throws — every page/API route is expected to check
// these flags and render an honest "not configured" state instead of
// pretending a feature works.

function val(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export const DEFAULT_FIREBASE_PROJECT_ID = "gen-lang-client-0553500643";
export const DEFAULT_FIRESTORE_DATABASE_ID =
  "ai-studio-android-anjaliai-af35263e-02d3-4218-b283-00d5976cfc2d";

export const env = {
  DATABASE_URL: val("DATABASE_URL"),

  // Session signing secret for the admin dashboard's own short-lived cookie
  // session (issued only after a Firebase ID token has been verified AND the
  // email matched the admin allowlist).
  ADMIN_SESSION_SECRET: val("ADMIN_SESSION_SECRET"),

  // Comma separated list of emails to seed into admin_allowlist on first run.
  ADMIN_EMAILS: val("ADMIN_EMAILS"),

  // Public Firebase client config — safe to expose to the browser, required
  // for Firebase Authentication (Google Sign-In) to work on the login page.
  NEXT_PUBLIC_FIREBASE_API_KEY: val("NEXT_PUBLIC_FIREBASE_API_KEY"),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: val("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:
    val("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? DEFAULT_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: val("NEXT_PUBLIC_FIREBASE_APP_ID"),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: val("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),

  // Server-only Firebase project id used to validate ID token audience/issuer.
  // Falls back to the public project id since the project id itself is not a
  // secret (it is visible inside every Firebase client config).
  FIREBASE_PROJECT_ID:
    val("FIREBASE_PROJECT_ID") ??
    val("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ??
    DEFAULT_FIREBASE_PROJECT_ID,

  // Named Cloud Firestore database ID shared with the Android application.
  FIREBASE_DATABASE_ID:
    val("FIREBASE_DATABASE_ID") ??
    val("NEXT_PUBLIC_FIREBASE_DATABASE_ID") ??
    DEFAULT_FIRESTORE_DATABASE_ID,

  // Server-only Firebase Admin SDK service account (raw JSON or base64-encoded JSON).
  // Required for: Firestore config sync, listing/managing Android app users
  // via Firebase Authentication, and Firebase Storage uploads.
  FIREBASE_SERVICE_ACCOUNT_KEY: val("FIREBASE_SERVICE_ACCOUNT_KEY"),

  // Shared secret used by trusted server-to-server callers (e.g. a Cloud
  // Function invoked by the Android app) to report AI usage events.
  USAGE_INGEST_API_KEY: val("USAGE_INGEST_API_KEY"),
};

export const isFirebaseClientConfigured = Boolean(
  env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    env.NEXT_PUBLIC_FIREBASE_APP_ID,
);

export const isFirebaseAdminConfigured = Boolean(
  env.FIREBASE_SERVICE_ACCOUNT_KEY && env.FIREBASE_PROJECT_ID,
);

export const isUsageIngestConfigured = Boolean(env.USAGE_INGEST_API_KEY);

export const isAdminSessionSecretConfigured = Boolean(env.ADMIN_SESSION_SECRET);
