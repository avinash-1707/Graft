import { PageHeader } from "@/components/common/page-header";
import { ConversationsView } from "@/components/conversations/conversations-view";

export default function ConversationsPage() {
  return (
    <>
      <PageHeader title="Conversations" description="Watch live customer conversations and step in when needed." />
      <ConversationsView />
    </>
  );
}
