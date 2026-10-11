# ================================================================
# COSTA MAR PLATFORM — Web pública (Angular SSR) — multi-stage
# Contexto de build: raíz del monorepo
# ================================================================

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY apps/club/package.json ./apps/club/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN pnpm --filter @costamar/shared build \
  && pnpm --filter @costamar/web build

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup -S costamar && adduser -S costamar -G costamar

# El build SSR genera dist/web con server/ y browser/
COPY --from=build /app/apps/web/dist/web ./dist/web

USER costamar
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/ || exit 1

CMD ["node", "dist/web/server/server.mjs"]
