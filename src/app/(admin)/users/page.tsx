import { PageHeader } from "@/components/ui/primitives";
import { UsersClient } from "@/app/(admin)/users/UsersClient";

export const dynamic = "force-dynamic";

export default function UsersPage() {
  return (
    <div>
      <PageHeader
        title="User Management"
        description="Accounts from Firebase Authentication. Private chat contents are never shown here."
      />
      <UsersClient />
    </div>
  );
}
