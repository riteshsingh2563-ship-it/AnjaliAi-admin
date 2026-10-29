import { PageHeader } from "@/components/ui/primitives";
import { DashboardClient } from "@/app/(admin)/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A live, honest snapshot of ANJALI — only real recorded data is shown."
      />
      <DashboardClient />
    </div>
  );
}
