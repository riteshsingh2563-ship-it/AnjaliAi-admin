"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, signOut } from "firebase/auth";
import { AlertTriangle, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase-client";
import { Button } from "@/components/ui/primitives";

export function LoginClient({
  firebaseConfigured,
  sessionSecretConfigured,
  projectId,
}: {
  firebaseConfigured: boolean;
  sessionSecretConfigured: boolean;
  projectId: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const setupIncomplete = !firebaseConfigured || !sessionSecretConfigured;

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase is not configured.");
      const result = await signInWithPopup(auth, getGoogleProvider());
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await signOut(auth).catch(() => {});
        throw new Error(data.error ?? "Sign-in was rejected.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-50 via-app-bg to-purple-50 px-4 dark:from-[#1d1522] dark:via-app-bg dark:to-[#1d1522]">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 text-2xl font-bold text-white shadow-lg shadow-pink-500/30">
            A
          </div>
          <h1 className="mt-4 text-xl font-semibold text-app-text">ANJALI Admin</h1>
          <p className="mt-1 text-sm text-app-text-muted">Private control panel — authorized administrators only</p>
        </div>

        <div className="rounded-3xl border border-app-border bg-app-surface p-7 shadow-xl shadow-pink-950/5">
          {setupIncomplete ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Admin login setup required</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    This deployment is missing required configuration, so sign-in is disabled rather
                    than faked. See the checklist below and the project README.
                  </p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <SetupRow
                  ok={firebaseConfigured}
                  label="Firebase client config"
                  detail="Set NEXT_PUBLIC_FIREBASE_API_KEY, _AUTH_DOMAIN, _PROJECT_ID, _APP_ID"
                />
                <SetupRow
                  ok={sessionSecretConfigured}
                  label="ADMIN_SESSION_SECRET"
                  detail="A long random string used to sign admin session cookies"
                />
                <SetupRow
                  ok={Boolean(projectId)}
                  label="FIREBASE_PROJECT_ID"
                  detail={projectId ? `Detected: ${projectId}` : "Required to verify Google sign-in tokens"}
                />
              </ul>
              <p className="text-xs text-app-text-muted">
                Once configured, also add your Google account email to the <code className="rounded bg-app-bg-soft px-1 py-0.5">admin_allowlist</code> table
                (or the <code className="rounded bg-app-bg-soft px-1 py-0.5">ADMIN_EMAILS</code> env var) so your account is authorized.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <Button className="w-full justify-center py-3" onClick={handleGoogleSignIn} loading={loading}>
                {!loading && <GoogleIcon />}
                Continue with Google
              </Button>
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex items-start gap-2 rounded-xl bg-app-bg-soft p-3 text-xs text-app-text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>
                  Access is restricted to Google accounts explicitly authorized by the ANJALI app
                  owner. Every request is re-verified on the server.
                </span>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-app-text-muted">
          <Sparkles className="h-3.5 w-3.5" /> ANJALI — Your Bestie 💕 · Admin Control Center
        </p>
      </div>
    </div>
  );
}

function SetupRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5 rounded-xl border border-app-border p-3">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${ok ? "bg-emerald-500" : "bg-rose-400"}`}
      >
        {ok ? "✓" : "!"}
      </span>
      <span>
        <span className="block font-medium text-app-text">{label}</span>
        <span className="block text-xs text-app-text-muted">{detail}</span>
      </span>
    </li>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8 3l5.7-5.7C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.9 1.1 8 3l5.7-5.7C34.5 6 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C39.9 36.9 44 31.1 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}
