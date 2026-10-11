# ================================================================
# COSTA MAR PLATFORM — API (NestJS) — Dockerfile multi-stage
# Contexto de build: raíz del monorepo (necesita packages/shared)
# ================================================================

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Habilitar pnpm vía corepack
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copiar manifiestos de todo el workspace para que pnpm cree los symlinks.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY apps/club/package.json ./apps/club/

# Instalar todo el workspace: garantiza el symlink @costamar/shared.
RUN pnpm install --frozen-lockfile

# Copiar el código fuente de shared y api
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Compilar shared (genera dist que la API resuelve por node_modules)
RUN pnpm --filter @costamar/shared build \
  && pnpm --filter @costamar/api build

# Podar devDependencies para producción
RUN pnpm --filter @costamar/api deploy --prod /app/deploy

# ---------- Stage 2: runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Usuario sin privilegios
RUN addgroup -S costamar && adduser -S costamar -G costamar

# Copiar artefactos de producción
COPY --from=build /app/deploy/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist

USER costamar
EXPOSE 3000

# Healthcheck interno contra el endpoint de salud
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
