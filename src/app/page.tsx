import { redirect } from "next/navigation";
import { getAuthorizedAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const admin = await getAuthorizedAdmin();
  redirect(admin ? "/dashboard" : "/login");
}
