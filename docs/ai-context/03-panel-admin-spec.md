> Estado 12-10-2026: reservas ya implementadas en web/Club/admin con confirmaci?n manual por caja y atenci?n, asignaci?n de mesas, historial y configuraci?n de superadmin. Ver [reservas-primera-version.md](../reservas-primera-version.md) para el comportamiento vigente; las especificaciones anteriores de reservas son hist?ricas.

# Panel Admin — Especificación (PRIORIDAD)

> Actualización 12-10-2026: admin ya accesible, diseño renovado y nueva ruta
> `/club/historial` para consulta de canjes (superadmin/admin/manager/cashier).
> Incluye filtros por fecha chilena y búsqueda por mesa, socio, código o funcionario.
> Campañas ya implementado en `/club/campanas` (12-10-2026). Ver
> `docs/club-campanas-admin.md` para comportamiento real, API y despliegue.
> Reservas implementado. Ver `docs/reservas-primera-version.md`.

App: `apps/admin` (Angular 20 SPA). Dominio: `admin.restaurantecostamar.cl`.
Objetivo: manejo integral de **reservas** y **cupones/campañas**, y a futuro
**inventario**. Reutilizar la app admin existente, no crear otro sistema.

## Lo que YA existe en apps/admin
- Login Google OAuth PKCE (`core/auth.service.ts`), guard `authGuard` y
  `roleGuard([...])`, interceptor que adjunta el token a la API.
- Shell con menú lateral filtrado por rol (`core/navigation.ts`, `layout/shell.component.ts`).
- `features/carta/` — CRUD de carta (referencia de patrón a seguir).
- `features/club/` — **panel de validación de cupones (garzón)** ya hecho:
  - `club-validar.component.*`: escanear QR (cámara, BarcodeDetector) o código manual,
    ver socio + cupones, seleccionar, referencia de consumo, confirmar canje.
  - `club-staff.service.ts`: llama `GET /club/staff/lookup/:code` y `POST /club/staff/redeem`.
  - Ruta `/club/validar` (roles superadmin/admin/manager/cashier).
- Páginas placeholder: inventario, pedidos, usuarios.

## Convenciones del admin (seguir el patrón de features/carta)
- Componentes standalone, signals, `FormsModule` para formularios simples.
- Servicios en `features/<dominio>/<dominio>.service.ts` que llaman a `environment.apiUrl`.
- Rutas en `app.routes.ts` con `roleGuard([...])`. Menú en `core/navigation.ts`.
- Estilo claro (fondo blanco), paleta Costa Mar con variables CSS.
- Permisos POR ROL en frontend (ocultar/guard) Y en backend (@Roles). Nunca confiar solo en el front.

---

## MÓDULO 1 — Campañas y cupones (admin)

### Vistas
1. **Lista de campañas**: tabla con nombre, tipo, estado, cupos (emitidos/max),
   fechas. Acciones: crear, editar, activar/pausar/cerrar.
2. **Editor de campaña**: nombre, descripción, imagen (path en Storage), tipo
   (founders/birthday), estado, fechas, max_coupons, reglas (jsonb), productos
   permitidos (drink/dessert/gift desde la carta).
3. **Cupones de una campaña**: listar/filtrar por estado (issued/redeemed/expired/void)
   y socio. Ver código, socio, fecha emisión, vencimiento, estado.
4. **Historial de canjes**: por campaña o global. Mostrar funcionario responsable,
   socio, producto entregado, referencia de consumo, fecha/hora.
5. **Reportes básicos**: por campaña — cupos totales, emitidos, canjeados, vencidos, disponibles.

### Permisos
- Crear/editar/activar/pausar/cerrar campañas y ver reportes: superadmin, admin, manager.
- Un **cashier NO** puede modificar campañas ni cupos (solo validar/canjear en `/club/validar`).

### Endpoints de API a CREAR (apps/api/src/club, nuevo controller admin)
Protegidos con `@Roles('superadmin','admin','manager')`:
- `GET  /club/admin/campaigns` — todas las campañas (no solo activas) + stats.
- `POST /club/admin/campaigns` — crear.
- `PATCH /club/admin/campaigns/:id` — editar (incluye status: draft/active/paused/closed).
- `GET  /club/admin/campaigns/:id/products` / `PUT .../products` — gestionar productos permitidos.
- `GET  /club/admin/campaigns/:id/coupons?status=&q=` — cupones de la campaña.
- `GET  /club/admin/redemptions?campaignId=` — historial de canjes.
- `GET  /club/admin/stats` — métricas por campaña.
> Todas usan `SupabaseService.client` (service_role). Las mutaciones de estado
> de cupones siguen en RPC. No exponer `service_role` al front.

---

## MÓDULO 2 — Reservas (admin) — NO EXISTE, crear de cero

> Hoy la web tiene una página `reservas` que es un stub. No hay tabla ni API.
> Hay que diseñar el módulo completo. Esto es PRIORIDAD junto con cupones.

### Modelo de datos sugerido (nueva migración Supabase)
```sql
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  -- socio opcional (puede reservar un no-socio con datos de contacto)
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  party_size smallint not null check (party_size between 1 and 30),
  reserved_at timestamptz not null,         -- fecha/hora de la reserva
  duration_min smallint not null default 90,
  status text not null default 'pending'
    check (status in ('pending','confirmed','seated','completed','cancelled','no_show')),
  table_ref text,                            -- mesa asignada (texto libre)
  notes text,
  source text not null default 'web',        -- web/admin/phone
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_reservations_reserved_at on public.reservations(reserved_at);
create index idx_reservations_status on public.reservations(status);
alter table public.reservations enable row level security;
-- RLS: el socio ve/crea las suyas; el personal (backend) gestiona todas.
create policy "reservations self read" on public.reservations
  for select to authenticated using (auth.uid() = user_id);
```
> Decisiones de negocio pendientes (preguntar al dueño): aforo/mesas reales,
> horarios de atención, duración, política de cancelación, anticipación mínima,
> si se confirma automático o manual. NO inventar.

### Vistas del admin
1. **Agenda del día** (default): lista/timeline de reservas de hoy por hora,
   con estado y acciones rápidas (confirmar, sentar, completar, no-show, cancelar).
2. **Calendario/semana**: ver reservas por día.
3. **Detalle de reserva**: datos del cliente, personas, hora, mesa, notas, historial de estado.
4. **Crear reserva manual** (teléfono/presencial).
5. **Filtros**: por fecha, estado, nombre/teléfono.

### Endpoints de API a CREAR (nuevo módulo apps/api/src/reservations)
- Público/socio: `POST /reservations` (crear), `GET /reservations/mine` (socio).
- Admin (`@Roles('superadmin','admin','manager','cashier')`):
  - `GET /reservations?date=&status=&q=`
  - `PATCH /reservations/:id` (cambiar estado, asignar mesa, notas)
  - `POST /reservations` (manual)
- Validaciones backend: anticipación mínima, aforo si se define, no duplicar.

### Permisos
- Ver/gestionar reservas: superadmin, admin, manager, cashier.
- Crear reserva (socio): cualquier autenticado; (público web): endpoint sin auth
  con rate-limit y validación estricta (decidir con el dueño).

---

## MÓDULO 3 — Inventario (FASE POSTERIOR, no ahora)
Placeholder ya existe en el menú. Diseñar después: productos/insumos, stock,
movimientos, alertas de mínimo. La integración con Fudo/comandas es proyecto aparte.

---

## Navegación del admin resultante (core/navigation.ts)
| Sección | Ruta | Roles |
|---------|------|-------|
| Dashboard | /dashboard | todos los staff |
| Reservas | /reservas | superadmin, admin, manager, cashier |
| Carta | /carta | superadmin, admin, manager |
| Campañas | /club/campanas | superadmin, admin, manager |
| Validar cupón | /club/validar | superadmin, admin, manager, cashier |
| Pedidos | /pedidos | superadmin, admin, manager, kitchen, cashier |
| Inventario | /inventario | superadmin, admin, inventory |
| Usuarios | /usuarios | superadmin, admin |

## Orden de implementación sugerido
1. Desplegar el admin a producción (ver `04-despliegue-admin.md`) para probar con HTTPS.
2. Módulo Campañas admin (API + vistas) — reutiliza tablas existentes.
3. Módulo Reservas (migración + API + vistas) — lo nuevo.
4. Reportes básicos.
5. Inventario (después).
