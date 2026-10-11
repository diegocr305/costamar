# API — Endpoints (NestJS)

Base URL: `https://api.restaurantecostamar.cl/api/v1` (local: `http://localhost:3000/api/v1`).
Prefijo global: `api/v1`. CORS controlado por `ALLOWED_ORIGINS` (env).

## Autenticación y autorización
- Guard global `JwtAuthGuard`: toda ruta exige JWT salvo `@PublicRoute()`.
- Guard global `RolesGuard`: respeta `@Roles(...)`.
- JWT validado por `JwtStrategy` con JWKS ES256. El usuario autenticado queda en
  `request.user = { userId, email, role }`. Rol desde `app_metadata.role` (default `customer`).
- Decoradores: `@PublicRoute()`, `@Roles('superadmin', ...)`, `@CurrentUser()`.

## Health
- `GET /health` — público. `{status, timestamp, version, components.supabase}`.

## Carta (apps/api/src/carta)
- `GET /carta` — **público**. Carta pública: categorías activas + productos
  disponibles + imágenes. (Propiedad: solo disponibles.)
- `GET /carta/categories` — roles superadmin/admin/manager.
- `POST /carta/categories` — superadmin/admin.
- `PATCH /carta/categories/:id` — superadmin/admin.
- `DELETE /carta/categories/:id` — superadmin/admin (409 si tiene productos).
- `GET /carta/products` — superadmin/admin/manager.
- `POST|PATCH|DELETE /carta/products[/:id]` — superadmin/admin.

## Club — socio (apps/api/src/club/club.controller.ts)
Todas exigen JWT (identidad del token, nunca del body).
- `GET /club/me` — membresía del socio + preferencias (null si no es socio). Registra login.
- `POST /club/enroll` — alta/completar perfil. Body `EnrollDto`:
  `{ fullName, phone (obligatorio, normalizado), birthDate (YYYY-MM-DD, valida ≥18 TZ Santiago), acceptTerms, acceptPrivacy, marketingEmail?, marketingWhatsapp? }`.
  Idempotente, preserva `enrolled_at`.
- `PATCH /club/preferences` — `{ marketingEmail?, marketingWhatsapp? }`.
- `GET /club/consents` — consentimientos del socio.
- `GET /club/campaigns` — campañas activas (lectura).
- `GET /club/coupons` — cupones del socio con datos de campaña.
- `POST /club/founders/claim` — reclama el cupón de fundador. Valida socio activo,
  perfil completo, ≥18. Llama RPC `issue_founder_coupon`.

## Club — personal/garzón (apps/api/src/club/staff.controller.ts)
`@Roles('superadmin','admin','manager','cashier')` a nivel de controlador.
- `GET /club/staff/lookup/:memberCode` — datos mínimos del socio + sus cupones
  (para validación presencial). No expone datos sensibles.
- `POST /club/staff/redeem` — confirma canje. Body `RedeemDto`:
  `{ code, products?: unknown[], consumptionRef? }`. Llama RPC `redeem_coupon`.
  Registra funcionario (del JWT), socio, productos y referencia de consumo.

## Mensajes de error de canje/emisión (mapeados a texto)
- Emisión: CAMPAIGN_NOT_ACTIVE, NO_COUPONS_LEFT, CAMPAIGN_NOT_FOUND.
- Canje: COUPON_NOT_FOUND, ALREADY_REDEEMED, COUPON_NOT_REDEEMABLE, COUPON_EXPIRED.

## Lo que FALTA en la API (para el panel admin integral) — IMPLEMENTAR
Ver `03-panel-admin-spec.md`. Resumen de endpoints nuevos sugeridos:
- Campañas (admin CRUD): listar todas, crear, editar, activar/pausar/cerrar,
  configurar productos permitidos, ver estadísticas (emitidos/canjeados/vencidos, cupos).
- Cupones (admin): listar/filtrar por campaña/estado/socio, ver historial de canjes.
- Socios (admin): listar, ver elegibilidad, buscar.
- **Reservas**: NO existe módulo todavía. Hay que crearlo (tabla + endpoints + RLS).
- Inventario: fase posterior.

## Convenciones de código (NestJS)
- Módulo por dominio: `xxx.module.ts`, `xxx.controller.ts`, `xxx.service.ts`, `dto/`.
- DTOs con `class-validator`. ValidationPipe global (whitelist + forbidNonWhitelisted + transform).
- Acceso a datos vía `SupabaseService.client` (service_role).
- Operaciones críticas (emisión/canje/cupos) en funciones RPC transaccionales, no en TS.
- Tests con Jest (`*.spec.ts`). Hoy 36 tests. Lógica de fechas/edad en
  `packages/shared/src/validation/age.validation.ts` (TZ America/Santiago, 29-feb, periodo anual).
