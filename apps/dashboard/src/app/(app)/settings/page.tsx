import { Settings } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Provider keys, widget appearance, and escalation rules." />
      <EmptyState
        icon={Settings}
        title="Configuration is coming"
        description="Connect your AI provider, customize the chat widget, and tune when conversations escalate to a person. These screens arrive in an upcoming release."
      />
    </>
  );
}
