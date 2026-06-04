import {
  assemblePrompt,
  chatTools,
  ESCALATE_TOOL_NAME,
  evaluateGrounding,
  GenerationCancelledError,
  streamAnswer,
  type PromptMessage,
} from '@graft/ai';
import type { Encryptor } from '@graft/crypto';
import { getEscalationConfig, getWidgetConfig, insertAiInference, type Database } from '@graft/db';
import { resolveChatModel, resolveEmbedder, type ResolvedChatModel } from '@graft/keyring';
import { retrieveChunks, type RetrievedChunk } from '@graft/rag';
import {
  aiInferenceInsertSchema,
  ConversationState,
  DEFAULT_ESCALATION_CONFIG,
  DEFAULT_WIDGET_BOT_NAME,
  EscalationTrigger,
  messageIdSchema,
  MessageRole,
  type AiAnalysisResult,
  type AiInferenceStatus,
  type Conversation,
  type EscalationTrigger as EscalationTriggerType,
  type Message,
  type OrgFeedBusEvent,
  type OrgFeedConversation,
  type ServerEvent,
} from '@graft/shared';
import type { FastifyBaseLogger } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { ConversationService } from '../conversation/service.js';
import type { EscalationService } from '../escalation/service.js';
import type { AnalysisQueue } from '../queue/analysis-queue.js';
import type { EventBus } from '../realtime/event-bus.js';

export interface StreamTurnParams {
  organizationId: string;
  /** Session UUID, already validated to belong to the org by the route. */
  sessionId: string;
  content: string;
  clientNonce: string;
  /** Cancellation: aborts when the customer disconnects (invariant 12). */
  signal: AbortSignal;
  /** Direct local SSE write for `ai_token` / `message_appended` (not `state_changed`). */
  emit: (event: ServerEvent) => void;
  /**
   * Called once the conversation is resolved, before streaming. The route uses it to
   * register the SSE connection in the realtime registry so bus-published events
   * (escalation `state_changed`, takeover abort) reach this connection.
   */
  onConversation?: (conversation: Conversation) => void;
  log: FastifyBaseLogger;
}

export interface AnswerServiceDeps {
  db: Database;
  encryptor: Encryptor;
  conversations: ConversationService;
  escalation: EscalationService;
  analysisQueue: AnalysisQueue;
  /** Org-feed fan-out for the dashboard live feed (unit 27). */
  bus: EventBus;
  /** Max KB chunks retrieved per turn. */
  topK: number;
  /** How long to wait for the analysis result before giving up the live emit. */
  analysisWaitTimeoutMs: number;
}

/**
 * Orchestrates one AI_ACTIVE customer turn (architecture.md §RAG + §Escalation):
 * resume the conversation, persist the customer message (idempotent), embed the
 * query, retrieve tenant-scoped KB chunks, assemble the grounded prompt, stream the
 * answer to the widget via SSE, persist it, and evaluate the five escalation
 * triggers.
 *
 * The live answer streams directly (never queued) so it stays low-latency and
 * cancellable. The non-streamed turn classifier (sentiment + human-request) runs on
 * the BullMQ analysis queue (retry + parallel) concurrently with the answer; the
 * worker owns the durable escalation transition for those triggers, and this handler
 * does a best-effort live `state_changed` emit on the SSE it holds (B-hybrid).
 * Inline triggers (weak grounding pre-gen, provider-failure, model-invoked) are
 * applied directly here. Cross-instance agent-takeover abort lands with chat-service.
 */
export class AnswerService {
  private readonly db: Database;
  private readonly encryptor: Encryptor;
  private readonly conversations: ConversationService;
  private readonly escalation: EscalationService;
  private readonly analysisQueue: AnalysisQueue;
  private readonly bus: EventBus;
  private readonly topK: number;
  private readonly analysisWaitTimeoutMs: number;

  constructor(deps: AnswerServiceDeps) {
    this.db = deps.db;
    this.encryptor = deps.encryptor;
    this.conversations = deps.conversations;
    this.escalation = deps.escalation;
    this.analysisQueue = deps.analysisQueue;
    this.bus = deps.bus;
    this.topK = deps.topK;
    this.analysisWaitTimeoutMs = deps.analysisWaitTimeoutMs;
  }

  /** Projects a resolved conversation to the read-only org-feed card shape. */
  private static feedConversation(c: Conversation): OrgFeedConversation {
    return {
      id: c.id,
      sessionId: c.sessionId,
      state: c.state,
      assignedAgentId: c.assignedAgentId,
      escalationTrigger: c.escalationTrigger,
      lastSequence: c.lastSequence,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  /**
   * Best-effort publish to the dashboard live feed (unit 27). The feed is auxiliary;
   * a Redis hiccup must never fail or stall the customer's turn, so failures are
   * swallowed with a log and the publish is fire-and-forget.
   */
  private publishFeed(
    organizationId: string,
    event: OrgFeedBusEvent,
    log: FastifyBaseLogger,
  ): void {
    void this.bus
      .publishOrgFeed(organizationId, event)
      .catch((err: unknown) => log.warn({ err }, 'org-feed publish failed'));
  }

  /** Publishes a newly-appended message to the org feed so agents observe the exchange. */
  private publishFeedMessage(
    organizationId: string,
    message: Message,
    log: FastifyBaseLogger,
  ): void {
    this.publishFeed(
      organizationId,
      { type: 'message', conversationId: message.conversationId, message },
      log,
    );
  }

  async streamTurn(params: StreamTurnParams): Promise<void> {
    const { organizationId, sessionId, content, clientNonce, signal, emit, onConversation, log } =
      params;

    const conversation = await this.conversations.getOrCreateConversation(
      organizationId,
      sessionId,
    );
    onConversation?.(conversation);
    // Surface the conversation on the dashboard live feed (new or resumed) before the turn.
    this.publishFeed(
      organizationId,
      { type: 'conversation_upsert', conversation: AnswerService.feedConversation(conversation) },
      log,
    );

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
    if (!deduped) this.publishFeedMessage(organizationId, customerMessage, log);

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

    await this.generateAnswer({
      organizationId,
      conversation,
      content,
      history,
      customerMessageId: customerMessage.id,
      signal,
      emit,
      log,
    });
  }

  private async generateAnswer(args: {
    organizationId: string;
    conversation: Conversation;
    content: string;
    history: PromptMessage[];
    customerMessageId: string;
    signal: AbortSignal;
    emit: (event: ServerEvent) => void;
    log: FastifyBaseLogger;
  }): Promise<void> {
    const { organizationId, conversation, content, history, customerMessageId, signal, emit, log } =
      args;
    const startedAt = Date.now();
    const cfg = (await getEscalationConfig(this.db, organizationId)) ?? DEFAULT_ESCALATION_CONFIG;

    // --- Retrieve (embed query → tenant-scoped ANN). Embedding/retrieval provider
    // failure → PROVIDER_FAILURE auto-escalation (no chat inference happened). ---
    let chunks: RetrievedChunk[];
    try {
      const embedder = await resolveEmbedder(this.db, this.encryptor, organizationId);
      const queryEmbedding = await embedder.embedQuery(content);
      chunks = await retrieveChunks(this.db, { organizationId, queryEmbedding, topK: this.topK });
    } catch (err) {
      log.error({ err, organizationId, conversationId: conversation.id }, 'retrieval failed');
      if (cfg.providerFailureEnabled) {
        await this.escalation.escalate({
          organizationId,
          conversationId: conversation.id,
          trigger: EscalationTrigger.PROVIDER_FAILURE,
        });
      }
      return;
    }

    const grounding = evaluateGrounding(chunks, cfg.weakGroundingThreshold);

    // Weak grounding is the primary "AI can't answer" signal: escalate, no LLM answer.
    if (!grounding.grounded && cfg.weakGroundingEnabled) {
      await this.escalation.escalate({
        organizationId,
        conversationId: conversation.id,
        trigger: EscalationTrigger.WEAK_GROUNDING,
      });
      return;
    }
    // Trigger disabled → fall back to a grounded-but-empty decline (unit-16 behavior).
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

    // Kick off the non-streamed classifier on the queue (retry + parallel), concurrent
    // with the stream. Skipped when no classifier-driven trigger is enabled.
    const classifierEnabled = cfg.thirdHumanRequestEnabled || cfg.negativeSentimentEnabled;
    const analysisPromise: Promise<AiAnalysisResult | undefined> = classifierEnabled
      ? this.analysisQueue.enqueueAndWait(
          {
            organizationId,
            conversationId: conversation.id,
            messageId: customerMessageId,
            text: content,
          },
          this.analysisWaitTimeoutMs,
        )
      : Promise.resolve(undefined);

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
      const toolCalls = await stream.toolCalls;
      const modelInvoked = toolCalls.some((call) => call.toolName === ESCALATE_TOOL_NAME);

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
        this.publishFeedMessage(organizationId, message, log);
        persistedMessageId = message.id;
      }

      // Inline model-invoked escalation. EscalationService transitions + publishes the
      // `state_changed` on the realtime bus, which delivers to this SSE locally.
      let trigger: EscalationTriggerType | null = null;
      if (modelInvoked && cfg.modelInvokedEnabled) {
        const { transitioned } = await this.escalation.escalate({
          organizationId,
          conversationId: conversation.id,
          trigger: EscalationTrigger.MODEL_INVOKED,
        });
        if (transitioned) trigger = EscalationTrigger.MODEL_INVOKED;
      }

      // Classifier-driven escalation: the worker already transitioned AND published the
      // `state_changed` (delivered to this SSE via the bus). We await the result only to
      // attribute the trigger on the AiInference row — no emit here (avoids a double).
      const analysis = await analysisPromise;
      if (trigger === null && analysis?.escalated && analysis.trigger) {
        trigger = analysis.trigger;
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
        escalated: trigger !== null,
        escalationTrigger: trigger,
      });
    } catch (err) {
      void analysisPromise; // resolves to undefined on its own; never rejects
      const cancelled = err instanceof GenerationCancelledError;
      let trigger: EscalationTriggerType | null = null;
      if (cancelled) {
        // Invariant 12: tokens after cancellation are discarded — persist nothing.
        log.info(
          { organizationId, conversationId: conversation.id },
          'generation cancelled (client disconnect)',
        );
      } else {
        log.error({ err, organizationId, conversationId: conversation.id }, 'generation failed');
        if (cfg.providerFailureEnabled) {
          const { transitioned } = await this.escalation.escalate({
            organizationId,
            conversationId: conversation.id,
            trigger: EscalationTrigger.PROVIDER_FAILURE,
          });
          if (transitioned) trigger = EscalationTrigger.PROVIDER_FAILURE;
        }
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
        escalated: trigger !== null,
        escalationTrigger: trigger,
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
    escalated: boolean;
    escalationTrigger: EscalationTriggerType | null;
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
      escalated: args.escalated,
      escalationTrigger: args.escalationTrigger,
    });
    await insertAiInference(this.db, record);
  }
}
