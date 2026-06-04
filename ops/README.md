# Ops — infra stack, observability assets, and realtime load test (unit 29)

The default Docker stack here is **infra-only**: Postgres, Redis, and MinIO, plus
two one-shot bootstrap jobs (Drizzle migrate, MinIO bucket init). The app services
run **on the host** via pnpm against those datastores — see
[Run the apps on the host](#2-run-the-apps-on-the-host).

The multi-instance topology (2× ai-service + 2× chat-service behind an Nginx LB)
and the observability stack are **not** in `compose.yaml` anymore. Their config
still lives under `ops/nginx` and `ops/observability` and is used by the unit-29
load test (see [the load test](#4-run-the-load-test)), which stresses the realtime
paths: the SSE↔WS transport switch, atomic claim contention, and cross-instance
Redis Pub/Sub fan-out.

## Layout

```
ops/
  compose.yaml                 infra only: postgres + redis + minio + migrate/bucket-init
  docker/Dockerfile            one multi-stage image (used by the migrate job)
  nginx/nginx.conf             load-test LB: ai pool (round-robin, SSE) + chat pool (sticky, WS)
  observability/
    prometheus/                scrape config (all services, both instances)
    tempo/ loki/ promtail/     traces, logs, log shipping (Docker SD)
    otel-collector/            OTLP receiver → Tempo
    grafana/                   provisioned datasources (cross-linked) + dashboards
  load-test/                   @graft/load-test — Node/TS harness (scenarios)
```

## 1. Bring the infra up

```bash
docker compose -f ops/compose.yaml up -d
```

Host ports:

| URL                          | What                                    |
| ---------------------------- | --------------------------------------- |
| postgres://localhost:5432    | Postgres (graft / graft)                |
| redis://localhost:6379       | Redis                                   |
| http://localhost:9000        | MinIO S3 API                            |
| http://localhost:9001        | MinIO console (minioadmin / minioadmin) |

The `migrate` job runs the Drizzle migrations once against Postgres; `minio-init`
creates the `graft-kb` bucket. Both exit when done (`docker compose ps` shows them
`Exited (0)`); Postgres/Redis/MinIO stay up.

## 2. Run the apps on the host

```bash
cp .env.example .env        # at the repo root; set BETTER_AUTH_SECRET
pnpm install
pnpm build                  # or: pnpm --filter <app> build

# each backend in its own terminal (loads ../../.env via --env-file-if-exists):
pnpm --filter @graft/gateway start            # :8080
pnpm --filter @graft/ai-service start         # :8083
pnpm --filter @graft/ai-service start:worker
pnpm --filter @graft/chat-service start       # :8084
pnpm --filter @graft/ingestion-service start  # :8082
pnpm --filter @graft/ingestion-service start:worker

# frontends (Next loads its own .env*; localhost defaults already point at :8080):
pnpm --filter @graft/web dev                  # :3000
pnpm --filter @graft/dashboard dev            # :3001
```

App-port reference: gateway `:8080`, ingestion `:8082`, ai-service `:8083`,
chat-service `:8084`, web `:3000`, dashboard `:3001`.

## 3. Seed a tenant (required for the load test)

The realtime flows need a real tenant. Once the apps are running:

1. Sign up an owner (web app, or `POST http://localhost:8080/api/auth/sign-up/email`).
2. In the dashboard: add `http://localhost:3000` (or your `ORIGIN`) to the widget
   **allowed origins**, copy the **embed token**, and set an AI provider key.
3. Invite one or more agents and have them set passwords.
4. Mint an agent JWT for each agent: sign in as the agent, then
   `GET http://localhost:8080/api/auth/token` (carries the session cookie) →
   `{ "token": "..." }`.

## 4. Run the load test

> The load test exercises the **multi-instance** topology (2× ai + 2× chat behind
> the Nginx LB) and reads the Grafana dashboards — neither is in `compose.yaml`
> anymore. To run it you must first bring that topology up yourself from the
> `ops/nginx` + `ops/observability` configs (e.g. a separate compose file or run
> multiple host instances on the ports below). The default infra stack alone is a
> single instance per service and won't satisfy `pubsub-fanout`.

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

Defaults target the old multi-instance LB ports (`AI_URL` :8090, `CHAT_URL` :8091,
`CHAT_INSTANCE_URLS` :8101,:8102); override these env vars to match however you
bring the topology up. Watch the **Realtime** dashboard while they run.

## Notes / caveats

- `compose.yaml` is infra-only; the app services run on the host. The Dockerfile
  is now used only by the one-shot `migrate` job. For a slim production image,
  switch it to `pnpm deploy` with a per-package `files` allow-list.
- Nginx `ip_hash` pins by client IP, so the single-host harness uses the **direct**
  per-instance chat ports (8101/8102) for the fan-out scenario.
- This stack and harness were authored offline and are **not runtime-verified** in
  this environment (no Docker run); treat the first `up` as a smoke test.
