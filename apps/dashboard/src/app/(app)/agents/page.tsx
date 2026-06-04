import { PageHeader } from "@/components/common/page-header";
import { AgentsManager } from "@/components/agents/agents-manager";

export default function AgentsPage() {
  return (
    <>
      <PageHeader title="Agents" description="Invite teammates who handle escalated conversations." />
      <AgentsManager />
    </>
  );
}
