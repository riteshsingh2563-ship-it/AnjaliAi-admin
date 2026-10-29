import { PageHeader } from "@/components/ui/primitives";
import { AiConfigClient } from "@/app/(admin)/ai-config/AiConfigClient";

export const dynamic = "force-dynamic";

export default function AiConfigPage() {
  return (
    <div>
      <PageHeader
        title="AI Configuration"
        description="Manage the Gemini model, response behaviour, feature flags and usage limits."
      />
      <AiConfigClient />
    </div>
  );
}
