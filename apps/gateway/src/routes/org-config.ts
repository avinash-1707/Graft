import {
  getEscalationConfig,
  getWidgetConfig,
  upsertEscalationConfig,
  upsertWidgetConfig,
  type Database,
} from '@graft/db';
import {
  DEFAULT_ESCALATION_CONFIG,
  DEFAULT_WIDGET_CONFIG,
  escalationConfigSchema,
  widgetConfigSchema,
  type EscalationConfig,
  type WidgetConfig,
} from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parseOr400 } from '../http/validate.js';

interface OrgConfigRouteOptions {
  db: Database;
}

/**
 * Owner-only widget appearance + escalation configuration. Each resource is a
 * single per-org document: GET returns the stored config or the effective
 * defaults when the tenant has not customized it yet; PUT is a full-document
 * upsert. Scope is the owner's JWT org.
 */
export const orgConfigRoutes: FastifyPluginAsync<OrgConfigRouteOptions> = async (app, opts) => {
  const { db } = opts;
  const ownerOnly = { preHandler: [app.authenticate, app.requireRole('OWNER')] };

  app.get('/org/widget-config', ownerOnly, async (request): Promise<WidgetConfig> => {
    const orgId = request.authUser!.org;
    const row = await getWidgetConfig(db, orgId);
    if (!row) return DEFAULT_WIDGET_CONFIG;
    return {
      accentPrimary: row.accentPrimary,
      bgSurface: row.bgSurface,
      textPrimary: row.textPrimary,
      textMuted: row.textMuted,
      botName: row.botName,
      greeting: row.greeting,
      preset: row.preset,
      launcherPosition: row.launcherPosition,
    };
  });

  app.put('/org/widget-config', ownerOnly, async (request, reply) => {
    const data = parseOr400(widgetConfigSchema, request.body, reply);
    if (!data) return;
    await upsertWidgetConfig(db, request.authUser!.org, data);
    return reply.send(data);
  });

  app.get('/org/escalation-config', ownerOnly, async (request): Promise<EscalationConfig> => {
    const orgId = request.authUser!.org;
    const row = await getEscalationConfig(db, orgId);
    if (!row) return DEFAULT_ESCALATION_CONFIG;
    return {
      thirdHumanRequestEnabled: row.thirdHumanRequestEnabled,
      humanRequestCountToEscalate: row.humanRequestCountToEscalate,
      humanRequestConfidenceThreshold: row.humanRequestConfidenceThreshold,
      weakGroundingEnabled: row.weakGroundingEnabled,
      weakGroundingThreshold: row.weakGroundingThreshold,
      modelInvokedEnabled: row.modelInvokedEnabled,
      negativeSentimentEnabled: row.negativeSentimentEnabled,
      negativeSentimentThreshold: row.negativeSentimentThreshold,
      providerFailureEnabled: row.providerFailureEnabled,
    };
  });

  app.put('/org/escalation-config', ownerOnly, async (request, reply) => {
    const data = parseOr400(escalationConfigSchema, request.body, reply);
    if (!data) return;
    await upsertEscalationConfig(db, request.authUser!.org, data);
    return reply.send(data);
  });
};
