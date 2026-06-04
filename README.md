# Graft

**AI-first customer support you embed with one script tag — and a human takes over the moment it matters.**

Graft is a multi-tenant SaaS support platform. A business drops a single embeddable
chat widget onto its website; its customers talk to an AI assistant that answers **only**
from that business's own knowledge base. When the AI can't help — or a human agent
decides to step in — the same conversation hands off to a real person, live, without the
customer ever seeing a technical seam.

## Table of contents

- [What Graft does](#what-graft-does)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Services](#services)
- [Shared libraries](#shared-libraries)
- [Technology](#technology)
- [Conversation lifecycle](#conversation-lifecycle)
- [Escalation](#escalation)
- [Getting started](#getting-started)
- [API reference](#api-reference)
- [Repository layout](#repository-layout)

## What Graft does

Most support tools force a choice: a chatbot that hallucinates and frustrates customers,
or a human inbox that's slow and expensive. Graft does both in one conversation and
switches between them automatically.

- **Grounded answers, not guesses.** The AI answers _from_ the tenant's uploaded
  knowledge base in its own words, and declines rather than fabricate when it has nothing
  relevant.
- **One seamless conversation.** AI and human share the same thread, history, and window.
  The handoff is invisible to the customer — they only ever see "You are now talking to a
  human agent" / "…an AI agent".
- **Strict tenant isolation.** Every knowledge base, conversation, and API key is scoped
  to one organization. Nothing is shared across tenants, and the AI runs on the tenant's
  own provider key.

## How it works

### Setting up an organization

A business signs up and becomes the _owner_. The owner connects AI by pasting their own
OpenRouter key (Graft encrypts it and never exposes it again) and optionally picking which
OpenRouter models serve chat and embeddings, uploads
knowledge as PDF, DOCX, or plain text, customizes the widget, configures when the AI
should escalate to a human, and invites support agents. Finally they embed one line of
HTML on their site — no backend changes required.

### Talking to a customer

A customer opens the chat bubble with no login. The AI answers in natural language,
grounded strictly in the business's material; if it doesn't know, it says so. When a
question needs a human, the conversation quietly switches to a live agent and back again
when the agent is done. Returning in the same browser resumes the full history.

### Working as an agent

An agent sees a live feed of every active conversation in the org, including ones the AI
has flagged for help. They can watch an AI↔customer chat in real time and **claim** it to
take over — claiming is atomic, so if two agents click at once exactly one wins. The agent
chats live, can leave internal notes (never shown to the customer or the AI), then hands
back or closes.

## Architecture

Graft is a TypeScript monorepo of independently deployable services that share typed
contracts, schema, and infrastructure libraries.

```
                          end customer's browser
                    ┌──────────────────────────────┐
                    │   widget (Shadow-DOM embed)   │
                    └───────┬───────────────┬───────┘
                  SSE (AI)  │               │  WebSocket (human)
                            ▼               ▼
   owner/agent       ┌───────────┐   ┌──────────────┐
   ┌───────────┐     │ ai-service│   │ chat-service │
   │ dashboard │     │  RAG+LLM  │   │  Socket.IO   │
   │  (Next.js)│     │  SSE      │   │  atomic claim│
   └─────┬─────┘     │ escalation│   │  handback    │
         │           └─────┬─────┘   └──────┬───────┘
         │ auth + config   │                │
         ▼                 │   Redis Pub/Sub │  (cross-instance fan-out)
   ┌───────────┐           └────────┬────────┘
   │  gateway  │  Better Auth, JWT (JWKS), org config, widget embed-token
   └─────┬─────┘
         │            ┌────────────────────┐      BullMQ
         │            │ ingestion-service  │──────────────┐
         │            │ upload→parse→chunk │              ▼
         │            │ →embed→pgvector    │        ingestion worker
         │            └─────────┬──────────┘
         ▼                      ▼
   ┌────────────────────────────────────────────────────────┐
   │  PostgreSQL + pgvector   │   Redis   │  S3 / MinIO (KB)  │
   └────────────────────────────────────────────────────────┘
```

PostgreSQL is the only source of truth. Redis is ephemeral — Pub/Sub fan-out and BullMQ
queues only. Knowledge-base blobs stage in S3/MinIO and are deleted after ingestion.

The gateway owns authentication and org configuration. The realtime and ingestion services
are reached **directly** by clients (behind the Nginx load balancer in the ops stack), not
proxied through the gateway, so SSE/WebSocket streams and large uploads stay off the auth
hot path. Every service verifies the same gateway-issued JWT against the shared JWKS, so
there is no shared secret. (The gateway's `/v1/*` proxy route is a reserved stub.)

## Services

| App                 | Stack                        | Responsibility                                                                                       | Port  |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- | ----- |
| `gateway`           | Fastify + Better Auth        | Public ingress: auth (`/api/auth/*`), JWT signing + JWKS, org config, embed-token/origin validation, rate limiting. | 8080  |
| `ai-service`        | Fastify + BullMQ             | RAG retrieval, LLM orchestration, SSE streaming, escalation evaluation, AI realtime bus.              | 8083  |
| `chat-service`      | Fastify + Socket.IO          | Human↔customer WebSocket chat, atomic claim, handback, org live feed (SSE), Redis fan-out.            | 8084  |
| `ingestion-service` | Fastify + BullMQ + multipart | KB upload, parse (PDF/DOCX/text), chunk, embed, pgvector upsert. The only KB writer.                  | 8082  |
| `widget`            | React + Vite + Shadow DOM    | Embeddable end-customer chat UI; the silent SSE↔WebSocket transport switch.                           | —     |
| `dashboard`         | Next.js 16 + TanStack Query  | Owner/agent admin: config, KB, live feed, claim, human chat, notes.                                  | 3001  |
| `web`               | Next.js 16                   | Marketing site and auth pages (login/signup/verify/reset).                                            | 3000  |

Each app has its own README with routes, environment, and layout.

## Shared libraries

| Package                     | Owns                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `shared`                    | Cross-service types, enums, constants, Zod contracts, and the `validate()` helper. No side effects.  |
| `db`                        | Drizzle schema, migrations, and the postgres-js client. The single schema definition.                |
| `auth`                      | JWT verification (`createJwtVerifier`, JWKS), the Fastify `authenticate`/`requireRole` plugin, widget embed-token validation. |
| `crypto`                    | AES-256-GCM envelope `Encryptor` (with keyring for rotation) for tenant AI keys.                      |
| `keyring`                   | Resolves a tenant's provider config into a ready chat model / embedder, decrypting in-memory at call time. |
| `rag`                       | Chunking, embedding, and retrieval queries. Stateless.                                                |
| `ai`                        | Provider-agnostic LLM orchestration, prompt assembly, grounding score, sentiment, retry.             |
| `observability`             | Pino logger, OpenTelemetry setup, Prometheus client and instrumentation.                             |
| `tsconfig`, `eslint-config` | Shared build and lint configuration.                                                                 |

## Technology

- **Language / runtime:** TypeScript (strict), Node ≥ 22 (24 LTS target), ESM.
- **Monorepo:** pnpm workspaces and Turborepo.
- **Backend:** Fastify 5. Realtime over SSE (AI) and Socket.IO 4.8 (human) with Redis Pub/Sub.
- **AI:** Vercel AI SDK (`ai`) routed through OpenRouter via `@openrouter/ai-sdk-provider` (chat + embeddings on one tenant key).
- **Data:** PostgreSQL 18 + pgvector 0.8.2, Drizzle ORM. BullMQ on Redis for queues.
- **Object storage:** S3 (production) / MinIO (dev) via `@aws-sdk/client-s3`.
- **Frontend:** React 19, Next.js 16, Vite 8, Tailwind v4, shadcn (Base UI), TanStack Query.
- **Auth:** Better Auth (email + password, OTP verification and reset), EdDSA JWT with JWKS.
- **Observability:** Prometheus + Grafana, Pino → Loki, OpenTelemetry → Tempo.

## Conversation lifecycle

```
AI_ACTIVE ──(trigger fires OR agent takeover)──▶ ESCALATION_PENDING
ESCALATION_PENDING ──(atomic claim)──▶ AGENT_ASSIGNED ──▶ HUMAN_ACTIVE
HUMAN_ACTIVE ──(handback)──▶ AI_ACTIVE ──(resolved)──▶ CLOSED
```

Exactly one responder controls a conversation at any time, and transport follows state:
SSE while the AI controls it, WebSocket while a human does. Every message carries a
per-conversation monotonic sequence number; on any reconnect or SSE↔WebSocket switch the
client sends its last-seen sequence and the server replays anything newer, so no message
is lost or duplicated across the switch.

## Escalation

Escalation is evaluated in ai-service per turn. Each trigger is independently toggleable
per tenant:

- **`WEAK_GROUNDING`** (primary) — top retrieved similarity below the tenant threshold.
- **`MODEL_INVOKED`** — the model called the `escalate` tool.
- **`PROVIDER_FAILURE`** — a provider call failed after bounded retries.
- **`THIRD_HUMAN_REQUEST`** — the customer asked for a human N times (default 3).
- **`NEGATIVE_SENTIMENT`** — the turn classifier reports negative sentiment (off by default).

When several fire, priority is `PROVIDER_FAILURE > THIRD_HUMAN_REQUEST > WEAK_GROUNDING >
MODEL_INVOKED > NEGATIVE_SENTIMENT`. The transition is an atomic compare-and-set.

## Getting started

### Prerequisites

- Node ≥ 22 and pnpm 10.33.2 (`corepack enable`).
- PostgreSQL 18 + pgvector 0.8.2, Redis, and an S3-compatible store (MinIO) — or use the
  Docker stack in `ops/`, which provides all three.

### Run infra with Docker, apps on the host

The `ops/` compose stack is **infra-only** — Postgres, Redis, MinIO, plus one-shot
Drizzle-migrate and bucket-init jobs. The app services run directly from the host:

```bash
docker compose -f ops/compose.yaml up -d   # postgres :5432, redis :6379, minio :9000/:9001
cp .env.example .env                        # set BETTER_AUTH_SECRET=$(openssl rand -base64 36)
pnpm install && pnpm build
```

Then start each app in its own terminal (backends load `.env` automatically via
`node --env-file-if-exists`):

```bash
pnpm --filter @graft/gateway start          # :8080  (+ ai/chat/ingestion start[:worker])
pnpm --filter @graft/web dev                # :3000  (dashboard dev → :3001)
```

See [`ops/README.md`](ops/README.md) for the full per-app start list, the host-port
table, and the realtime load test (which needs the multi-instance topology).

### Run every app in watch mode

```bash
pnpm dev                            # turbo: build/watch every app
```

Each app reads its own environment (see the per-app READMEs). At minimum every backend
service needs `DATABASE_URL`; ai/chat/ingestion also need `REDIS_URL` and the JWT verify
config (`AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`); the gateway and ingestion need
`AI_KEY_ENCRYPTION_KEY` (base64, 32 bytes).

### Workspace scripts

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `pnpm build`       | Build every package and app.      |
| `pnpm dev`         | Run every app in watch mode.      |
| `pnpm lint`        | ESLint across the workspace.      |
| `pnpm check-types` | `tsc --noEmit` across everything. |
| `pnpm format`      | Prettier write.                   |

## API reference

Authenticated calls carry a bearer JWT minted from `GET /api/auth/token` (dashboard) or
are scoped by the widget embed token. Owner-only routes require the `OWNER` role. Every
service also exposes `GET /healthz`, `GET /readyz`, and `GET /metrics` (Prometheus).

### Gateway (`:8080`)

| Method and path                                   | Auth        | Purpose                              |
| ------------------------------------------------- | ----------- | ------------------------------------ |
| `ALL /api/auth/*`                                 | Better Auth | Sign-up/in, OTP verify/reset, session, JWKS, `/token` |
| `POST /auth/signup`                               | public      | Create an organization and owner     |
| `POST /auth/accept-invite`                        | public      | Agent sets a password from an invite OTP |
| `GET /auth/me`                                    | bearer      | Current identity                     |
| `GET/POST/DELETE /org/allowed-origins`            | owner       | Widget origin allow-list             |
| `GET /org/embed-token`, `POST /org/embed-token/rotate` | owner  | Widget embed token                   |
| `GET/PUT /org/ai-providers`, `DELETE /:provider`  | owner       | Provider keyring (encrypted)         |
| `GET/PUT /org/ai-settings`                        | owner       | Chat and embedding provider selection |
| `GET/PUT /org/widget-config`                      | owner       | Widget appearance                    |
| `GET/PUT /org/escalation-config`                  | owner       | Escalation toggles and thresholds    |
| `GET/POST/DELETE /org/agents`                     | owner       | Invite, list, and remove agents      |

### ai-service (`:8083`)

| Method and path              | Auth        | Purpose                                  |
| ---------------------------- | ----------- | ---------------------------------------- |
| `GET /widget/conversation`   | embed token | Resume conversation history              |
| `POST /widget/messages`      | embed token | Send a customer message; SSE stream of AI tokens |

### chat-service (`:8084`)

| Surface                                   | Auth         | Purpose                                  |
| ----------------------------------------- | ------------ | ---------------------------------------- |
| `GET /org/feed` (SSE)                     | bearer       | Org-scoped live conversation feed        |
| Socket.IO (WebSocket)                     | bearer/embed | Events: `join`, `claim`, `send`, `handback`, `typing`, `message` |
| `GET/POST /org/conversations/:id/notes`   | bearer       | Internal notes                           |

### ingestion-service (`:8082`)

| Method and path        | Auth  | Purpose                                  |
| ---------------------- | ----- | ---------------------------------------- |
| `POST /kb/documents`   | owner | Upload a KB file (multipart) → 202       |
| `GET /kb/documents`    | owner | List documents with live ingestion status |

## Repository layout

```
graft/
├── apps/          gateway · ai-service · chat-service · ingestion-service · widget · dashboard · web
├── packages/      shared · db · auth · crypto · keyring · rag · ai · observability · tsconfig · eslint-config
├── ops/           infra-only compose (postgres/redis/minio), Dockerfile; load-test + Nginx/observability configs
└── README.md
```

## License

Private / unpublished.
