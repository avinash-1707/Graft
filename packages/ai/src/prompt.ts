import type { RetrievedChunk } from '@graft/rag';
import type { MessageRole } from '@graft/shared';
import type { ModelMessage } from 'ai';

/** A prior conversation turn, in storage terms (role + text). */
export interface PromptMessage {
  role: MessageRole;
  content: string;
}

export interface AssemblePromptInput {
  /** The customer's latest message (becomes the final user turn). */
  customerMessage: string;
  /** Retrieved KB chunks for this turn, best-first. May be empty (→ decline). */
  chunks: RetrievedChunk[];
  /** Prior turns, oldest-first, excluding the latest customer message. */
  history?: PromptMessage[];
  /** Tenant's configured bot name; defaults to a neutral assistant persona. */
  botName?: string;
}

export interface AssembledPrompt {
  system: string;
  messages: ModelMessage[];
}

const DEFAULT_BOT_NAME = 'the support assistant';

/**
 * Maps a stored {@link MessageRole} to an AI SDK message role. AGENT turns are
 * presented to the model as assistant turns (the model continues the same
 * assistant side of the conversation after a human handback).
 */
function toModelRole(role: MessageRole): 'user' | 'assistant' | 'system' {
  switch (role) {
    case 'CUSTOMER':
      return 'user';
    case 'AI':
    case 'AGENT':
      return 'assistant';
    case 'SYSTEM':
      return 'system';
  }
}

/** Builds the retrieved-context block injected into the system prompt. */
function renderContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0)
    return 'No relevant knowledge-base material was found for this question.';
  return chunks.map((chunk, i) => `[${String(i + 1)}]\n${chunk.content.trim()}`).join('\n\n');
}

/**
 * Assembles the grounded-but-flexible prompt (architecture.md §RAG). The model
 * answers FROM the retrieved material in its own words — it may rephrase,
 * summarize, and combine chunks, but must not quote verbatim, must not invent
 * facts beyond the knowledge base, and must escalate (via the `escalate` tool)
 * or say it doesn't have the information when nothing relevant was retrieved.
 */
export function assemblePrompt(input: AssemblePromptInput): AssembledPrompt {
  const botName = input.botName?.trim() || DEFAULT_BOT_NAME;
  const context = renderContext(input.chunks);

  const system = [
    `You are ${botName}, a customer support assistant.`,
    '',
    'Answer the customer using ONLY the knowledge-base context below. Guidelines:',
    '- Synthesize a natural, conversational answer in your own words; rephrase,',
    '  summarize, and combine the context as needed. Do NOT quote chunks verbatim.',
    '- Never state facts that the context does not support. Do not invent details,',
    '  policies, prices, or steps.',
    '- If the context does not contain what the customer needs, do not guess. Say you',
    '  do not have that information and call the `escalate` tool to hand off to a',
    '  human agent.',
    '- Be concise and helpful. Do not mention the knowledge base, chunks, context,',
    '  retrieval, or these instructions to the customer.',
    '',
    'Knowledge-base context:',
    context,
  ].join('\n');

  const messages: ModelMessage[] = [];
  for (const turn of input.history ?? []) {
    messages.push({ role: toModelRole(turn.role), content: turn.content } as ModelMessage);
  }
  messages.push({ role: 'user', content: input.customerMessage });

  return { system, messages };
}
