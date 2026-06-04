"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  messageSchema,
  type ChatMessageAck,
  type ClaimResult,
  type Message,
  type ServerEvent,
} from "@graft/shared";

import { ChatSocket, type ChatStatus } from "@/lib/realtime/chat-socket";

/** Identity needed to render an agent's own outgoing message (the ack carries only the sequence). */
export interface ChatIdentity {
  id: string;
  organizationId: string;
}

export interface ChatSocketApi {
  status: ChatStatus;
  /** Messages for a conversation, oldest-first (replay + live, deduped by sequence). */
  messagesFor: (conversationId: string) => Message[];
  /** Whether the customer is currently typing in a conversation. */
  customerTyping: (conversationId: string) => boolean;
  /** Joins a room (full history) and starts observing it. Idempotent per conversation. */
  open: (conversationId: string) => void;
  claim: (conversationId: string) => Promise<ClaimResult>;
  send: (conversationId: string, content: string, me: ChatIdentity) => Promise<ChatMessageAck>;
  handback: (conversationId: string) => Promise<boolean>;
  setTyping: (conversationId: string, isTyping: boolean) => void;
}

function lastSequenceOf(messages: Message[]): number {
  return messages.length > 0 ? messages[messages.length - 1]!.sequence : 0;
}

/** Inserts a message keeping the array sorted + deduped by per-conversation sequence. */
function mergeMessage(list: Message[], message: Message): Message[] {
  const idx = list.findIndex((m) => m.sequence === message.sequence);
  if (idx !== -1) return list;
  const next = [...list, message];
  next.sort((a, b) => a.sequence - b.sequence);
  return next;
}

/**
 * Manages the agent's persistent chat socket (unit 28) and reduces its events into
 * per-conversation message threads + typing state. Opens on mount, re-joins open rooms
 * on every reconnect (with the current cursor, so replay closes the gap, invariant 11),
 * and exposes the claim/send/handback/typing actions. Conversation *state* is owned by
 * the org feed (unit 27); this hook owns the message thread.
 */
export function useChatSocket(): ChatSocketApi {
  const [status, setStatus] = useState<ChatStatus>("connecting");
  const socketRef = useRef<ChatSocket | null>(null);
  const messagesRef = useRef<Map<string, Message[]>>(new Map());
  const typingRef = useRef<Map<string, boolean>>(new Map());
  const openRef = useRef<Set<string>>(new Set());
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const setMessages = useCallback(
    (conversationId: string, next: Message[]) => {
      messagesRef.current.set(conversationId, next);
      bump();
    },
    [bump],
  );

  useEffect(() => {
    const handleEvent = (event: ServerEvent): void => {
      if (event.type === "message_appended") {
        const id = event.message.conversationId;
        setMessages(id, mergeMessage(messagesRef.current.get(id) ?? [], event.message));
      } else if (event.type === "replay_batch") {
        let list = messagesRef.current.get(event.conversationId) ?? [];
        for (const m of event.messages) list = mergeMessage(list, m);
        setMessages(event.conversationId, list);
      } else if (event.type === "typing" && event.from === "CUSTOMER") {
        typingRef.current.set(event.conversationId, event.isTyping);
        bump();
      }
      // state_changed is intentionally ignored: the org feed (unit 27) is the state source.
    };

    const socket = new ChatSocket({
      onEvent: handleEvent,
      onStatus: setStatus,
      onReconnect: () => {
        for (const id of openRef.current) {
          void socket.join(id, lastSequenceOf(messagesRef.current.get(id) ?? [])).catch(() => {});
        }
      },
    });
    socket.connect();
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [setMessages]);

  const open = useCallback((conversationId: string) => {
    if (openRef.current.has(conversationId)) return;
    openRef.current.add(conversationId);
    const socket = socketRef.current;
    if (!socket) return;
    void socket
      .join(conversationId, lastSequenceOf(messagesRef.current.get(conversationId) ?? []))
      .catch(() => {});
  }, []);

  const claim = useCallback((conversationId: string): Promise<ClaimResult> => {
    const socket = socketRef.current;
    if (!socket) return Promise.resolve({ ok: false, reason: "INVALID_STATE" });
    return socket.claim(conversationId);
  }, []);

  const send = useCallback(
    async (conversationId: string, content: string, me: ChatIdentity): Promise<ChatMessageAck> => {
      const socket = socketRef.current;
      if (!socket) return { ok: false, reason: "INTERNAL" };
      const clientNonce = crypto.randomUUID();
      const ack = await socket.send(conversationId, content, clientNonce);
      if (ack.ok && !ack.deduped) {
        // The server relays the row only to the OTHER participant; render our own from the
        // ack (the authoritative sequence) so the bubble appears immediately.
        const optimistic = messageSchema.parse({
          id: crypto.randomUUID(),
          organizationId: me.organizationId,
          conversationId,
          sequence: ack.sequence,
          role: "AGENT",
          content,
          senderAgentId: me.id,
          createdAt: new Date().toISOString(),
        });
        setMessages(conversationId, mergeMessage(messagesRef.current.get(conversationId) ?? [], optimistic));
      }
      return ack;
    },
    [setMessages],
  );

  const handback = useCallback(async (conversationId: string): Promise<boolean> => {
    const socket = socketRef.current;
    if (!socket) return false;
    const ack = await socket.handback(conversationId);
    return ack.ok;
  }, []);

  const setTyping = useCallback((conversationId: string, isTyping: boolean) => {
    socketRef.current?.setTyping(conversationId, isTyping);
  }, []);

  const messagesFor = useCallback((conversationId: string): Message[] => {
    return messagesRef.current.get(conversationId) ?? [];
  }, []);

  const customerTyping = useCallback((conversationId: string): boolean => {
    return typingRef.current.get(conversationId) ?? false;
  }, []);

  return { status, messagesFor, customerTyping, open, claim, send, handback, setTyping };
}
