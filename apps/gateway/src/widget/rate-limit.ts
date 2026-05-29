import { EMBED_TOKEN_HEADER, SESSION_HEADER } from '@graft/shared';
import type { FastifyRequest } from 'fastify';

function header(request: FastifyRequest, name: string): string | undefined {
  const raw = request.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Rate-limit key for public widget endpoints: scoped per embed token (i.e. per
 * org) and per session, falling back to IP when no session header is present.
 * Runs at onRequest (before validateWidget), so it reads raw headers.
 */
export function widgetRateLimitKey(request: FastifyRequest): string {
  const token = header(request, EMBED_TOKEN_HEADER) ?? 'no-token';
  const session = header(request, SESSION_HEADER) ?? request.ip;
  return `widget:${token}:${session}`;
}
