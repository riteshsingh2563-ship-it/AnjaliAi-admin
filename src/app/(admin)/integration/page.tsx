import { PageHeader } from "@/components/ui/primitives";
import { IntegrationClient } from "@/app/(admin)/integration/IntegrationClient";

export const dynamic = "force-dynamic";

export default function IntegrationPage() {
  return (
    <div>
      <PageHeader
        title="Integration & System Status"
        description="Live health checks for PostgreSQL, Firebase Authentication, Cloud Firestore (app_config/ai), and Android sync."
      />
      <IntegrationClient />
    </div>
  );
}
