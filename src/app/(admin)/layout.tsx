import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthorizedAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/shell/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Authoritative, server-side authorization check. This runs on every
  // request for every page in this layout group — being logged into
  // Firebase is not enough; the email must also be active in the
  // admin_allowlist table (checked inside getAuthorizedAdmin()).
  const admin = await getAuthorizedAdmin();
  if (!admin) {
    redirect("/login");
  }

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
