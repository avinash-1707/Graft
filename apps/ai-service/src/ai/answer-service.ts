import {
  assemblePrompt,
  chatTools,
  evaluateGrounding,
  GenerationCancelledError,
  streamAnswer,
  type PromptMessage,
} from '@graft/ai';
import type { Encryptor } from '@graft/crypto';
import {
  getEscalationConfig,
  getWidgetConfig,
  insertAiInference,
  type Database,
} from '@graft/db';
import { resolveChatModel, resolveEmbedder, type ResolvedChatModel } from '@graft/keyring';
import { retrieveChunks, type RetrievedChunk } from '@graft/rag';
import {
  aiInferenceInsertSchema,
  ConversationState,
  DEFAULT_ESCALATION_CONFIG,
  DEFAULT_WIDGET_BOT_NAME,
  messageIdSchema,
  MessageRole,
  type AiInferenceStatus,
  type Conversation,
  type ServerEvent,
} from '@graft/shared';
import type { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { ConversationService } from '../conversation/service.js';

export interface StreamTurnParams {
  organizationId: string;
  /** Session UUID, already validated to belong to the org by the route. */
  sessionId: string;
  content: string;
  clientNonce: string;
  /** Cancellation: aborts when the customer disconnects (invariant 12). */
  signal: AbortSignal;
  emit: (event: ServerEvent) => void;
  log: FastifyBaseLogger;
}

export interface AnswerServiceDeps {
  db: Database;
  encryptor: Encryptor;
  conversations: ConversationService;
  /** Max KB chunks retrieved per turn. */
  topK: number;
}

/**
 * Orchestrates one AI_ACTIVE customer turn (architecture.md §RAG): resume the
 * conversation, persist the customer message (idempotent), embed the query, retrieve
 * tenant-scoped KB chunks, assemble the grounded prompt, stream the answer to the
 * widget via SSE, then persist the AI message + record the inference metric.
 *
 * The live answer streams directly (never queued) so it stays low-latency and
 * cancellable. Escalation STATE transitions (weak grounding, sentiment, model-
 * invoked, provider-failure) are evaluated in unit 17; this unit only declines (an
 * empty/"I don't have that" answer) when retrieval is not grounded.
 */
export class AnswerService {
  private readonly db: Database;
  private readonly encryptor: Encryptor;
  private readonly conversations: ConversationService;
  private readonly topK: number;

  constructor(deps: AnswerServiceDeps) {
    this.db = deps.db;
    this.encryptor = deps.encryptor;
    this.conversations = deps.conversations;
    this.topK = deps.topK;
  }

  async streamTurn(params: StreamTurnParams): Promise<void> {
    const { organizationId, sessionId, content, clientNonce, signal, emit, log } = params;

    const conversation = await this.conversations.getOrCreateConversation(organizationId, sessionId);

    // History BEFORE appending the new turn. SYSTEM events are never placed in the
    // LLM context (invariant 8); the prompt appends the customer message itself.
    const priorMessages = await this.conversations.getHistory(organizationId, conversation.id);
    const history: PromptMessage[] = priorMessages
      .filter((m) => m.role !== MessageRole.SYSTEM)
      .map((m) => ({ role: m.role, content: m.content }));

    const { message: customerMessage, deduped } = await this.conversations.appendMessage({
      organizationId,
      conversationId: conversation.id,
      role: MessageRole.CUSTOMER,
      content,
      clientNonce,
    });
    emit({ type: 'message_appended', message: customerMessage });

    // The AI responds only while it controls the conversation (invariant 3); once a
    // human controls it the chat-service path (unit 20) handles the turn.
    if (conversation.state !== ConversationState.AI_ACTIVE) {
      return;
    }

    // Idempotent replay: the customer already sent this exact turn. Replay anything
    // newer instead of regenerating (regenerating would double-answer).
    if (deduped) {
      const newer = await this.conversations.getReplayAfter(
        organizationId,
        conversation.id,
        customerMessage.sequence,
      );
      for (const message of newer) emit({ type: 'message_appended', message });
      return;
    }

    await this.generateAnswer({ organizationId, conversation, content, history, signal, emit, log });
  }

  private async generateAnswer(args: {
    organizationId: string;
    conversation: Conversation;
    content: string;
    history: PromptMessage[];
    signal: AbortSignal;
    emit: (event: ServerEvent) => void;
    log: FastifyBaseLogger;
  }): Promise<void> {
    const { organizationId, conversation, content, history, signal, emit, log } = args;
    const startedAt = Date.now();

    // --- Retrieve (embed query → tenant-scoped ANN). A provider/retrieval failure
    // here ends the turn; unit 17 turns it into a graceful auto-escalation. ---
    let chunks: RetrievedChunk[];
    try {
      const embedder = await resolveEmbedder(this.db, this.encryptor, organizationId);
      const queryEmbedding = await embedder.embedQuery(content);
      chunks = await retrieveChunks(this.db, {
        organizationId,
        queryEmbedding,
        topK: this.topK,
      });
    } catch (err) {
      log.error(
        { err, organizationId, conversationId: conversation.id },
        'retrieval failed; ending turn (auto-escalation lands in unit 17)',
      );
      return;
    }

    const escalationConfig = await getEscalationConfig(this.db, organizationId);
    const threshold =
      escalationConfig?.weakGroundingThreshold ?? DEFAULT_ESCALATION_CONFIG.weakGroundingThreshold;
    const grounding = evaluateGrounding(chunks, threshold);

    // Weak grounding (no relevant chunk): pass NO context so the model declines /
    // escalates rather than answering from low-relevance material. The escalation
    // state transition itself is unit 17.
    const groundedChunks = grounding.grounded ? chunks : [];

    const widgetConfig = await getWidgetConfig(this.db, organizationId);
    const botName = widgetConfig?.botName ?? DEFAULT_WIDGET_BOT_NAME;
    const { system, messages } = assemblePrompt({
      customerMessage: content,
      chunks: groundedChunks,
      history,
      botName,
    });

    let resolved: ResolvedChatModel;
    try {
      resolved = await resolveChatModel(this.db, this.encryptor, organizationId);
    } catch (err) {
      log.error(
        { err, organizationId, conversationId: conversation.id },
        'chat model unavailable; ending turn',
      );
      return;
    }

    // Pre-generate the AI message id so `ai_token` events can reference it before the
    // full message is persisted; the row is later inserted with this exact id.
    const aiMessageId = messageIdSchema.parse(randomUUID());
    let answer = '';

    try {
      const stream = await streamAnswer({
        model: resolved.model,
        system,
        messages,
        tools: chatTools,
        signal,
      });
      for await (const token of stream.textStream) {
        answer += token;
        emit({ type: 'ai_token', messageId: aiMessageId, conversationId: conversation.id, token });
      }
      const finishReason = await stream.finishReason;
      const usage = await stream.usage;

      // Empty answer (e.g. the model only called `escalate`): show no bubble.
      let persistedMessageId: string | null = null;
      if (answer.trim() !== '') {
        const { message } = await this.conversations.appendMessage({
          id: aiMessageId,
          organizationId,
          conversationId: conversation.id,
          role: MessageRole.AI,
          content: answer,
          groundingScore: grounding.topSimilarity,
        });
        emit({ type: 'message_appended', message });
        persistedMessageId = message.id;
      }

      await this.recordInference({
        organizationId,
        conversationId: conversation.id,
        messageId: persistedMessageId,
        resolved,
        status: 'SUCCESS',
        latencyMs: Date.now() - startedAt,
        promptTokens: usage.inputTokens ?? null,
        completionTokens: usage.outputTokens ?? null,
        finishReason,
        grounding,
        chunkCount: chunks.length,
      });
    } catch (err) {
      const cancelled = err instanceof GenerationCancelledError;
      if (cancelled) {
        // Invariant 12: tokens after cancellation are discarded — persist nothing.
        log.info(
          { organizationId, conversationId: conversation.id },
          'generation cancelled (client disconnect)',
        );
      } else {
        log.error({ err, organizationId, conversationId: conversation.id }, 'generation failed');
      }
      await this.recordInference({
        organizationId,
        conversationId: conversation.id,
        messageId: null,
        resolved,
        status: cancelled ? 'CANCELLED' : 'PROVIDER_ERROR',
        latencyMs: Date.now() - startedAt,
        promptTokens: null,
        completionTokens: null,
        finishReason: null,
        grounding,
        chunkCount: chunks.length,
        errorCode: cancelled ? null : 'PROVIDER_FAILURE',
      });
    }
  }

  /** Records one chat-inference outcome for the tenant-facing AI metrics (unit 04b). */
  private async recordInference(args: {
    organizationId: string;
    conversationId: string;
    messageId: string | null;
    resolved: ResolvedChatModel;
    status: AiInferenceStatus;
    latencyMs: number;
    promptTokens: number | null;
    completionTokens: number | null;
    finishReason: string | null;
    grounding: { topSimilarity: number };
    chunkCount: number;
    errorCode?: string | null;
  }): Promise<void> {
    const record = aiInferenceInsertSchema.parse({
      organizationId: args.organizationId,
      conversationId: args.conversationId,
      messageId: args.messageId,
      provider: args.resolved.provider,
      model: args.resolved.modelId,
      status: args.status,
      latencyMs: Math.round(args.latencyMs),
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      finishReason: args.finishReason,
      errorCode: args.errorCode ?? null,
      groundingScore: args.grounding.topSimilarity,
      retrievedChunksCount: args.chunkCount,
      // Escalation evaluation + state transitions land in unit 17.
      escalated: false,
      escalationTrigger: null,
    });
    await insertAiInference(this.db, record);
  }
}
