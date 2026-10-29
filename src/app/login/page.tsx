import { redirect } from "next/navigation";
import { getAuthorizedAdmin } from "@/lib/admin-auth";
import { isFirebaseClientConfigured, isAdminSessionSecretConfigured, env } from "@/lib/env";
import { LoginClient } from "@/app/login/LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const admin = await getAuthorizedAdmin();
  if (admin) redirect("/dashboard");

  return (
    <LoginClient
      firebaseConfigured={isFirebaseClientConfigured}
      sessionSecretConfigured={isAdminSessionSecretConfigured}
      projectId={env.FIREBASE_PROJECT_ID ?? null}
    />
  );
}
