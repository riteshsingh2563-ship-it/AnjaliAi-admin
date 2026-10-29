import { PageHeader } from "@/components/ui/primitives";
import { SettingsClient } from "@/app/(admin)/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="General Settings"
        description="App-wide configuration, maintenance mode, and chat data controls."
      />
      <SettingsClient />
    </div>
  );
}
