# @graft/dashboard

The owner/agent admin app. Next.js 16 (App Router, React 19) + TanStack Query +
shadcn (Base UI) on a solid red theme. Where owners configure the org and agents work
live conversations. Talks to the gateway (auth + config), ingestion-service (KB), and
chat-service (realtime).

## Responsibilities

- **Auth bridge:** sign-in happens on the `web` app; the dashboard reads the shared
  httpOnly session cookie and mints a short-lived JWT from `GET /api/auth/token` to call
  the gateway/services as a bearer token (re-mints once on 401).
- **Owner configuration:** AI provider keyring + chat/embedding selection, widget
  customization with live preview, escalation toggles/thresholds, agent invite/list/
  remove. Validated with shared Zod contracts via `validate()`.
- **Knowledge base:** drag/drop + picker upload to ingestion-service, document list with
  live status polling (only while docs are pending/processing).
- **Live feed:** streams chat-service `GET /org/feed` (SSE) read-only with state badges;
  reconnects with backoff + re-snapshot.
- **Conversation workspace:** master/detail. Claim over WebSocket (`ChatSocket`,
  authenticated as **AGENT** with the minted JWT, re-joins open rooms with the live
  cursor on reconnect — invariant 11), agent↔customer chat, handback, and agent-only
  internal notes (REST). Conversation _state_ stays owned by the org feed (one source of
  truth).

## Layout

```
src/
  app/
    (app)/          guarded shell: settings, agents, knowledge, conversations
  components/
    settings/       AI provider, widget config + preview, escalation
    agents/         invite + list + remove
    knowledge/      upload dropzone, document rows, status badges
    conversations/  feed list, conversation detail, message thread, composer, notes
    ui/             shadcn primitives (Base UI)
    shell/ providers/ common/
  lib/
    api/            typed fetch clients (gateway, ingestion, chat, notes)
    auth/           cookie → token minting
    hooks/          use-org-feed, use-chat-socket, use-me
    realtime/       ChatSocket (agent WebSocket)
```

## Environment

- `NEXT_PUBLIC_CHAT_URL` (chat-service, default `:8084`)
- `NEXT_PUBLIC_INGESTION_URL` (ingestion-service, default `:8082`)
- Gateway base URL for auth/config (default the gateway origin).

## Scripts

`pnpm --filter @graft/dashboard dev` (port **3001**) `| build | start | check-types | lint`
