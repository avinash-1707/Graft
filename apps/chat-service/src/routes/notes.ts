import {
  createInternalNote,
  getConversationForOrg,
  listInternalNotesByConversation,
  type Database,
} from '@graft/db';
import { createNoteRequestSchema, conversationIdSchema } from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';

interface NotesRouteOptions {
  db: Database;
}

/**
 * Internal notes for a conversation (unit 28): agent-only, never shown to the customer.
 * Both reads and writes are tenant-scoped — the conversation must belong to the caller's
 * org (from the verified JWT) before any note is listed or created. Authenticated staff
 * (owner or agent) may read and write; the author is the JWT subject, not client input.
 */
export const notesRoutes: FastifyPluginAsync<NotesRouteOptions> = async (app, opts) => {
  const { db } = opts;

  app.get<{ Params: { id: string } }>(
    '/org/conversations/:id/notes',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const organizationId = request.authUser!.org;
      const idParse = conversationIdSchema.safeParse(request.params.id);
      if (!idParse.success) {
        return reply
          .code(400)
          .send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid conversation id.' } });
      }

      const conversation = await getConversationForOrg(db, idParse.data, organizationId);
      if (!conversation) {
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
      }

      const notes = await listInternalNotesByConversation(db, idParse.data, organizationId);
      return reply.send({ notes });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/org/conversations/:id/notes',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const organizationId = request.authUser!.org;
      const idParse = conversationIdSchema.safeParse(request.params.id);
      if (!idParse.success) {
        return reply
          .code(400)
          .send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid conversation id.' } });
      }

      const bodyParse = createNoteRequestSchema.safeParse(request.body);
      if (!bodyParse.success) {
        return reply
          .code(400)
          .send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid note.' } });
      }

      const conversation = await getConversationForOrg(db, idParse.data, organizationId);
      if (!conversation) {
        return reply
          .code(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
      }

      const note = await createInternalNote(db, {
        organizationId,
        conversationId: idParse.data,
        authorAgentId: request.authUser!.sub,
        content: bodyParse.data.content,
      });
      return reply.code(201).send({ note });
    },
  );
};
