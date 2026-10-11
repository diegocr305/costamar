# ================================================================
# COSTA MAR PLATFORM — Admin (Angular SPA) — multi-stage
# Contexto de build: raíz del monorepo
# Runtime: nginx estático (SPA fallback a index.html)
# ================================================================

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/

RUN pnpm install --frozen-lockfile --filter @costamar/admin...

COPY packages/shared ./packages/shared
COPY apps/admin ./apps/admin

RUN pnpm --filter @costamar/shared build \
  && pnpm --filter @costamar/admin build

# ---------- Stage 2: runtime ----------
FROM nginx:1.24-alpine AS runtime

# Config SPA: todas las rutas sirven index.html
COPY apps/admin/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist/admin/browser /usr/share/nginx/html

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4001/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
