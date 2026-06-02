import { findSessionForOrg, touchSession, type Database } from '@graft/db';
import {
  SESSION_HEADER,
  sessionIdSchema,
  type WidgetConversationResponse,
} from '@graft/shared';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ConversationService } from '../conversation/service.js';

interface WidgetConversationRouteOptions {
  db: Database;
  conversations: ConversationService;
}

function headerValue(request: FastifyRequest, name: string): string | undefined {
  const raw = request.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Widget resume read. `validateWidget` resolves the embed token to an org and enforces
 * the Origin allow-list; the session id rides the `x-graft-session-id` header and is
 * re-asserted against the org (tenant guard, invariant 1). Returns the session's active
 * conversation snapshot (state + `lastSequence`) and its full history so the widget can
 * paint the transcript and seed its render cursor on (re)open. A fresh session (no open
 * conversation) returns `{ conversation: null, messages: [] }` — no conversation is
 * created on a mere page load; the first `POST /widget/messages` does that.
 */
export const widgetConversationRoutes: FastifyPluginAsync<WidgetConversationRouteOptions> = async (
  app,
  opts,
) => {
  const { db, conversations } = opts;

  app.get('/widget/conversation', { preHandler: [app.validateWidget] }, async (request, reply) => {
    const organizationId = request.widgetOrg!.organizationId;

    const sessionParse = sessionIdSchema.safeParse(headerValue(request, SESSION_HEADER));
    if (!sessionParse.success) {
      return reply.code(400).send({
        error: { code: 'INVALID_SESSION', message: 'A valid session id header is required.' },
      });
    }
    const sessionId = sessionParse.data;

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

    const conversation = await conversations.findActiveConversation(organizationId, sessionId);
    if (!conversation) {
      const empty: WidgetConversationResponse = { conversation: null, messages: [] };
      return reply.send(empty);
    }

    const messages = await conversations.getHistory(organizationId, conversation.id);
    const response: WidgetConversationResponse = {
      conversation: {
        id: conversation.id,
        state: conversation.state,
        lastSequence: conversation.lastSequence,
      },
      messages,
    };
    return reply.send(response);
  });
};
