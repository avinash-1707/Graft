import { findOrganizationByEmbedToken, isOriginAllowed, type Database } from '@graft/db';
import { EMBED_TOKEN_HEADER, organizationIdSchema, type OrganizationId } from '@graft/shared';
import type { FastifyPluginAsync, FastifyRequest, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import { WidgetErrors } from '../auth/errors.js';
import { normalizeOrigin } from '../widget/origin.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `validateWidget` once the embed token + Origin are accepted. */
    widgetOrg?: { organizationId: OrganizationId };
  }
  interface FastifyInstance {
    /** preHandler: resolves the embed token to an org and enforces Origin allow-listing. */
    validateWidget: preHandlerHookHandler;
  }
}

interface WidgetAuthPluginOptions {
  db: Database;
}

function headerValue(request: FastifyRequest, name: string): string | undefined {
  const raw = request.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

const widgetAuthPlugin: FastifyPluginAsync<WidgetAuthPluginOptions> = async (app, opts) => {
  app.decorateRequest('widgetOrg', undefined);

  app.decorate('validateWidget', async (request: FastifyRequest) => {
    const token = headerValue(request, EMBED_TOKEN_HEADER);
    if (!token) throw WidgetErrors.invalidEmbedToken();

    const org = await findOrganizationByEmbedToken(opts.db, token);
    if (!org) throw WidgetErrors.invalidEmbedToken();

    // The embed token is public (lives in page source); the Origin allow-list is
    // the real boundary. Origin header is authoritative; Referer is a fallback.
    const origin =
      normalizeOrigin(headerValue(request, 'origin')) ??
      normalizeOrigin(headerValue(request, 'referer'));
    if (!origin) throw WidgetErrors.originNotAllowed();

    const allowed = await isOriginAllowed(opts.db, org.id, origin);
    if (!allowed) throw WidgetErrors.originNotAllowed();

    request.widgetOrg = { organizationId: organizationIdSchema.parse(org.id) };
  });
};

export default fp(widgetAuthPlugin, { name: 'gateway-widget-auth' });
