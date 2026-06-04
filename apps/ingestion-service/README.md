# @graft/ingestion-service

Knowledge-base processing. Fastify 5 + `@fastify/multipart` + **BullMQ**. The only
writer of KB chunks and embeddings. Receives uploads, stages the blob, and runs an
async pipeline: parse → chunk → embed → upsert into the tenant's pgvector namespace.

## Responsibilities

- **Upload ingress** (`POST /kb/documents`, owner-only, multipart): streams the file to
  S3/MinIO under a per-tenant key (`kb/<orgId>/<documentId>`), records document metadata
  (status `PENDING`), enqueues a BullMQ job carrying only the object key, and returns
  `202`. Request handlers never parse/embed inline (invariant 6).
- **Ingestion worker** (`start:worker`): reads the staged object back, parses it
  (`unpdf` for PDF, `mammoth` for DOCX, plain text otherwise), chunks it (`@graft/rag`),
  embeds the chunks with the tenant's selected embedding provider (`@graft/keyring`,
  decrypted in-memory), upserts the vectors, flips the document status to `READY` (or
  `FAILED`), and deletes the staged blob.
- **Document list** (`GET /kb/documents`, owner-only): documents + live ingestion status
  for the dashboard's polling UI.
- **Tenant isolation:** every write is scoped by `organization_id`; KBs are never shared.

## Routes

| Method + path             | Auth   | Purpose                              |
| ------------------------- | ------ | ------------------------------------ |
| `POST /kb/documents`      | owner  | Upload a KB file (multipart) → 202   |
| `GET /kb/documents`       | owner  | List documents + ingestion status    |
| `GET /healthz` · `/readyz` · `/metrics` | public | Liveness / readiness / Prometheus |

## Processes

- **HTTP server** (`src/index.ts`): upload + list surface.
- **Ingestion worker** (`src/worker/index.ts`): drains the ingestion BullMQ queue.

## Layout

```
src/
  index.ts        entrypoint (tracing first)
  server.ts       wiring + graceful shutdown
  app.ts          buildApp: CORS, multipart, JWT auth, kb routes
  env.ts          env schema
  upload/         multipart handling, validation
  storage/        S3/MinIO client (per-tenant keys)
  queue/          BullMQ ingestion queue
  worker/         parse → chunk → embed → upsert pipeline
  routes/         kb-upload (POST + GET list), health, metrics
  plugins/        JWT auth, metrics
```

## Environment

Required: `DATABASE_URL`, `REDIS_URL`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`,
`AI_KEY_ENCRYPTION_KEY` (base64, 32 bytes), `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

Optional: `S3_FORCE_PATH_STYLE` (true for MinIO), `AI_KEY_ENCRYPTION_KEY_ID`,
`MAX_UPLOAD_BYTES`, `WEB_ORIGIN` / `DASHBOARD_ORIGIN` (CORS), `PORT` (default 8082),
`HOST`, `SHUTDOWN_TIMEOUT_MS`.

## Scripts

`pnpm --filter @graft/ingestion-service dev | build | start | start:worker | check-types | lint`
