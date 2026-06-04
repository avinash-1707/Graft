import { PageHeader } from "@/components/common/page-header";
import { ConversationFeed } from "@/components/conversations/conversation-feed";

export default function ConversationsPage() {
  return (
    <>
      <PageHeader title="Conversations" description="Watch live customer conversations in realtime." />
      <ConversationFeed />
    </>
  );
}
