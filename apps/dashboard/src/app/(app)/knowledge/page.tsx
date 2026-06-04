import { PageHeader } from "@/components/common/page-header";
import { KnowledgeManager } from "@/components/knowledge/knowledge-manager";

export default function KnowledgePage() {
  return (
    <>
      <PageHeader title="Knowledge base" description="The documents your AI draws answers from." />
      <KnowledgeManager />
    </>
  );
}
