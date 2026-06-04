"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notesApi } from "@/lib/api/notes";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { messageTime } from "./format";

/**
 * Internal notes for a conversation — agent-only, never shown to the customer. A small
 * REST-backed panel (list + add) beside the live thread, so an agent can leave context
 * for whoever picks the conversation up next.
 */
export function NotesPanel({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const notes = useQuery({
    queryKey: queryKeys.notes(conversationId),
    queryFn: () => notesApi.list(conversationId),
  });

  const add = useMutation({
    mutationFn: (content: string) => notesApi.create(conversationId, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notes(conversationId) });
      setDraft("");
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Could not save note."),
  });

  const items = notes.data?.notes ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Internal notes</h3>
        <span className="text-xs text-muted-foreground">Only your team sees these</span>
      </div>

      {notes.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Loading…
        </div>
      ) : items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((note) => (
            <li key={note.id} className="rounded-lg border border-border bg-muted/40 p-2.5 text-sm">
              <p className="whitespace-pre-wrap break-words">{note.content}</p>
              <p className="mt-1 text-[0.7rem] text-muted-foreground">{messageTime(note.createdAt)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex flex-col gap-2">
        <Textarea
          value={draft}
          placeholder="Add a note for your team…"
          rows={2}
          className="resize-none"
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          className="self-end"
          disabled={add.isPending || draft.trim() === ""}
          onClick={() => add.mutate(draft.trim())}
        >
          {add.isPending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </div>
  );
}
