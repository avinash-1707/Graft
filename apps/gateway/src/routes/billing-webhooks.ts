import { verifyDodoWebhook } from '@graft/billing';
import type { Database } from '@graft/db';
import type { Logger } from '@graft/observability';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { handleDodoEvent, type DodoConfig } from '../billing/service.js';

interface BillingWebhookOptions {
  db: Database;
  dodo: DodoConfig | null;
  logger: Logger;
}

/**
 * Public Dodo webhook ingress. Standard Webhooks signs the exact request bytes, so this
 * plugin keeps the raw body (its content-type parser override is encapsulated to this
 * plugin — other routes keep JSON parsing). Every credit mutation downstream is
 * idempotent, so Dodo's at-least-once retries are safe.
 */
export const billingWebhookRoutes: FastifyPluginAsync<BillingWebhookOptions> = async (
  app,
  opts,
) => {
  const { db, dodo, logger } = opts;

  app.removeAllContentTypeParsers();
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) =>
    done(null, body),
  );

  const unavailable = (reply: FastifyReply) =>
    reply
      .code(503)
      .send({ error: { code: 'BILLING_UNAVAILABLE', message: 'Billing is not configured.' } });

  app.post('/billing/webhooks/dodo', async (request, reply) => {
    if (!dodo) return unavailable(reply);
    const headers = {
      'webhook-id': request.headers['webhook-id'] as string,
      'webhook-signature': request.headers['webhook-signature'] as string,
      'webhook-timestamp': request.headers['webhook-timestamp'] as string,
    };

    let event;
    try {
      event = verifyDodoWebhook(dodo.client, request.body as string, headers);
    } catch (err) {
      logger.warn({ err }, 'dodo webhook signature verification failed');
      return reply
        .code(401)
        .send({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature.' } });
    }

    try {
      await handleDodoEvent(db, dodo, event, logger);
    } catch (err) {
      logger.error({ err, type: event.type }, 'dodo webhook handling failed');
      // 500 → Dodo retries; the handler is idempotent so a retry is safe.
      return reply
        .code(500)
        .send({ error: { code: 'WEBHOOK_ERROR', message: 'Handler error.' } });
    }
    return reply.send({ received: true });
  });
};
