import { Users } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

export default function AgentsPage() {
  return (
    <>
      <PageHeader title="Agents" description="Invite teammates who handle escalated conversations." />
      <EmptyState
        icon={Users}
        title="No agents yet"
        description="Invite support agents by email so they can claim and answer conversations. Agent management arrives in an upcoming release."
      />
    </>
  );
}
