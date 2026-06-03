import { BookOpen } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

export default function KnowledgePage() {
  return (
    <>
      <PageHeader title="Knowledge base" description="The documents your AI draws answers from." />
      <EmptyState
        icon={BookOpen}
        title="No documents yet"
        description="Upload PDFs, Word docs, or plain text and Graft will ground every answer in them. Document management arrives in an upcoming release."
      />
    </>
  );
}
