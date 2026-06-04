# @graft/gateway

The public ingress for Graft. Fastify 5 + **Better Auth**. Owns authentication, JWT
issuing (the only signer), org configuration, and widget embed-token / origin
validation. No AI or chat business logic — those live in the realtime services, which
verify the JWTs this service signs.

## Responsibilities

- **Better Auth** mounted at `/api/auth/*` — email+password, mandatory OTP email
  verification, OTP password reset, session (httpOnly cookie), JWKS, and `/token`
  (mint a short-lived EdDSA JWT from a session cookie).
- **Tenancy** rides on Better Auth user `additionalFields` (`organizationId`, `role`,
  both server-set) stamped by a `user.create.before` hook on signup / agent-invite.
- **Org configuration** under `/org/*` (owner-only): provider keyring, AI settings,
  widget config, escalation config, agents, allowed origins, embed token.
- **Tenant AI keys** are encrypted on write here (`@graft/crypto` `Encryptor`,
  AES-256-GCM). The gateway only ever encrypts — it never decrypts or returns a key.
- **Rate limiting** (`@fastify/rate-limit`), stable error shape, graceful shutdown.

## Routes

| Method + path                                | Auth        | Purpose                              |
| -------------------------------------------- | ----------- | ------------------------------------ |
| `ALL /api/auth/*`                            | Better Auth | Sign-in/up, OTP, session, JWKS, token |
| `POST /auth/signup`                          | public      | Create org + owner                   |
| `POST /auth/accept-invite`                   | public      | Agent activates from invite OTP      |
| `GET /auth/me`                               | bearer      | Current identity                     |
| `GET/POST /org/allowed-origins`, `DELETE /:id` | owner     | Widget origin allow-list             |
| `GET /org/embed-token`, `POST /org/embed-token/rotate` | owner | Embed token                  |
| `GET/PUT /org/ai-providers`, `DELETE /:provider` | owner   | Provider keyring                     |
| `GET/PUT /org/ai-settings`                   | owner       | Chat + embedding provider selection  |
| `GET/PUT /org/widget-config`                 | owner       | Widget appearance                    |
| `GET/PUT /org/escalation-config`             | owner       | Escalation triggers + thresholds     |
| `GET/POST /org/agents`, `DELETE /:id`        | owner       | Agent invite / list / remove         |
| `GET /healthz` · `/readyz` · `/metrics`      | public      | Liveness / readiness / Prometheus    |

## Layout

```
src/
  index.ts        entrypoint — starts tracing BEFORE importing server (instrumentation)
  server.ts       wires DB, mailer, Better Auth, encryptor; graceful shutdown
  app.ts          buildApp: Better Auth handler, JWKS bearer auth, rate limit, errors
  env.ts          env schema (fail-fast)
  auth/           Better Auth config, mailer, error shapes
  org/            embed-token generation
  plugins/        auth (authenticate/requireRole), metrics, widget-auth (validateWidget)
  routes/         auth, org-admin, org-config, ai-credentials, widget, health, metrics
  widget/         origin normalization, widget rate-limit key
  http/           parseOr400 (shared validation → 400)
```

## Environment

Required: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`AI_KEY_ENCRYPTION_KEY` (base64, 32 bytes), `EMAIL_FROM`.

Notable optional: `AI_KEY_ENCRYPTION_KEY_ID` (default `v1`), `AUTH_COOKIE_DOMAIN`,
`WEB_ORIGIN` / `DASHBOARD_ORIGIN` (CORS), `SMTP_*` (falls back to a dev json mailer
that logs the OTP when `SMTP_HOST` is unset), `OTP_LENGTH` / `OTP_TTL_MS` /
`OTP_MAX_ATTEMPTS`, `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`,
`WIDGET_RATE_LIMIT_MAX` / `WIDGET_RATE_LIMIT_WINDOW_MS`, `PORT` (default 8080),
`HOST`, `BODY_LIMIT_BYTES`, `SHUTDOWN_TIMEOUT_MS`.

## Scripts

`pnpm --filter @graft/gateway dev | build | start | check-types | lint`
