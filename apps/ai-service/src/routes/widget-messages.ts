import { findSessionForOrg, touchSession, type Database } from '@graft/db';
import { SESSION_HEADER, sessionIdSchema, widgetMessageBodySchema } from '@graft/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { AnswerService } from '../ai/answer-service.js';
import type { ConnectionRegistry, SseConnection } from '../realtime/connection-registry.js';
import { SSE_HEADERS, writeServerEvent } from '../sse/stream.js';

interface WidgetMessageRouteOptions {
  db: Database;
  answerService: AnswerService;
  registry: ConnectionRegistry;
}

function headerValue(request: FastifyRequest, name: string): string | undefined {
  const raw = request.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Public widget AI endpoint. `validateWidget` resolves the embed token to an org and
 * enforces the Origin allow-list; the session id is carried in the `x-graft-session-id`
 * header and re-asserted against the org (tenant guard) before any work. The response
 * is an SSE stream of `ai_token` / `message_appended` events for the turn.
 *
 * All rejections (bad token/origin, bad session, invalid body) happen BEFORE the SSE
 * handshake so the client gets a normal JSON error; once streaming starts, failures
 * end the stream and are logged. Per-org rate/spend limiting is owned by the gateway
 * (public ingress) — see Deferred follow-ups.
 */
export const widgetMessageRoutes: FastifyPluginAsync<WidgetMessageRouteOptions> = async (
  app,
  opts,
) => {
  const { db, answerService, registry } = opts;

  app.post('/widget/messages', { preHandler: [app.validateWidget] }, async (request, reply) => {
    const organizationId = request.widgetOrg!.organizationId;

    const sessionParse = sessionIdSchema.safeParse(headerValue(request, SESSION_HEADER));
    if (!sessionParse.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_SESSION', message: 'A valid session id header is required.' },
      });
    }
    const sessionId = sessionParse.data;

    const bodyParse = widgetMessageBodySchema.safeParse(request.body);
    if (!bodyParse.success) {
      return reply
        .code(400)
        .send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid message payload.' } });
    }
    const { content, clientNonce } = bodyParse.data;

    // Tenant guard: the session must belong to the embed token's org (invariant 1).
    const session = await findSessionForOrg(db, sessionId, organizationId);
    if (!session) {
      return reply.code(403).send({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session does not belong to this organization.',
        },
      });
    }
    await touchSession(db, session.id);

    // Hand the socket off to manual SSE writing; Fastify no longer manages the reply.
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, SSE_HEADERS);

    // Cancel in-flight generation when the customer disconnects (invariant 12).
    const controller = new AbortController();
    const onClose = (): void => controller.abort();
    request.raw.on('close', onClose);

    // Registered in the realtime registry once the conversation is known, so a
    // bus-published escalation `state_changed` or a cross-instance takeover abort
    // reaches this SSE / aborts this generation regardless of origin process.
    const connection: SseConnection = {
      write: (event) => writeServerEvent(res, event),
      abort: () => controller.abort(),
    };
    let registeredConversationId: string | undefined;

    try {
      await answerService.streamTurn({
        organizationId,
        sessionId,
        content,
        clientNonce,
        signal: controller.signal,
        emit: (event) => writeServerEvent(res, event),
        onConversation: (conversation) => {
          registry.register(conversation.id, connection);
          registeredConversationId = conversation.id;
        },
        log: request.log,
      });
    } catch (err) {
      request.log.error({ err }, 'widget message turn failed');
    } finally {
      if (registeredConversationId) registry.unregister(registeredConversationId, connection);
      request.raw.removeListener('close', onClose);
      if (!res.writableEnded) res.end();
    }
  });
};
