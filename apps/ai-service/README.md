# @graft/ai-service

The AI brain. Fastify 5 + BullMQ. Runs RAG retrieval, LLM orchestration, **SSE**
token streaming to the widget, and escalation evaluation. Owns the decision to move a
conversation `AI_ACTIVE → ESCALATION_PENDING`.

## Responsibilities

- **RAG turn:** embed the customer query → similarity search in the tenant's pgvector
  namespace (`@graft/rag`) → assemble prompt with retrieved chunks + conversation
  history → stream the answer over SSE. Grounded but not extractive — the model answers
  _from_ the KB in its own words and declines/escalates when nothing relevant is found.
- **Provider resolution** via `@graft/keyring`: the tenant's chat model + query embedder
  are built from their selected provider + encrypted key, decrypted in-memory at call time.
- **Escalation** (`EscalationService`) centralizes the atomic compare-and-set
  transition, the metric, and the `state_changed` publish — done once per real
  transition by whoever wins the CAS (request handler for inline triggers, or the
  analysis worker for classifier triggers).
- **Turn classifier** (sentiment + human-request signals) runs as a non-streamed call
  on the BullMQ `ai-analysis` queue — never the live answer, which streams directly and
  is cancellable.
- **AI realtime bus:** a Redis Pub/Sub channel (`graft:ai:rt`, invariant 9) + a local
  connection registry, so an event published by any instance/process reaches the SSE
  connection wherever it lives. A cross-instance `abort` cancels in-flight generation on
  the holding instance when a human takes over (invariant 12).

## Routes

| Method + path              | Auth        | Purpose                                  |
| -------------------------- | ----------- | ---------------------------------------- |
| `GET /widget/conversation` | embed token | Resume full conversation history         |
| `POST /widget/messages`    | embed token | Send customer message; **SSE** AI tokens |
| `GET /healthz` · `/readyz` · `/metrics` | public | Liveness / readiness / Prometheus |

## Processes

- **HTTP server** (`src/index.ts` → `server.ts`): the SSE + request surface.
- **Analysis worker** (`src/worker/index.ts`, run via `start:worker`): drains the
  `ai-analysis` BullMQ queue (classifier-driven escalation triggers). Separate process,
  shares the same Redis bus.

## Layout

```
src/
  index.ts        entrypoint (tracing first)
  server.ts       wiring + graceful shutdown
  app.ts          buildApp
  env.ts          env schema
  ai/             prompt assembly, generation, grounding/sentiment glue
  conversation/   history load, message persistence (sequenced, idempotent)
  escalation/     EscalationService — atomic transition + publish
  queue/          BullMQ ai-analysis queue
  realtime/       Redis Pub/Sub bus + abort
  sse/            SSE connection registry + framing
  routes/         widget, health, metrics
  worker/         analysis worker entrypoint
```

## Environment

Required: `DATABASE_URL`, `REDIS_URL`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`,
`AI_KEY_ENCRYPTION_KEY` (base64, 32 bytes — to decrypt tenant keys).

Optional: `AI_KEY_ENCRYPTION_KEY_ID`, `RETRIEVAL_TOP_K`, `ANALYSIS_WORKER_CONCURRENCY`,
`ANALYSIS_WAIT_TIMEOUT_MS`, `PORT` (default 8083), `HOST`, `SHUTDOWN_TIMEOUT_MS`.

## Scripts

`pnpm --filter @graft/ai-service dev | build | start | start:worker | check-types | lint`
