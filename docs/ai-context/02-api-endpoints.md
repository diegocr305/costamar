# API — contratos vigentes

Actualizado el 12-10-2026. Base: `https://api.restaurantecostamar.cl/api/v1`.
Código en `apps/api/src`; tipos compartidos en `packages/shared/src`.
Este documento reemplaza la lista anterior de módulos propuestos.

## Autenticación y autorización

JWT requerido salvo `@PublicRoute()`. Identidad/firma/expiración mediante
Supabase/JWKS ES256; el rol vigente se consulta en BD por petición, no se concede
a partir de un claim viejo. `RolesGuard` aplica roles del controlador/ruta.
Nunca aceptar identidad de cliente/funcionario desde un body.

DTOs: ValidationPipe con transform, whitelist y forbidNonWhitelisted.
Operaciones críticas en RPC transaccionales con service_role sólo backend.

## Salud y carta

- `GET /health`: público.
- `GET /carta`: público, categorías activas y productos disponibles.
- `GET /carta/categories`, `GET /carta/products`: superadmin/admin/manager.
- `POST|PATCH|DELETE /carta/categories[/:id]` y `/carta/products[/:id]`:
  escritura superadmin/admin. Categoría con productos no se elimina libremente.

## Club — usuario autenticado

- `GET /club/me`: membresía y preferencias propias; registra acceso.
- `POST /club/enroll`: nombre, celular, cumpleaños adulto, términos/privacidad,
  consentimientos por canal; alta idempotente y antigüedad preservada.
- `PATCH /club/preferences`: canales promocionales, comuna, preferencias de
  comida y tipo de visita. Cambios parciales conservan otros datos.
- `GET /club/consents`: consentimientos propios.
- `POST /club/survey`: acción viewed/skipped/responded y preferencias opcionales.
- `GET /club/campaigns`, `GET /club/coupons`: campañas/cupones propios.
  Beneficios se asignan automáticamente cuando corresponde; no requieren reclamar.
- `POST /club/founders/claim`: contrato legado compatible, no es el flujo normal.

[Encuesta](../club-encuesta-bienvenida.md) y
[preferencias](../club-equipo-preferencias.md) detallan valores y auditoría.

## Club — atención

Roles: superadmin/admin/manager/cashier.

- `GET /club/staff/lookup/:memberCode`: socio y cupones para comprobación presencial.
- `POST /club/staff/redeem`: `{code,tableLabel,products?,orderRef?,note?}`.
  Mesa obligatoria; productos `{productId,role}` según catálogo; pedido/nota
  opcionales. Respuesta `{redeemed:true,redemption}`, con folio CAN-….
- `GET /club/staff/redemptions/recent?tableLabel=`: últimos seis de hoy chileno,
  coincidencia exacta de mesa.
- `GET /club/staff/redemptions?date=&q=&page=&pageSize=&campaignId=`:
  historial paginado, responsable y productos entregados.

[Canjes](../club-orden-canjes.md). RPC cerradas al SDK del cliente.

## Club — administración

Roles superadmin/admin/manager salvo restricciones indicadas.

- `GET /club/admin/campaigns`, `GET /club/admin/stats`: campañas/resultados.
- `POST /club/admin/campaigns`, `PATCH /club/admin/campaigns/:id`:
  crear promoción y editar campañas.
- `GET|PUT /club/admin/campaigns/:id/products`: catálogo; PUT recibe
  `{products:[{productId,role}]}`.
- `GET /club/admin/campaigns/:id/coupons?status=&q=&page=&pageSize=`:
  cupones paginados.
- `GET /club/admin/redemptions?campaignId=&date=&q=&page=&pageSize=`: historial.
- `GET /club/admin/members`: superadmin/admin, socios y filtros de encuesta/preferencias.
- `GET /club/admin/overview`: superadmin/admin, resumen agregado de Club.

[Campañas](../club-campanas-admin.md) y [resumen](../club-resumen-admin.md).

## Equipo

- `GET /team`, `POST /team {email,fullName,isActive}`: sólo superadmin.
  Autorizar, cambiar nombre y suspender/reactivar atención; sin enviar correos.
- `GET /team/access`: usuario autenticado, su rol vigente.
- `/users`: contratos administrativos anteriores, restringidos a superadmin.

## Reservas — público

- `GET /reservations/config`: horarios y reglas públicas, sin mapa interno.
- `POST /reservations/public`: `{requestId,accessToken,customerName,
  customerPhone,partySize,reservedAt,areaPreference?,notes?,website?}`.
  UUID generado por cliente y token aleatorio de 64 caracteres hexadecimales.
  Celular +569 y ocho dígitos; hora ISO con zona. Sólo crea pendiente.
- `POST /reservations/public/access {id,accessToken}`: consulta privada.
- `POST /reservations/public/cancel {id,accessToken}`: cancelación propia
  pendiente/confirmada antes de su hora.

Creación limitada a 5 solicitudes por IP cada 5 minutos; consulta 30/min,
cancelación 10/min. El campo trampa website debe estar vacío.
Token sólo como hash SHA-256 en BD, sin secretos/notas internas en respuestas.

## Reservas — autenticado

- `POST /reservations/mine`: misma solicitud; propietario tomado del JWT.
- `GET /reservations/mine?page=`: sólo propias, páginas de 20.
- `GET /reservations/mine/:id`: detalle propio; no acepta token de visitante.
- `POST /reservations/mine/:id/cancel`: cancelación propia.

## Reservas — atención

Roles superadmin/admin/manager/cashier:

- `GET /reservations/admin/config`: reglas, mesas y uniones.
- `GET /reservations/admin?date=&status=&q=&page=`: agenda, páginas de 20.
- `POST /reservations/admin`: solicitud manual; identidad del funcionario por JWT.
- `PATCH /reservations/admin/:id`: estado, personas, hora, mesas,
  capacidad conjunta y nota del equipo.
- `PATCH /reservations/admin/config`: sólo superadmin, configuración completa:
  tiempos, siete horarios, 26 mesas y 12 uniones existentes.

Confirmar requiere asignación/capacidad y ausencia de conflictos. Atención no
aprueba cambios de grupos de más de dos mesas, pero atiende los aprobados.
Una visita ocupa hasta finalizar y respeta preparación desde salida real.
No hay envío de mensajes ni sincronización Fudo.
[Reglas completas](../reservas-primera-version.md).

## Aún no implementado

Gastos/cuentas por pagar, importación de ventas en admin, inventario/recetas,
puntos, OTP y mensajes automáticos. El analizador CSV es local y no es una API.

## Validación

Pruebas Jest en `apps/api/src/**/*.spec.ts` y SQL con rollback en
`supabase/tests`. Ejecutar `pnpm exec jest --runInBand` dentro de apps/api.
Pruebas de propiedad de reservas rechazan UUID inválido, secretos incorrectos y
usuarios distintos; las de conflictos incluyen llegada y preparación reales.

## Radar Comercial

Las rutas nuevas `/api/v1/radar/*` requieren superadmin/admin y usan las
tablas privadas del módulo. Incluyen oportunidades, fichas, seguimiento,
perfiles, estado/cola de sincronización, avisos y documentos privados.
Contrato y despliegue: [Radar Comercial](../radar-comercial.md).
La primera versión está confirmada por el dueño en producción. La ampliación
General diario agrega GET /radar/general y POST /radar/general/:source/:code/import,
y clasificación matched/review/manual. La migración
20261013001000_radar_general_and_matching.sql fue aplicada por el dueño y
API/Admin/worker desplegados; esquema y ruta protegida confirmados remotamente.
Correo Resend preparado, desactivado. Falta el recorrido autenticado completo
de General diario y documentos en producción.
