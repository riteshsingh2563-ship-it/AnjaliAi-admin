# ANJALI AI — Admin Dashboard

Private Next.js administration panel for the **ANJALI • Your Bestie** Android companion app.

## Architecture Overview

1. **Authentication & Server-Side Authorization**
   - Admins sign in with Google on `/login` using the client Firebase SDK (`firebase/auth`).
   - `POST /api/auth/session` verifies the Firebase ID token server-side via Google's public JWKS (`src/lib/verifyFirebaseToken.ts`) against `FIREBASE_PROJECT_ID` (`gen-lang-client-0553500643`).
   - The verified email is checked against the PostgreSQL `admin_allowlist` table (`src/lib/admin-auth.ts`). If `admin_allowlist` is empty on first boot, it automatically seeds from the `ADMIN_EMAILS` environment variable (`src/lib/bootstrap-admins.ts`).
   - Every protected page (`src/app/(admin)/layout.tsx`) and API route calls `requireAuthorizedAdmin()` on the server, re-checking both the signed `anjali_admin_session` HTTP-only cookie and `admin_allowlist.active = true`.

2. **PostgreSQL + Drizzle ORM (`src/db/schema.ts`)**
   - Stores authoritative dashboard state across 7 tables:
     - `admin_allowlist` — authorized admin emails and roles (`owner` / `admin`)
     - `personality_config` — Anjali's persona, traits, tone, greeting, and system instructions
     - `ai_config` — AI model selection, temperature, max output tokens, languages, feature flags, and fallback rules
     - `app_customization` — display name, avatar URL, welcome message, theme colors, announcement banner, and feature toggles
     - `general_settings` — app display name, default language, maintenance mode, and retention settings
     - `audit_logs` — immutable audit trail of every admin login and configuration update
     - `usage_logs` — AI request telemetry reported via `POST /api/usage/ingest`

3. **Cloud Firestore Sync (`src/lib/sync-firestore.ts`)**
   - Connects server-side via `firebase-admin/firestore` to project `gen-lang-client-0553500643` and named database:
     `ai-studio-android-anjaliai-af35263e-02d3-4218-b283-00d5976cfc2d`
   - Every time an admin saves changes on **Personality**, **AI Configuration**, **App Customization**, or **General Settings**, the server writes a unified document to:
     - `app_config/ai` (listened to in real time by the Android app's `observeBackendAppConfig()`)
     - `app_config/personality`, `app_config/model`, `app_config/customization`, and `app_config/general`

---

## Required Environment Variables

Copy `.env.example` to `.env.local` (for local development) or configure these in **Vercel → Project Settings → Environment Variables**:

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | Server-only | PostgreSQL connection string (e.g. Neon, Supabase, or Vercel Postgres) |
| `ADMIN_SESSION_SECRET` | Server-only | Random 32+ character string (`openssl rand -hex 32`) used to sign session cookies |
| `ADMIN_EMAILS` | Server-only | Comma-separated Google emails seeded into `admin_allowlist` on first login (e.g. `riteshsingh2563@gmail.com`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public | Firebase Web API key for `gen-lang-client-0553500643` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public | `gen-lang-client-0553500643.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public | `gen-lang-client-0553500643` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public | Firebase App ID (`1:833479988539:android:108970847125f7f2f6d31e` or Web App ID) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public | `gen-lang-client-0553500643.firebasestorage.app` |
| `FIREBASE_PROJECT_ID` | Server-only | `gen-lang-client-0553500643` |
| `FIREBASE_DATABASE_ID` | Server-only | `ai-studio-android-anjaliai-af35263e-02d3-4218-b283-00d5976cfc2d` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Server-only | Base64-encoded JSON (or raw JSON) of a Firebase Admin Service Account key |
| `USAGE_INGEST_API_KEY` | Server-only | Optional shared secret for `POST /api/usage/ingest` |

---

## Database Setup & Migration

1. Provision a PostgreSQL database (Neon, Supabase, or Vercel Postgres) and set `DATABASE_URL`.
2. Push the Drizzle schema to your PostgreSQL database:
   ```bash
   npm run db:push
   ```
   *(Alternatively, execute `drizzle/0000_initial_schema.sql` directly in your SQL editor.)*

---

## Deploying to GitHub & Vercel

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "chore: production-ready Anjali AI Admin Dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
2. **Import into Vercel**
   - Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.
   - Framework Preset: **Next.js** (detected automatically).
   - Add all environment variables from `.env.example` under **Environment Variables**.
   - Click **Deploy**.
3. **Authorize Your Vercel Domain in Firebase Auth**
   - Open [Firebase Console → Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/gen-lang-client-0553500643/authentication/settings).
   - Add your Vercel domain (e.g. `your-dashboard.vercel.app`) so Google Sign-In popups are permitted.
