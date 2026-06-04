# Graft

**AI-first customer support you embed with one script tag — and a human takes over the moment it matters.**

Graft is a multi-tenant SaaS support platform. A business drops a single embeddable
chat widget onto its website; its customers talk to an AI assistant that answers
**only** from that business's own knowledge base. When the AI can't help — or a human
agent decides to step in — the same conversation hands off to a real person, live,
without the customer ever seeing a technical seam.

---

## Part 1 — What Graft is (non-technical)

### The problem

Most support tools make you choose: a chatbot that hallucinates and frustrates
customers, or a human inbox that's slow and expensive. Graft does both, in one
conversation, and switches between them automatically.

### How it works, in plain terms

**For the business (the tenant):**

1. **Sign up** and create an organization. The person who signs up is the _owner_.
2. **Connect an AI provider** — paste your own OpenAI or Anthropic API key. Graft
   encrypts it; nobody (including the AI) ever sees it again.
3. **Upload your knowledge** — PDFs, Word docs, or plain text (help articles,
   policies, product docs). Graft reads and indexes them privately to your org.
4. **Customize the widget** — colors, bot name, greeting — and decide _when_ the AI
   should hand off to a human (e.g. when a customer asks for a person three times, or
   when the AI clearly has no good answer).
5. **Invite your support agents.** They log into a dashboard and watch live
   conversations.
6. **Embed one line of HTML** on your site. Done — no backend changes on your end.

**For the end customer (on the business's website):**

1. They open the chat bubble and ask a question. No login, no signup.
2. The AI answers in natural language, grounded strictly in the business's uploaded
   material — it won't make things up. If it doesn't know, it says so.
3. If the question needs a human, the conversation quietly switches to a live agent.
   The customer just sees **"You are now talking to a human agent."**
4. When the agent is done, it can hand the conversation back to the AI
   (**"You are now talking to an AI agent."**) or close it.
5. Come back tomorrow, same browser — the whole conversation is still there.

**For the support agent:**

1. A live feed shows every active conversation in the org, including ones the AI has
   flagged as needing help.
2. The agent can watch an AI↔customer chat in real time and **claim** it to take over.
   Claiming is atomic — if two agents click at once, exactly one wins.
3. The agent chats with the customer live, can leave **internal notes** (never shown
   to the customer or the AI), then hands back or closes.

### What makes it different

- **Grounded answers, not guesses.** The AI answers _from_ your knowledge base in its
  own words — and declines rather than fabricate when it has nothing relevant.
- **One seamless conversation.** AI and human share the same thread, the same history,
  the same window. The handoff is invisible to the customer.
- **Your keys, your data, your tenant.** Every knowledge base, conversation, and API
  key is isolated to one organization. Nothing is shared across tenants.

---

## Part 2 — How it's built (technical)

### Architecture at a glance

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

**Source of truth is PostgreSQL.** Redis is ephemeral (Pub/Sub fan-out + BullMQ
queues only). KB blobs stage in S3/MinIO and are deleted after ingestion.

### Services (`apps/`)

| App                  | Stack                       | Responsibility                                                                 | Default port |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------ | ------------ |
| `gateway`            | Fastify + Better Auth       | Public ingress: auth (`/api/auth/*`), JWT signing + JWKS, org config, embed-token / origin validation, rate limiting. | 8080         |
| `ai-service`         | Fastify + BullMQ            | RAG retrieval, LLM orchestration, **SSE** streaming, escalation evaluation, AI realtime bus. | 8083         |
| `chat-service`       | Fastify + Socket.IO         | Human↔customer **WebSocket** chat, atomic claim, handback, org live feed (SSE), Redis fan-out. | 8084         |
| `ingestion-service`  | Fastify + BullMQ + multipart| KB upload, parse (PDF/DOCX/text), chunk, embed, pgvector upsert. Only KB writer. | 8082         |
| `widget`             | React + Vite + Shadow DOM   | Embeddable end-customer chat UI; the silent SSE↔WS transport switch.            | (static)     |
| `dashboard`          | Next.js 16 + TanStack Query | Owner/agent admin: config, KB, live feed, claim, human chat, notes.            | 3001         |
| `web`                | Next.js 16                  | Marketing site + auth pages (login/signup/verify/reset).                        | 3000         |

> **Note on routing.** The gateway owns auth + org configuration. The realtime and
> ingestion services are reached **directly** by the clients (behind the Nginx LB in
> the ops stack), not proxied through the gateway — SSE/WS and large uploads stay off
> the auth hot path. Every service verifies the same gateway-issued JWT against the
> shared JWKS, so there's no shared secret. (The gateway's `/v1/*` proxy route is a
> reserved stub.)

### Shared libraries (`packages/`)

| Package          | Owns                                                                              |
| ---------------- | -------------------------------------------------------------------------------- |
| `shared`         | Cross-service types, enums, constants, Zod contracts, the `validate()` helper. No side effects. |
| `db`             | Drizzle schema, migrations, postgres-js client. The single schema definition.    |
| `auth`           | JWT verify (`createJwtVerifier`, JWKS), Fastify `authenticate`/`requireRole`, widget embed-token validation. |
| `crypto`         | AES-256-GCM envelope `Encryptor` (+ keyring for rotation) for tenant AI keys.     |
| `keyring`        | Resolves a tenant's provider config → a ready chat `LanguageModel` / `Embedder`, decrypting in-memory at call time. |
| `rag`            | Chunking, embedding, retrieval queries. Stateless.                               |
| `ai`             | Provider-agnostic LLM orchestration, prompt assembly, grounding score, sentiment, retry. |
| `observability`  | Pino logger, OpenTelemetry setup, Prometheus client + instrumentation.           |
| `tsconfig`, `eslint-config` | Shared build/lint config.                                             |

### Stack

- **Language/runtime:** TypeScript (strict), Node ≥ 22 (24 LTS target), ESM.
- **Monorepo:** pnpm workspaces + Turborepo.
- **Backend:** Fastify 5. **Realtime:** SSE (AI) + Socket.IO 4.8 (human) + Redis Pub/Sub.
- **AI:** Vercel AI SDK (`ai`) with `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`.
- **Data:** PostgreSQL 18 + pgvector 0.8.2, Drizzle ORM. **Queue:** BullMQ on Redis.
- **Object storage:** S3 (prod) / MinIO (dev), `@aws-sdk/client-s3`.
- **Frontend:** React 19, Next.js 16, Vite 8, Tailwind v4, shadcn (Base UI), TanStack Query.
- **Auth:** Better Auth (email+password, OTP verification/reset), EdDSA JWT + JWKS.
- **Observability:** Prometheus + Grafana, Pino → Loki, OpenTelemetry → Tempo.

### Conversation state machine

```
AI_ACTIVE ──(trigger fires OR agent takeover)──▶ ESCALATION_PENDING
ESCALATION_PENDING ──(atomic claim)──▶ AGENT_ASSIGNED ──▶ HUMAN_ACTIVE
HUMAN_ACTIVE ──(handback)──▶ AI_ACTIVE ──(resolved)──▶ CLOSED
```

Exactly one responder controls a conversation at any time. **Transport follows
state:** SSE while the AI controls it, WebSocket while a human does. Every message
carries a per-conversation monotonic **sequence number**; on any (re)connect or
SSE↔WS switch the client sends its last-seen sequence and the server replays anything
newer — so no message is lost or duplicated across the switch. See
`context/transport-architecture.md` for the full realtime deep dive.

### Escalation triggers (per-tenant, each toggleable)

- **WEAK_GROUNDING** (primary) — top retrieved similarity below the tenant threshold.
- **MODEL_INVOKED** — the model called the `escalate` tool.
- **PROVIDER_FAILURE** — provider call failed after bounded retries.
- **THIRD_HUMAN_REQUEST** — customer asked for a human N times (default 3).
- **NEGATIVE_SENTIMENT** — turn classifier reports negative sentiment (off by default).

Priority when several fire: `PROVIDER_FAILURE > THIRD_HUMAN_REQUEST > WEAK_GROUNDING >
MODEL_INVOKED > NEGATIVE_SENTIMENT`. The transition is an atomic compare-and-set.

---

## Part 3 — Running it

### Prerequisites

- Node ≥ 22, pnpm 10.33.2 (`corepack enable`).
- PostgreSQL 18 + pgvector 0.8.2, Redis, and an S3-compatible store (MinIO) — or just
  use the Docker stack in `ops/` which brings up all three.

### Fastest path: the full Docker stack

The `ops/` directory runs everything end-to-end (datastores + every service, 2× ai/chat
behind Nginx + full observability):

```bash
cp ops/.env.example ops/.env       # set BETTER_AUTH_SECRET=$(openssl rand -base64 36)
docker compose -f ops/compose.yaml --env-file ops/.env up -d --build
```

Then open the dashboard, sign up an owner, add an allowed origin, set a provider key,
upload KB, and embed the widget. See **[`ops/README.md`](ops/README.md)** for the full
bring-up, the host-port table, the Grafana dashboards, and the realtime load test.

### Local development (without Docker)

```bash
pnpm install                       # install the workspace
pnpm --filter @graft/db db:migrate # run migrations (needs DATABASE_URL)
pnpm dev                           # turbo: run all dev tasks
```

Each app reads config from its own environment (see per-app READMEs). At minimum every
backend service needs `DATABASE_URL`; ai/chat/ingestion also need `REDIS_URL` and the
JWT verify config (`AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`); the gateway and
ingestion need `AI_KEY_ENCRYPTION_KEY` (base64, 32 bytes).

### Repo scripts

| Command              | What it does                              |
| -------------------- | ----------------------------------------- |
| `pnpm build`         | Turbo build all packages/apps             |
| `pnpm dev`           | Turbo dev (watch) all apps                |
| `pnpm lint`          | ESLint across the workspace               |
| `pnpm check-types`   | `tsc --noEmit` across the workspace       |
| `pnpm format`        | Prettier write                            |

---

## Part 4 — API overview

All authenticated calls carry a bearer JWT minted from `GET /api/auth/token` (dashboard)
or are scoped by the widget embed token. Owner-only routes require the `OWNER` role.

### Gateway (`:8080`)

| Method + path                         | Auth        | Purpose                              |
| ------------------------------------- | ----------- | ------------------------------------ |
| `ALL /api/auth/*`                     | Better Auth | Sign-up/in, OTP verify/reset, session, **JWKS**, `/token` |
| `POST /auth/signup`                   | public      | Create org + owner                   |
| `POST /auth/accept-invite`            | public      | Agent sets password from invite OTP  |
| `GET /auth/me`                        | bearer      | Current identity                     |
| `GET/POST/DELETE /org/allowed-origins`| owner       | Widget origin allow-list             |
| `GET /org/embed-token` · `POST .../rotate` | owner  | Widget embed token                   |
| `GET/PUT /org/ai-providers` · `DELETE /:provider` | owner | Provider keyring (encrypted)  |
| `GET/PUT /org/ai-settings`            | owner       | Chat + embedding provider selection  |
| `GET/PUT /org/widget-config`          | owner       | Widget appearance                    |
| `GET/PUT /org/escalation-config`      | owner       | Escalation toggles + thresholds      |
| `GET/POST/DELETE /org/agents`         | owner       | Invite / list / remove agents        |

### ai-service (`:8083`)

| Method + path                | Auth        | Purpose                                  |
| ---------------------------- | ----------- | ---------------------------------------- |
| `GET /widget/conversation`   | embed token | Resume conversation history              |
| `POST /widget/messages`      | embed token | Send a customer message; **SSE** stream of AI tokens |

### chat-service (`:8084`)

| Surface                      | Auth        | Purpose                                  |
| ---------------------------- | ----------- | ---------------------------------------- |
| `GET /org/feed` (SSE)        | bearer      | Org-scoped live conversation feed        |
| Socket.IO (WebSocket)        | bearer/embed| Events: `join`, `claim`, `send`, `handback`, `typing`, `message` |
| `GET/POST /org/conversations/:id/notes` | bearer | Internal notes (REST)              |

### ingestion-service (`:8082`)

| Method + path             | Auth   | Purpose                              |
| ------------------------- | ------ | ------------------------------------ |
| `POST /kb/documents`      | owner  | Upload a KB file (multipart) → 202   |
| `GET /kb/documents`       | owner  | List documents + live ingestion status |

All services expose `GET /healthz`, `GET /readyz`, `GET /metrics` (Prometheus).

---

## Repository layout

```
graft/
├── apps/          gateway · ai-service · chat-service · ingestion-service · widget · dashboard · web
├── packages/      shared · db · auth · crypto · keyring · rag · ai · observability · tsconfig · eslint-config
├── ops/           docker-compose stack, Dockerfile, Nginx LB, Grafana/Prometheus/Tempo/Loki, load-test harness
├── context/       the project context system (overview, architecture, standards, transport, progress)
└── README.md
```

Each app and ops directory has its own README with details. Start with
[`context/architecture.md`](context/architecture.md) for the full design and its
invariants.

## License

Private / unpublished.
