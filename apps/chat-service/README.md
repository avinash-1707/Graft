# @graft/chat-service

Human realtime support. Fastify 5 + **Socket.IO 4.8** + the Redis adapter. Owns
human↔customer WebSocket chat, atomic conversation claim, handback, the org-scoped
live conversation feed (SSE), and cross-instance fan-out.

## Responsibilities

- **WebSocket chat** over Socket.IO: agent and customer exchange messages in real time
  while a conversation is `HUMAN_ACTIVE`. Every message is sequenced and persisted to
  Postgres (the source of truth); reconnect replays anything newer than the client's
  last-seen sequence (invariant 11).
- **Atomic claim:** a single DB compare-and-set
  (`UPDATE … WHERE state='ESCALATION_PENDING' AND assigned_agent_id IS NULL RETURNING *`)
  so exactly one agent can take a conversation — verified under contention (invariant 2).
  Claim also works as a proactive takeover directly from `AI_ACTIVE`.
- **Transport-switch signaling** (chat side): on claim it publishes the abort/takeover
  that ai-service consumes to cancel in-flight generation; on handback it returns control
  to the AI. The customer only ever sees the human/AI agent message.
- **Org live feed** (`GET /org/feed`, SSE): owner or agent streams a read-only feed of
  the org's active conversations, fed by an org-scoped Redis Pub/Sub channel published
  by both ai-service and chat-service.
- **Internal notes** over REST — agent-only, never shown to the customer or the AI.
- **Cross-instance fan-out** via `@socket.io/redis-adapter` (invariant 13): multiple
  chat-service instances require the adapter for fan-out **and** connection affinity
  (sticky/WS-only). In the ops stack Nginx pins WS with `ip_hash`.

## Surfaces

| Surface                                   | Auth        | Purpose                              |
| ----------------------------------------- | ----------- | ------------------------------------ |
| Socket.IO (WebSocket)                     | bearer/embed| Events: `join`, `claim`, `send`, `handback`, `typing`, plus server `message` / `state_changed` / `replay_batch` |
| `GET /org/feed` (SSE)                      | bearer      | Org-scoped live conversation feed    |
| `GET/POST /org/conversations/:id/notes`   | bearer      | List / add internal notes            |
| `GET /healthz` · `/readyz` · `/metrics`   | public      | Liveness / readiness / Prometheus    |

## Layout

```
src/
  index.ts        entrypoint (tracing first)
  server.ts       Socket.IO + Redis adapter + feed subscriber wiring; graceful shutdown
  app.ts          buildApp: CORS, JWT auth plugin, feed + notes routes
  env.ts          env schema
  claim/          atomic claim CAS + state transitions
  messaging/      send/relay, sequencing, persistence
  realtime/       Socket.IO io setup, org-feed hub + subscriber, Redis adapter
  routes/         org-feed (SSE), notes, health, metrics
  plugins/        JWT auth, metrics
```

## Environment

Required: `DATABASE_URL`, `REDIS_URL`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`.

Optional: `WEB_ORIGIN` / `DASHBOARD_ORIGIN` (CORS), `PORT` (default 8084), `HOST`,
`SHUTDOWN_TIMEOUT_MS`.

## Scripts

`pnpm --filter @graft/chat-service dev | build | start | check-types | lint`
