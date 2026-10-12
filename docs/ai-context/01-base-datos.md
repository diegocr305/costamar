# Base de datos — Supabase (schema public)

> Actualización 12-10-2026: se añadió tipo de campaña `promotion`, RPC de
> administración/emisión y tabla `club_campaign_events` (auditoría backend).
> Cumpleaños es único y sin cupos por restricción de BD. Ver `docs/club-campanas-admin.md`.

Project ref: `pebdhasajkvsjttclbhf`. Postgres. RLS activo en todas las tablas.
Migraciones en `supabase/migrations/` (nombre = timestamp + descripción).

> Para operar la BD usar el MCP de Supabase (power `supabase-hosted`) o la
> Supabase CLI. Flujo: `list_tables` → `apply_migration` → `get_advisors`.

## Identidad y roles
- **profiles** `(id uuid PK → auth.users, full_name, phone, birth_date, avatar_url, created_at, updated_at)`
- **roles** `(id smallint PK, name unique)` — 7 roles.
- **user_roles** `(user_id, role_id, granted_by, granted_at)` PK compuesta. RLS sin políticas (solo backend).
- **staff_members** `(id, profile_id, employee_code, is_active, created_at)`. Solo backend.
- **designated_superadmins** `(email PK, created_at)`. Trigger promueve a superadmin al crear el usuario.

## Carta
- **categories** `(id uuid, name, description, position, is_active, created_at)`
- **products** `(id uuid, category_id→categories, name, description, base_price numeric, is_available, position, source, source_id, source_url, created_at, updated_at)` — 181 filas (importadas de Fudo).
- **product_variants** `(id, product_id→products, name, price, is_active)`
- **product_images** `(id, product_id→products, storage_path, position, created_at)` — ~104 imágenes en Storage.

## Club — membresía
- **club_members**
  `user_id uuid PK → auth.users, member_code text unique, full_name, phone,
   birth_date date, phone_verified bool default false, phone_verified_at timestamptz,
   status in('active','suspended') default active, level in('bronce','plata','oro') default bronce,
   enrolled_at, created_at, updated_at`
  - Alta idempotente por `user_id`. `enrolled_at` se PRESERVA al actualizar (antigüedad).
  - RLS: `club_members self read` (SELECT where auth.uid()=user_id). Escritura solo backend.
- **club_member_preferences**
  `user_id PK, marketing_email bool, marketing_whatsapp bool, language, updated_at`
  - RLS: self read + self update.
- **club_consents**
  `id, user_id, type in('terms','privacy','marketing'), version text, granted bool, granted_at, ip inet`
  - Unique `(user_id, type, version)`. RLS: self read. Insert solo backend.
- **club_auth_events** `(id, user_id, event in('login','enroll','profile_update','consent'), meta jsonb, created_at)` — auditoría. Solo backend.

## Club — cupones y campañas
- **club_campaigns**
  `id uuid, slug unique, name, description, image_path, type in('birthday','founders'),
   status in('draft','active','paused','closed') default draft, starts_at, ends_at,
   max_coupons int, rules jsonb, created_at, updated_at`
  - RLS: `campaigns public read active` (SELECT where status='active'). Escritura solo backend.
  - Campaña actual: slug `fundadores-50`, type `founders`, status `active`, max_coupons `60`.
    `rules` tiene: minAge 18, requiresCompleteProfile, requiresConsumption, benefit
    "1 bebestible personal", options [jugo/bebida/schop], **validityDays: null** (expiración pendiente), expiryPending true.
- **club_campaign_products** `(id, campaign_id→club_campaigns, product_id→products, role in('drink','dessert','gift'))`
  - Unique `(campaign_id, product_id, role)`. RLS: public read de campañas activas.
  - **Vacía por ahora** (no se cargaron los productos permitidos; pendiente).
- **club_coupons**
  `id uuid, code text unique, campaign_id→club_campaigns, user_id→auth.users,
   status in('issued','redeemed','expired','void') default issued,
   issued_at, expires_at (nullable), redeemed_at, period_key text, created_at`
  - **Unique `(campaign_id, user_id, coalesce(period_key,''))`** → sin doble emisión;
    `period_key` permite campañas recurrentes anuales (ej. cumpleaños `y-2026`).
  - RLS: `coupons self read`. Emisión/estado solo backend.
- **club_coupon_redemptions**
  `id, coupon_id→club_coupons, staff_user_id→auth.users, member_user_id→auth.users,
   products jsonb, consumption_ref text, created_at`
  - Unique `(coupon_id)` → un canje por cupón. Solo backend.

## Funciones (RPC, SECURITY DEFINER, solo backend/service_role)
- **issue_founder_coupon(p_user_id uuid)** → `club_coupons`
  - Bloquea la campaña `fundadores-50` (FOR UPDATE), serializa concurrencia.
  - Idempotente (si ya tiene cupón, lo devuelve). Respeta `max_coupons`.
  - Código `FND-xxxxxxxxxx` (de gen_random_uuid). Expiración según `rules.validityDays`
    (si null → sin expiración, no se inventa fecha).
  - Excepciones: `CAMPAIGN_NOT_FOUND`, `CAMPAIGN_NOT_ACTIVE`, `NO_COUPONS_LEFT`.
- **redeem_coupon(p_code text, p_staff_user_id uuid, p_products jsonb, p_consumption_ref text)** → `club_coupon_redemptions`
  - Bloquea el cupón (FOR UPDATE), evita doble canje concurrente.
  - Marca `redeemed`, registra la redención. Vence si está expirado.
  - Excepciones: `COUPON_NOT_FOUND`, `ALREADY_REDEEMED`, `COUPON_NOT_REDEEMABLE`, `COUPON_EXPIRED`.
- **promote_designated_superadmin()** — trigger en auth.users.

## Storage (bucket público `media`)
- `brand/logo.png`, `brand/background.jpg`
- `carta/products/{product_id}/0.webp` (fotos de carta)
- `club/jugo.png` (imagen del regalo de bienvenida)
- Bucket privado `private-uploads` (solo service_role).

## Advisors de seguridad (estado conocido)
- INFO "RLS enabled no policy" en tablas solo-backend (user_roles, staff_members,
  club_auth_events, club_coupon_redemptions, designated_superadmins) → **intencional**.
- WARN "leaked password protection" → no aplica (solo OAuth).

## Pendientes de datos
- **club_campaign_products** vacía: falta cargar los productos permitidos del
  regalo (jugo/bebida/schop) y, a futuro, los del cumpleaños.
- Vigencia de cupones de fundadores: `validityDays` = null (definir).
- Conciliación de socios: hay cuentas de prueba/internas; ver
  `docs/club-fundadores-conciliacion.md`.
