// Centralised, explicit view of which integrations are configured.
// Nothing in this file throws — every page/API route checks these flags
// and renders an honest state rather than crashing or faking results.

function val(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export const DEFAULT_FIREBASE_PROJECT_ID = "gen-lang-client-0553500643";
export const DEFAULT_FIRESTORE_DATABASE_ID =
  "ai-studio-android-anjaliai-af35263e-02d3-4218-b283-00d5976cfc2d";
export const DEFAULT_NVIDIA_API_ENDPOINT =
  "https://integrate.api.nvidia.com/v1/chat/completions";
export const DEFAULT_NVIDIA_MODEL = "google/gemma-4-31b-it";
export const DEFAULT_BACKEND_URL = "https://anjalia.vercel.app";

export const env = {
  // Supports standard DATABASE_URL as well as Vercel/Neon integration aliases
  DATABASE_URL:
    val("DATABASE_URL") ??
    val("POSTGRES_URL") ??
    val("NEON_DATABASE_URL"),

  // Session signing secret for the admin dashboard's HTTP-only cookie session
  ADMIN_SESSION_SECRET: val("ADMIN_SESSION_SECRET"),

  // Comma-separated list of emails to seed into admin_allowlist
  ADMIN_EMAILS: val("ADMIN_EMAILS"),

  // Public Firebase Web SDK configuration (used on /login for Google Sign-In)
  NEXT_PUBLIC_FIREBASE_API_KEY: val("NEXT_PUBLIC_FIREBASE_API_KEY"),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: val("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:
    val("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ?? DEFAULT_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: val("NEXT_PUBLIC_FIREBASE_APP_ID"),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: val("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  NEXT_PUBLIC_APP_URL: val("NEXT_PUBLIC_APP_URL") ?? DEFAULT_BACKEND_URL,

  // Server-only Firebase project ID
  FIREBASE_PROJECT_ID:
    val("FIREBASE_PROJECT_ID") ??
    val("NEXT_PUBLIC_FIREBASE_PROJECT_ID") ??
    DEFAULT_FIREBASE_PROJECT_ID,

  // Named Cloud Firestore database ID shared with the Android application
  FIREBASE_DATABASE_ID:
    val("FIREBASE_DATABASE_ID") ??
    val("NEXT_PUBLIC_FIREBASE_DATABASE_ID") ??
    DEFAULT_FIRESTORE_DATABASE_ID,

  // Server-only Firebase Admin credentials:
  // Supports either a single JSON/base64 string in FIREBASE_SERVICE_ACCOUNT_KEY
  // OR separate FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY variables.
  FIREBASE_SERVICE_ACCOUNT_KEY: val("FIREBASE_SERVICE_ACCOUNT_KEY"),
  FIREBASE_CLIENT_EMAIL:
    val("FIREBASE_CLIENT_EMAIL") ?? val("FIREBASE_ADMIN_CLIENT_EMAIL"),
  FIREBASE_PRIVATE_KEY:
    val("FIREBASE_PRIVATE_KEY") ?? val("FIREBASE_ADMIN_PRIVATE_KEY"),

  // Server-only NVIDIA AI provider configuration
  NVIDIA_API_KEY: val("NVIDIA_API_KEY"),
  NVIDIA_API_ENDPOINT:
    val("NVIDIA_API_ENDPOINT") ?? DEFAULT_NVIDIA_API_ENDPOINT,
  NVIDIA_MODEL: val("NVIDIA_MODEL") ?? DEFAULT_NVIDIA_MODEL,

  // Shared secret used by server-to-server callers to report AI usage events
  // (Android clients can also authenticate via Firebase ID Token).
  USAGE_INGEST_API_KEY: val("USAGE_INGEST_API_KEY"),
};

export const isFirebaseClientConfigured = Boolean(
  env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    env.NEXT_PUBLIC_FIREBASE_APP_ID,
);

export const isFirebaseAdminConfigured = Boolean(
  env.FIREBASE_PROJECT_ID &&
    (env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY)),
);

export const isUsageIngestConfigured = Boolean(
  env.USAGE_INGEST_API_KEY || env.FIREBASE_PROJECT_ID,
);

export const isAdminSessionSecretConfigured = Boolean(env.ADMIN_SESSION_SECRET);
