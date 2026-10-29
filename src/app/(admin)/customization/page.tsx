import { PageHeader } from "@/components/ui/primitives";
import { CustomizationClient } from "@/app/(admin)/customization/CustomizationClient";

export const dynamic = "force-dynamic";

export default function CustomizationPage() {
  return (
    <div>
      <PageHeader
        title="App Customization"
        description="Avatar, greeting, chat theme and feature visibility — published to the shared configuration."
      />
      <CustomizationClient />
    </div>
  );
}
