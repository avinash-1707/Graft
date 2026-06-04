"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";

import { kbApi } from "@/lib/api/kb";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { EmptyState } from "@/components/common/empty-state";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { UploadDropzone } from "./upload-dropzone";
import { DocumentRow } from "./document-row";
import { MAX_UPLOAD_BYTES } from "./format";

export function KnowledgeManager() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const docs = useQuery({
    queryKey: queryKeys.kbDocuments,
    queryFn: kbApi.list,
    // Poll only while something is still ingesting, so status flips without a refresh.
    refetchInterval: (query) => {
      const inFlight = query.state.data?.documents.some(
        (d) => d.status === "PENDING" || d.status === "PROCESSING",
      );
      return inFlight ? 3000 : false;
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => kbApi.upload(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.kbDocuments });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Upload failed."),
  });

  function handleFile(file: File) {
    setError(null);
    if (file.size === 0) {
      setError("That file is empty.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That file is larger than 25 MB.");
      return;
    }
    upload.mutate(file);
  }

  const documents = docs.data?.documents ?? [];

  return (
    <div className="space-y-6">
      <UploadDropzone onFile={handleFile} pending={upload.isPending} />
      {error ? <Alert>{error}</Alert> : null}

      {docs.isPending ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Loading documents…
        </div>
      ) : docs.isError ? (
        <Alert>Could not load documents.</Alert>
      ) : documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((doc, i) => (
            <DocumentRow key={doc.id} doc={doc} index={i} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No documents yet"
          description="Upload PDFs, Word docs, or plain text and Graft will ground every answer in them."
        />
      )}
    </div>
  );
}
