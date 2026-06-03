import { MessagesSquare } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

export default function ConversationsPage() {
  return (
    <>
      <PageHeader title="Conversations" description="Watch live customer conversations and step in when needed." />
      <EmptyState
        icon={MessagesSquare}
        title="The live feed is coming"
        description="A realtime view of every active conversation, with the option to claim and reply, arrives in an upcoming release."
      />
    </>
  );
}
