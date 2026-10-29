import { PageHeader } from "@/components/ui/primitives";
import { AuditLogsClient } from "@/app/(admin)/audit-logs/AuditLogsClient";

export const dynamic = "force-dynamic";

export default function AuditLogsPage() {
  return (
    <div>
      <PageHeader
        title="Admin Activity"
        description="Complete audit log of administrative sign-ins and configuration updates."
      />
      <AuditLogsClient />
    </div>
  );
}
