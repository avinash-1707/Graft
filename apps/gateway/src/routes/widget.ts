import {
  createSession,
  findSessionForOrg,
  touchSession,
  type Database,
} from '@graft/db';
import { sessionIdSchema, widgetSessionRequestSchema } from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { GatewayEnv } from '../env.js';
import { parseOr400 } from '../http/validate.js';
import { widgetRateLimitKey } from '../widget/rate-limit.js';

interface WidgetRouteOptions {
  db: Database;
  env: GatewayEnv;
}

/**
 * Public widget endpoints. Every route is gated by `validateWidget` (embed token
 * + Origin allow-list) and a per-(token, session) rate limit. The only route so
 * far bootstraps an anonymous, org-scoped session for the widget.
 */
export const widgetRoutes: FastifyPluginAsync<WidgetRouteOptions> = async (app, opts) => {
  const { db, env } = opts;

  app.post(
    '/widget/session',
    {
      preHandler: [app.validateWidget],
      config: {
        rateLimit: {
          max: env.WIDGET_RATE_LIMIT_MAX,
          timeWindow: env.WIDGET_RATE_LIMIT_WINDOW_MS,
          keyGenerator: widgetRateLimitKey,
        },
      },
    },
    async (request, reply) => {
      const data = parseOr400(widgetSessionRequestSchema, request.body ?? {}, reply);
      if (!data) return;
      const orgId = request.widgetOrg!.organizationId;

      if (data.sessionId) {
        const existing = await findSessionForOrg(db, data.sessionId, orgId);
        if (existing) {
          await touchSession(db, existing.id);
          return { sessionId: sessionIdSchema.parse(existing.id) };
        }
      }

      const created = await createSession(db, orgId);
      return { sessionId: sessionIdSchema.parse(created.id) };
    },
  );
};
