> Estado 12-10-2026: reservas ya implementadas en web/Club/admin con confirmaci?n manual por caja y atenci?n, asignaci?n de mesas, historial y configuraci?n de superadmin. Ver [reservas-primera-version.md](../reservas-primera-version.md) para el comportamiento vigente; las especificaciones anteriores de reservas son hist?ricas.

# Costa Mar — Contexto del proyecto (para IA de desarrollo)

> Este documento y los demás en `docs/ai-context/` son el **brief maestro**
> para una IA que continuará el desarrollo. Léelos todos antes de codear.

## Qué es
Ecosistema digital de **Costa Mar Barra Cevichera** (cevichería peruana en
Quillota, Chile). Monorepo pnpm + TypeScript.

## Apps (monorepo)
| App | Carpeta | Tipo | Puerto dev | Puerto contenedor | Dominio |
|-----|---------|------|-----------|-------------------|---------|
| Web pública | `apps/web` | Angular 20 **SSR** | 4200 | 4000 | restaurantecostamar.cl |
| Club socios | `apps/club` | Angular 20 **PWA** (SPA, service worker) | 4202 | 4002 | club.restaurantecostamar.cl |
| Admin | `apps/admin` | Angular 20 **SPA** | 4201 | 4001 (nginx) | admin.restaurantecostamar.cl |
| API | `apps/api` | **NestJS 10** | 3000 | 3000 | api.restaurantecostamar.cl |
| Shared | `packages/shared` | Librería TS (tipos, constantes, validación) | — | — | — |

## Infraestructura
- **Supabase Cloud** (Postgres + Auth + Storage). Project ref: `pebdhasajkvsjttclbhf`.
  URL: `https://pebdhasajkvsjttclbhf.supabase.co`.
- **AWS Lightsail** Ubuntu 24.04 (4GB), Docker Compose + Nginx 1.24 (nativo).
- **Cloudflare** DNS + HTTPS (Full strict). Proxied.
- Compose piloto: `docker-compose.piloto.yml` (servicios: api, web, club).
- Script de despliegue: `deploy.sh` (ver `docs/deployment.md`).

## Autenticación
- **Supabase Auth con Google OAuth, flujo PKCE**. No hay contraseñas propias.
- Clave **publishable** (`sb_publishable_...`) en los frontends (pública, segura con RLS).
- Clave **secret** (`sb_secret_...`) SOLO en la API (`apps/api/.env`, gitignored).
- JWT validado en la API con **JWKS ES256** (no HS256). El rol de app va en
  `app_metadata.role` del JWT.
- **Gotcha PKCE conocido**: `exchangeCodeForSession()` recibe SOLO el valor del
  parámetro `code`, NUNCA la URL completa (si no, da 404 `flow_state_not_found`).
  Ver `apps/*/src/app/core/extract-oauth-code.ts`.

## Roles (packages/shared/src/constants/roles.ts)
`superadmin, admin, manager, kitchen, inventory, cashier, customer`.
- Panel admin: lo usan superadmin/admin/manager/kitchen/inventory/cashier.
- Validar cupones (garzón): superadmin, admin, manager, cashier.
- El rol vive en `auth.users.raw_app_meta_data.role` y en `public.user_roles`.
- `diegocr305@gmail.com` es superadmin (promoción automática al login, ver
  `designated_superadmins` + trigger `promote_designated_superadmin`).

## Identidad visual
- Paleta marina: turquesa `#12a7c2`, turquesa oscuro `#087c91`, océano `#1263a0`,
  dorado `#e28e06`.
- Tema oscuro premium (Club): fondo `#0e2a38`, superficie `#15415a`, marfil `#f5ebdd`.
- Tipografía: **Rufina** (serif, títulos) + **Lato** (texto).
- Web pública: clara con hero oscuro. Club: oscuro completo. Admin: claro.
- Logo oficial en Storage: `media/brand/logo.png`.

## Reglas de oro del proyecto (NO romper)
- No commitear `.env` ni secretos (están en `.gitignore`).
- `service_role` SOLO en backend, nunca en frontend.
- La API/BD es la **única autoridad** de elegibilidad, cupos, emisión y canje.
- No inventar datos comerciales (horarios, precios, reseñas, fechas).
- RLS activo en todas las tablas; escrituras sensibles solo backend.
- `git pull` nunca toca el `.env` del servidor ni `/etc/nginx`.
- Español en toda la UI.

## Documentos relacionados
- `docs/ai-context/01-base-datos.md` — esquema completo Supabase.
- `docs/ai-context/02-api-endpoints.md` — endpoints de la API.
- `docs/ai-context/03-panel-admin-spec.md` — spec del panel (PRIORIDAD).
- `docs/ai-context/04-despliegue-admin.md` — poner admin en producción.
- `docs/ai-context/05-pendientes-y-reglas.md` — pendientes y reglas de negocio.
- `docs/deployment.md` — despliegue general e historial de fixes.
