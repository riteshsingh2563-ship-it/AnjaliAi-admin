# ANJALI AI — Admin Dashboard (`admin-dashboard`)

Production Next.js Admin Dashboard for the **ANJALI — Your Bestie** Android application.

- **Production URL:** `https://anjalia.vercel.app`
- **Firebase Project ID:** `gen-lang-client-0553500643`
- **Cloud Firestore Named Database ID:** `ai-studio-android-anjaliai-af35263e-02d3-4218-b283-00d5976cfc2d`
- **Shared Live Configuration Document:** `app_config/ai`
- **AI Provider Endpoint:** `https://integrate.api.nvidia.com/v1/chat/completions`

---

## 1. Required Environment Variables (Vercel)

Configure these in **Vercel → Project (`anjalia`) → Settings → Environment Variables**:

| Variable Name | Scope | Required | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Server | **Yes** | Neon PostgreSQL connection string (`postgresql://...`) |
| `ADMIN_SESSION_SECRET` | Server | **Yes** | 32+ character random secret for signing HTTP-only admin session cookies |
| `ADMIN_EMAILS` | Server | **Yes** | Comma-separated list of authorized admin Google emails (e.g., `riteshsingh2563@gmail.com`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public | **Yes** | Firebase Web SDK API Key (for Google Sign-In on `/login`) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public | **Yes** | `gen-lang-client-0553500643.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public | **Yes** | `gen-lang-client-0553500643` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public | **Yes** | Firebase Web App ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public | Optional | `gen-lang-client-0553500643.firebasestorage.app` |
| `NEXT_PUBLIC_APP_URL` | Public | Optional | `https://anjalia.vercel.app` |
| `FIREBASE_PROJECT_ID` | Server | **Yes** | `gen-lang-client-0553500643` |
| `FIREBASE_DATABASE_ID` | Server | **Yes** | `ai-studio-android-anjaliai-af35263e-02d3-4218-b283-00d5976cfc2d` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Server | **Yes** | Raw JSON string or base64-encoded JSON of your Firebase Admin Service Account key (or set `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`) |
| `NVIDIA_API_KEY` | Server | **Yes** | Server-side NVIDIA AI API key (`nvapi-...`) for `/api/ai/chat` |
| `NVIDIA_API_ENDPOINT` | Server | Optional | Defaults to `https://integrate.api.nvidia.com/v1/chat/completions` |
| `NVIDIA_MODEL` | Server | Optional | Defaults to `google/gemma-4-31b-it` |
| `USAGE_INGEST_API_KEY` | Server | Optional | Optional shared secret for server-to-server `POST /api/usage/ingest` (Android app users authenticate automatically via Firebase ID tokens) |

---

## 2. Database Schema & Non-Destructive Migrations (Neon PostgreSQL)

1. **Automatic Non-Destructive Schema Sync (`src/db/init.ts`):**
   - Every server cold-start automatically runs `ensureDatabaseSchema()`, which executes `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE UNIQUE INDEX IF NOT EXISTS` for all 7 tables (`admin_allowlist`, `personality_config`, `ai_config`, `app_customization`, `general_settings`, `audit_logs`, `usage_logs`) and seeds `admin_allowlist` from `ADMIN_EMAILS` with `ON CONFLICT ("email") DO NOTHING`.
   - Existing production rows are **never** dropped, truncated, or overwritten.
2. **Manual SQL Migrations (Optional):**
   - `drizzle/0000_initial_schema.sql` — Full idempotent schema creation.
   - `drizzle/0001_nvidia_and_usage_enhancements.sql` — Incremental non-destructive migration for existing databases.

---

## 3. Deploying from Your Android Phone to Vercel

1. **Push or Upload to GitHub:**
   - In Google AI Studio, tap the **GitHub** icon in the top toolbar to push the repository to your GitHub account (or download the ZIP and upload the contents of `admin-dashboard/` to your GitHub repo via the GitHub mobile browser).
2. **Configure Vercel Root Directory:**
   - Open `https://vercel.com` in Chrome on your Android phone and open your project (`anjalia`).
   - Go to **Settings → General → Root Directory**:
     - If your GitHub repository contains the full workspace (both Android app and `admin-dashboard`), set **Root Directory** to `admin-dashboard`.
     - If your GitHub repository contains only the contents of `admin-dashboard` at its root, leave **Root Directory** blank (`.`).
3. **Verify Environment Variables:**
   - Go to **Settings → Environment Variables** and ensure `DATABASE_URL`, `ADMIN_SESSION_SECRET`, `ADMIN_EMAILS`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `NVIDIA_API_KEY`, and the `NEXT_PUBLIC_FIREBASE_*` variables are set.
4. **Redeploy:**
   - Tap **Deployments** → tap the **⋮ (three dots)** next to the latest deployment → tap **Redeploy**.
5. **Verify Live Status:**
   - Sign in at `https://anjalia.vercel.app/login`, open **Integration Status** (`/integration`) to confirm PostgreSQL, Firebase Admin/Firestore, and NVIDIA AI are all green, and tap **Test AI connection** on the **AI Configuration** (`/ai-config`) page to verify live token usage recording.
