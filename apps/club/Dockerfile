# ================================================================
# COSTA MAR PLATFORM — Club (Ionic/Angular PWA) — multi-stage
# Contexto de build: raíz del monorepo
# Runtime: nginx estático (SPA fallback + PWA)
# ================================================================

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/club/package.json ./apps/club/

RUN pnpm install --frozen-lockfile --filter @costamar/club...

COPY packages/shared ./packages/shared
COPY apps/club ./apps/club

RUN pnpm --filter @costamar/shared build \
  && pnpm --filter @costamar/club build

# ---------- Stage 2: runtime ----------
FROM nginx:1.24-alpine AS runtime

COPY apps/club/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/club/dist/club/browser /usr/share/nginx/html

EXPOSE 4002

# Healthcheck: usar 127.0.0.1 (IPv4 explícito). "localhost" puede resolver a
# ::1 (IPv6) dentro del contenedor y fallar aunque Nginx escuche en 4002.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4002/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
