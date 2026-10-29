import { PageHeader } from "@/components/ui/primitives";
import { PersonalityClient } from "@/app/(admin)/personality/PersonalityClient";

export const dynamic = "force-dynamic";

export default function PersonalityPage() {
  return (
    <div>
      <PageHeader
        title="Anjali Personality"
        description="Configure the character, tone and system instructions the Android app's AI companion uses."
      />
      <PersonalityClient />
    </div>
  );
}
