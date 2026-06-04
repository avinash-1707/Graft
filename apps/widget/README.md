# @graft/widget

The embeddable end-customer chat UI. React 19 + Vite 8, bundled as a vanilla JS embed
that boots inside a **Shadow DOM** for full style isolation on any host site. Contains
no business logic and no DB access — it only sends/receives messages for its own
anonymous session within one organization.

## Responsibilities

- **Embed + isolation:** a single script (`<script data-token="ORG_TOKEN">`) mounts the
  widget in a Shadow DOM so the host page's CSS can't leak in or out.
- **Anonymous session:** generates a UUID on first load, persists it in `localStorage`
  (`graft:session-id`), and reloads full conversation history on revisit. No login.
- **AI mode (SSE):** `POST /widget/messages` to ai-service and renders streamed
  `ai_token`s in real time; dedupes by per-conversation sequence.
- **Human mode (WebSocket):** `socket.io-client` connection to chat-service for live
  agent chat.
- **The silent transport switch:** both transports sit behind one `TransportManager`.
  On a `transport_switch` signal it drops SSE / opens WS (or vice versa) off durable
  state, reconnects with `lastSequence` to replay anything missed, and shows only
  **"You are now talking to a human agent"** / **"…an AI agent"** — never any technical
  detail (invariant 3).
- **Theming:** appearance (colors, bot name, greeting, preset, launcher position) comes
  from the tenant's widget config.

## Layout

```
src/
  components/     launcher, panel, message list, composer, mode banner
  transport/      TransportManager — SSE + WS clients, switch, reconnect/replay
  (entry)         Shadow-DOM mount + session bootstrap
```

## Build

Built with Vite into a static embed bundle. The host site loads it with the org's embed
token; the origin must be on the org's allow-list (validated at the gateway).

```bash
pnpm --filter @graft/widget dev       # local dev server
pnpm --filter @graft/widget build     # produce the embed bundle
pnpm --filter @graft/widget preview   # preview the built bundle
```

## Dependencies

`react`, `react-dom`, `socket.io-client`, `@graft/shared` (typed events/contracts).
Tailwind v4 via `@tailwindcss/vite`, scoped inside the Shadow DOM.
