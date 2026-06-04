import { listActiveConversationsByOrg, toOrgFeedConversation, type Database } from '@graft/db';
import { ORG_FEED_EVENT_NAME, type OrgFeedEvent } from '@graft/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { ServerResponse } from 'node:http';
import type { OrgFeedHub } from '../realtime/org-feed.js';

interface OrgFeedRouteOptions {
  db: Database;
  hub: OrgFeedHub;
}

/** SSE response headers: stream, no buffering (proxies/Nginx), keep-alive. */
const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/** Heartbeat comment so idle feeds (no conversation activity) survive proxy timeouts. */
const HEARTBEAT_MS = 25_000;

function writeFeedEvent(res: ServerResponse, event: OrgFeedEvent): void {
  res.write(`event: ${ORG_FEED_EVENT_NAME}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Dashboard live conversation feed (unit 27). An authenticated org member (owner or
 * agent) opens an SSE stream scoped to their org: an initial `snapshot` of all active
 * (non-CLOSED) conversations, then live `conversation_upsert` (state/assignment
 * changes) and `message` events (AI↔customer↔agent exchanges) fanned out from the
 * org-feed Redis bus. Read-only — claiming and replying land in unit 28 over the WS.
 * Org scope comes from the verified JWT (`authUser.org`), never the client.
 */
export const orgFeedRoutes: FastifyPluginAsync<OrgFeedRouteOptions> = async (app, opts) => {
  const { db, hub } = opts;

  app.get('/org/feed', { preHandler: [app.authenticate] }, async (request, reply) => {
    const organizationId = request.authUser!.org;

    // Snapshot BEFORE registering for live events: any event that fires between the
    // read and the register would be missed, but the dashboard reconciles by id and a
    // reconnect re-snapshots, so a momentary gap self-heals. Reading first keeps the
    // initial paint a single consistent view.
    const rows = await listActiveConversationsByOrg(db, organizationId);

    // @fastify/cors set the CORS headers on the reply in an onRequest hook, but hijack
    // skips Fastify's send path — so carry the computed Allow-Origin/Vary onto the raw
    // SSE response ourselves, or a cross-origin dashboard fetch would be blocked.
    const corsHeaders: Record<string, string> = {};
    const allowOrigin = reply.getHeader('access-control-allow-origin');
    if (typeof allowOrigin === 'string') corsHeaders['Access-Control-Allow-Origin'] = allowOrigin;
    const vary = reply.getHeader('vary');
    if (typeof vary === 'string') corsHeaders['Vary'] = vary;

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, { ...SSE_HEADERS, ...corsHeaders });

    writeFeedEvent(res, {
      type: 'snapshot',
      conversations: rows.map(toOrgFeedConversation),
    });

    const connection = { write: (event: OrgFeedEvent) => writeFeedEvent(res, event) };
    hub.register(organizationId, connection);

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(`: ping\n\n`);
    }, HEARTBEAT_MS);
    heartbeat.unref();

    const cleanup = (): void => {
      clearInterval(heartbeat);
      hub.unregister(organizationId, connection);
      if (!res.writableEnded) res.end();
    };
    request.raw.on('close', cleanup);
  });
};
