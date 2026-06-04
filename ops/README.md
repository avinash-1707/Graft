# Ops — full stack, observability, and realtime load test (unit 29)

This directory runs Graft end to end on Docker, with a unified observability stack
(metrics + logs + traces) and a Node load-test harness that exercises the realtime
paths: the SSE↔WS transport switch, atomic claim contention, and cross-instance
Redis Pub/Sub fan-out.

To stress those paths the stack runs **two ai-service and two chat-service
instances** behind an Nginx load balancer (ai round-robins; chat is sticky for WS
affinity, invariant 13). Both pools share one Redis, so broadcasts fan out across
instances via the Socket.IO Redis adapter / the ai-service realtime bus.

## Layout

```
ops/
  compose.yaml                 full stack: datastores + services (2x ai, 2x chat) + nginx + obs
  docker/Dockerfile            one multi-stage image, parameterised by workspace package
  nginx/nginx.conf             ai pool (round-robin, SSE) + chat pool (sticky, WS)
  observability/
    prometheus/                scrape config (all services, both instances)
    tempo/ loki/ promtail/     traces, logs, log shipping (Docker SD)
    otel-collector/            OTLP receiver → Tempo
    grafana/                   provisioned datasources (cross-linked) + dashboards
  load-test/                   @graft/load-test — Node/TS harness (scenarios)
  .env.example                 copy to .env before `up`
```

## 1. Bring the stack up

```bash
cp ops/.env.example ops/.env
# edit ops/.env: set BETTER_AUTH_SECRET (openssl rand -base64 36)
docker compose -f ops/compose.yaml --env-file ops/.env up -d --build
```

Host ports:

| URL                         | What                                   |
| --------------------------- | -------------------------------------- |
| http://localhost:8080       | gateway (public ingress)               |
| http://localhost:8082       | ingestion-service                      |
| http://localhost:8090       | nginx → ai-service pool (widget SSE)    |
| http://localhost:8091       | nginx → chat-service pool (agent WS)    |
| http://localhost:8093/8094  | ai-service instance 1 / 2 (direct)      |
| http://localhost:8101/8102  | chat-service instance 1 / 2 (direct)    |
| http://localhost:3300       | Grafana (anonymous admin)              |
| http://localhost:9009       | Prometheus                             |
| http://localhost:9001       | MinIO console (minioadmin / minioadmin)|

The `migrate` service runs the Drizzle migrations once against Postgres before the
app services start; `minio-init` creates the `graft-kb` bucket.

## 2. Observability

Open Grafana at http://localhost:3300 → **Dashboards → Graft**:

- **Realtime** — active SSE/WS connections per instance, state transitions, claim
  wins per instance (fan-out), escalations.
- **HTTP RED** — request rate, 5xx rate, p50/p95 latency per service.
- **AI Pipeline** — LLM calls + latency by provider, BullMQ queue depth, escalations
  by trigger.

The three datasources cross-link: a Loki log line links to its Tempo trace by
`trace_id` (derived field), and a Tempo span links back to its logs and to the
Prometheus service map. Metrics come from each service's `/metrics`, traces flow
service → OTel Collector → Tempo, logs flow container stdout → Promtail → Loki.

## 3. Seed a tenant (required for the load test)

The realtime flows need a real tenant. Once the stack is up:

1. Sign up an owner (web app, or `POST http://localhost:8080/api/auth/sign-up/email`).
2. In the dashboard: add `http://localhost:3000` (or your `ORIGIN`) to the widget
   **allowed origins**, copy the **embed token**, and set an AI provider key.
3. Invite one or more agents and have them set passwords.
4. Mint an agent JWT for each agent: sign in as the agent, then
   `GET http://localhost:8080/api/auth/token` (carries the session cookie) →
   `{ "token": "..." }`.

## 4. Run the load test

```bash
export EMBED_TOKEN=<tenant embed token>
export ORIGIN=http://localhost:3000          # must be on the allow-list
export AGENT_TOKENS=<agentJwtA>,<agentJwtB>   # comma-separated

pnpm --filter @graft/load-test load sse-ws-switch
pnpm --filter @graft/load-test load claim-contention
pnpm --filter @graft/load-test load pubsub-fanout
```

| Scenario           | Asserts                                                              |
| ------------------ | ------------------------------------------------------------------- |
| `sse-ws-switch`    | customer SSE turn → claim → agent msg (HUMAN_ACTIVE) → handback; both `transport_switch` events seen |
| `claim-contention` | N agents race one conversation → exactly one wins (atomic CAS)      |
| `pubsub-fanout`    | agent A on instance 1, agent B on instance 2 → B receives A's message via the Redis adapter |

Defaults target the compose ports (`AI_URL` :8090, `CHAT_URL` :8091,
`CHAT_INSTANCE_URLS` :8101,:8102). Watch the **Realtime** dashboard while they run.

## Notes / caveats

- The service image ships the full workspace install (correctness over size); for a
  slim production image, switch the Dockerfile to `pnpm deploy` with a per-package
  `files` allow-list.
- Nginx `ip_hash` pins by client IP, so the single-host harness uses the **direct**
  per-instance chat ports (8101/8102) for the fan-out scenario.
- This stack and harness were authored offline and are **not runtime-verified** in
  this environment (no Docker run); treat the first `up` as a smoke test.
