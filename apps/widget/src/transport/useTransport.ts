import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ConversationState,
  MessageRole,
  MIN_MESSAGE_SEQUENCE,
  type Message,
  type ServerEvent,
} from '@graft/shared';
import type { ResolvedWidgetConfig } from '../config';
import { getOrCreateSessionId, setSessionId } from '../session';
import {
  responderForState,
  type ConnectionStatus,
  type Responder,
  type WidgetMessage,
} from '../types';
import { fetchConversation, mintSession, type ApiConfig } from './api';
import { TransportManager } from './manager';

const GREETING_ID = 'greeting';
/** Transient bubbles (optimistic customer, streaming AI) sort after every real message. */
const STREAMING_SEQUENCE = Number.MAX_SAFE_INTEGER;

interface ChatState {
  messages: WidgetMessage[];
  /** Optimistic customer bubbles awaiting their server echo. */
  pending: WidgetMessage[];
  streaming: { id: string; content: string } | null;
  conversationState: ConversationState;
}

type ChatAction =
  | { type: 'seed'; messages: WidgetMessage[]; state: ConversationState }
  | { type: 'optimistic'; id: string; content: string }
  | { type: 'localAppend'; message: WidgetMessage }
  | { type: 'event'; event: ServerEvent };

function toWidgetMessage(message: Message): WidgetMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    sequence: message.sequence,
  };
}

/** Inserts/replaces by sequence and keeps the list ordered (rule 2 already deduped upstream). */
function upsertBySequence(messages: WidgetMessage[], next: WidgetMessage): WidgetMessage[] {
  const without = messages.filter((m) => m.sequence !== next.sequence);
  return [...without, next].sort((a, b) => a.sequence - b.sequence);
}

function reduce(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'seed':
      return {
        messages: action.messages,
        pending: [],
        streaming: null,
        conversationState: action.state,
      };

    case 'optimistic':
      return {
        ...state,
        pending: [
          ...state.pending,
          {
            id: action.id,
            role: MessageRole.CUSTOMER,
            content: action.content,
            sequence: STREAMING_SEQUENCE,
            pending: true,
          },
        ],
      };

    case 'localAppend':
      return { ...state, messages: upsertBySequence(state.messages, action.message) };

    case 'event': {
      const event = action.event;
      switch (event.type) {
        case 'message_appended': {
          const message = toWidgetMessage(event.message);
          if (message.role === MessageRole.CUSTOMER) {
            // The server echo supersedes every optimistic customer bubble (single-flight send).
            return { ...state, pending: [], messages: upsertBySequence(state.messages, message) };
          }
          // AI/AGENT/SYSTEM: the final message replaces the live streaming draft.
          const streaming = state.streaming?.id === message.id ? null : state.streaming;
          return { ...state, streaming, messages: upsertBySequence(state.messages, message) };
        }
        case 'ai_token': {
          const prior = state.streaming?.id === event.messageId ? state.streaming.content : '';
          return { ...state, streaming: { id: event.messageId, content: prior + event.token } };
        }
        case 'state_changed':
          return { ...state, conversationState: event.state };
        default:
          return state;
      }
    }
  }
}

export interface UseTransport {
  readonly messages: WidgetMessage[];
  readonly responder: Responder;
  readonly status: ConnectionStatus;
  readonly sendMessage: (text: string) => void;
}

/**
 * Drives the widget's AI-mode realtime: confirms the session, loads the resume
 * snapshot, owns a {@link TransportManager}, and reduces its ordered event stream into
 * render state. Degrades to an offline local transcript when the embed isn't wired to a
 * backend (the dev harness or a misconfigured page) so the shell still functions.
 */
export function useTransport(config: ResolvedWidgetConfig): UseTransport {
  const { appearance, embedToken, apiBaseUrl, chatBaseUrl } = config;
  const online = Boolean(embedToken && apiBaseUrl);

  const greeting = useMemo<WidgetMessage>(
    () => ({ id: GREETING_ID, role: MessageRole.AI, content: appearance.greeting, sequence: 0 }),
    [appearance.greeting],
  );

  const [state, dispatch] = useReducer(reduce, undefined, () => ({
    messages: [greeting],
    pending: [],
    streaming: null,
    conversationState: ConversationState.AI_ACTIVE,
  }));
  const [status, setStatus] = useState<ConnectionStatus>(online ? 'connecting' : 'offline');

  const managerRef = useRef<TransportManager | null>(null);
  // Local sequence counter for offline mode (no server to assign sequences).
  const localSeqRef = useRef(MIN_MESSAGE_SEQUENCE);

  useEffect(() => {
    if (!online || !embedToken || !apiBaseUrl) return;

    const api: ApiConfig = {
      apiBaseUrl,
      embedToken,
      ...(chatBaseUrl !== undefined ? { chatBaseUrl } : {}),
    };
    let cancelled = false;

    async function init(): Promise<void> {
      try {
        const confirmedSession = await mintSession(api, getOrCreateSessionId());
        if (cancelled) return;
        setSessionId(confirmedSession);

        const snapshot = await fetchConversation(api, confirmedSession);
        if (cancelled) return;

        const manager = new TransportManager(api, confirmedSession);
        manager.onEvent((event) => dispatch({ type: 'event', event }));
        manager.start({
          conversationId: snapshot.conversation?.id ?? null,
          state: snapshot.conversation?.state ?? ConversationState.AI_ACTIVE,
          lastSequence: snapshot.conversation?.lastSequence ?? 0,
        });
        managerRef.current = manager;

        const history = snapshot.messages.map(toWidgetMessage);
        // Keep the greeting only when there is no real transcript yet.
        const seeded = history.length > 0 ? history : [greeting];
        dispatch({
          type: 'seed',
          messages: seeded,
          state: snapshot.conversation?.state ?? ConversationState.AI_ACTIVE,
        });
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void init();
    return () => {
      cancelled = true;
      managerRef.current?.stop();
      managerRef.current = null;
    };
  }, [online, embedToken, apiBaseUrl, chatBaseUrl, greeting]);

  const sendMessage = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content) return;

      const manager = managerRef.current;
      if (!online || !manager) {
        // Offline preview: append locally, no AI response.
        const sequence = ++localSeqRef.current;
        dispatch({
          type: 'localAppend',
          message: { id: crypto.randomUUID(), role: MessageRole.CUSTOMER, content, sequence },
        });
        return;
      }

      dispatch({ type: 'optimistic', id: crypto.randomUUID(), content });
      setStatus('sending');
      manager
        .send(content, crypto.randomUUID())
        .then(() => setStatus('ready'))
        .catch(() => setStatus('error'));
    },
    [online],
  );

  const messages = useMemo<WidgetMessage[]>(() => {
    const draft: WidgetMessage[] = state.streaming
      ? [
          {
            id: state.streaming.id,
            role: MessageRole.AI,
            content: state.streaming.content,
            sequence: STREAMING_SEQUENCE,
            streaming: true,
          },
        ]
      : [];
    return [...state.messages, ...state.pending, ...draft];
  }, [state.messages, state.pending, state.streaming]);

  return {
    messages,
    responder: responderForState(state.conversationState),
    status,
    sendMessage,
  };
}
