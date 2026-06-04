# syntax=docker/dockerfile:1.7
#
# One multi-stage image shared by every Node service (gateway, ai-service,
# ingestion-service, chat-service). The target workspace package + its app
# directory are passed as build args; the runner just `node`s the built entry.
# Workers reuse a service image and override the command in compose.
#
#   PKG  workspace package name, e.g. @graft/gateway
#   DIR  app directory under the repo,  e.g. apps/gateway
#
# This is a local dev / load-test image, optimised for correctness over size:
# it ships the full workspace install. For a slim production image use
# `pnpm deploy` with an explicit `files` allow-list per package.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

# --- builder: install the whole workspace, build the target + its deps ---
FROM base AS builder
ARG PKG
COPY . .
RUN pnpm install --frozen-lockfile
# pnpm's trailing-dots selector builds PKG and its workspace dependencies in
# topological order (packages/shared, db, … then the app).
RUN pnpm --filter "${PKG}..." run build

# --- runner ---
FROM base AS runner
ARG DIR
ENV NODE_ENV=production
COPY --from=builder /repo /repo
WORKDIR /repo/${DIR}
# Default entry; ai-/ingestion-service workers override this in compose.
CMD ["node", "dist/index.js"]
