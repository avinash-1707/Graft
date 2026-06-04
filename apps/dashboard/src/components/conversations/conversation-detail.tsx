"use client";

import { useState } from "react";
import type { OrgFeedConversation } from "@graft/shared";
import { ArrowLeft, CornerUpLeft, StickyNote, X } from "lucide-react";

import type { ChatIdentity, ChatSocketApi } from "@/lib/hooks/use-chat-socket";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StateBadge } from "./state-badge";
import { MessageThread } from "./message-thread";
import { Composer } from "./composer";
import { NotesPanel } from "./notes-panel";
import { sessionLabel } from "./format";

/**
 * The selected conversation: live thread plus the agent controls — claim (atomic; an
 * "already claimed" loss is surfaced immediately and the feed relabels the card),
 * handback to the AI, the message composer (enabled only once this agent owns the
 * conversation), and the internal-notes panel. Conversation *state* comes from the org
 * feed, so the buttons reconcile the instant another agent claims.
 */
export function ConversationDetail({
  conversation,
  me,
  socket,
  onBack,
}: {
  conversation: OrgFeedConversation;
  me: ChatIdentity;
  socket: ChatSocketApi;
  onBack: () => void;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const isMine = conversation.assignedAgentId === me.id;
  const unassigned = conversation.assignedAgentId === null;
  const canClaim =
    unassigned &&
    (conversation.state === "ESCALATION_PENDING" || conversation.state === "AI_ACTIVE");
  const canChat =
    isMine &&
    (conversation.state === "AGENT_ASSIGNED" || conversation.state === "HUMAN_ACTIVE");
  const canHandback = isMine && conversation.state === "HUMAN_ACTIVE";

  async function handleClaim() {
    setBusy(true);
    setActionError(null);
    const res = await socket.claim(conversation.id);
    setBusy(false);
    if (!res.ok) {
      setActionError(
        res.reason === "ALREADY_CLAIMED"
          ? "Another agent claimed this conversation first."
          : "Could not claim this conversation.",
      );
    }
  }

  async function handleHandback() {
    setBusy(true);
    setActionError(null);
    const ok = await socket.handback(conversation.id);
    setBusy(false);
    if (!ok) setActionError("Could not hand this conversation back.");
  }

  const composerPlaceholder = isMine
    ? "Type a reply…"
    : unassigned
      ? "Claim this conversation to reply"
      : "Another agent is handling this conversation";

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex shrink-0 items-center gap-3 border-b border-border p-3 sm:p-4">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Back" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{sessionLabel(conversation.sessionId)}</p>
          <div className="mt-0.5">
            <StateBadge state={conversation.state} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canClaim ? (
            <Button size="sm" disabled={busy} onClick={() => void handleClaim()}>
              {busy ? "Claiming…" : "Claim"}
            </Button>
          ) : null}
          {canHandback ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleHandback()}>
              <CornerUpLeft /> Hand back
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden"
            aria-label="Toggle notes"
            onClick={() => setNotesOpen((o) => !o)}
          >
            <StickyNote />
          </Button>
        </div>
      </header>

      {actionError ? (
        <div className="px-4 pt-3">
          <Alert>{actionError}</Alert>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <MessageThread
            messages={socket.messagesFor(conversation.id)}
            customerTyping={socket.customerTyping(conversation.id)}
          />
          <Composer
            disabled={!canChat}
            placeholder={composerPlaceholder}
            onSend={async (content) => {
              await socket.send(conversation.id, content, me);
            }}
            onTyping={(t) => socket.setTyping(conversation.id, t)}
          />
        </div>

        {/* Persistent notes column on wide screens. */}
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border p-4 xl:block">
          <NotesPanel conversationId={conversation.id} />
        </aside>
      </div>

      {/* Notes overlay for narrow screens. */}
      <aside
        className={cn(
          "absolute inset-y-0 right-0 z-10 w-80 max-w-[85%] overflow-y-auto border-l border-border bg-card p-4 shadow-xl transition-transform xl:hidden",
          notesOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!notesOpen}
      >
        <div className="mb-2 flex justify-end">
          <Button variant="ghost" size="icon" aria-label="Close notes" onClick={() => setNotesOpen(false)}>
            <X />
          </Button>
        </div>
        <NotesPanel conversationId={conversation.id} />
      </aside>
    </div>
  );
}
