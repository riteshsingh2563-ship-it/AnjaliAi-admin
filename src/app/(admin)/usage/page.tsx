import { PageHeader } from "@/components/ui/primitives";
import { UsageClient } from "@/app/(admin)/usage/UsageClient";

export const dynamic = "force-dynamic";

export default function UsagePage() {
  return (
    <div>
      <PageHeader
        title="AI Usage & Limits"
        description="Real recorded request activity. Costs are estimates and clearly labelled as such."
      />
      <UsageClient />
    </div>
  );
}
