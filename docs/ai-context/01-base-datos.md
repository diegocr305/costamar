# Base de datos — estado vigente

Actualizado el 12-10-2026. Supabase/Postgres, esquema public. Las migraciones en
`supabase/migrations` son la definición exacta del esquema y de las RPC. Este
resumen reemplaza las notas que presentaban reservas/cumpleaños como pendientes.

## Identidad, carta y Club

| Grupo | Tablas principales | Acceso |
| --- | --- | --- |
| Identidad | profiles, roles, user_roles, staff_members, designated_superadmins | Identidad propia según RLS; roles/atención por backend |
| Carta | categories, products y tablas de imágenes | Carta pública filtrada; escritura autorizada en API |
| Membresía | club_members, club_member_preferences, club_consents, club_auth_events | Datos propios según RLS; cambios por API |
| Beneficios | club_campaigns, club_campaign_products, club_coupons, club_coupon_redemptions, club_campaign_events | Campañas activas/propios según RLS; emisión/canje/admin por backend |
| Equipo | club_team_access, club_team_audit | Backend; gestión por superadmin |
| Encuesta | club_survey_events y campos de preferencias | Backend; estado propio y administración autorizada |

Membresía única por usuario, QR con member_code público y no credencial de canje.
Emisión idempotente por campaña/socio/período, un canje por cupón. Cumpleaños
automático y vencimiento en mes calendario de Chile; no cupos para cumpleaños.
Catálogo y cambios administrativos auditados. El funcionario sale del JWT.

Preferencias y consentimientos no habilitan descuentos ni se presuponen por
reservar. La autorización vigente se consulta mediante club_effective_role.

## Reservas

| Tabla | Contenido |
| --- | --- |
| reservation_settings | Una configuración: duraciones, margen, tolerancia y anticipación |
| reservation_hours | Siete horarios semanales |
| reservation_tables | 26 mesas, zona, capacidad cómoda y máxima |
| reservation_pairs | 12 uniones existentes, habilitación y capacidad conjunta opcional |
| reservations | Solicitud, contacto, horario, propietario, token hash, mesas y estado |
| reservation_events | Cambios de reserva y responsable |
| reservation_config_audit | Cambios de configuración y responsable |

Todas con RLS y privilegios cerrados a anon/authenticated. API mediante service_role.
No otorgar acceso público directo a reservas para simplificar el formulario.

RPC de reservas: reservation_config, reservation_view, reservation_validate_time,
reservation_create, reservation_update, reservation_customer_access,
reservation_list y reservation_save_config. Sólo ejecutables por backend.

- ID/request_key generado por el cliente permite reintento sin duplicados.
- Acceso de visitante con hash SHA-256; socio mediante user_id verificado.
- Una clave incorrecta y un usuario ajeno reciben el mismo acceso rechazado.
- Notas del equipo e historial no se exponen al cliente.
- Bloqueo transaccional serializa creación, edición, cancelación y configuración.
- confirmed/seated bloquean mesas; seated_at registra llegada real y released_at
  registra salida. completed conserva el bloqueo de preparación hasta
  released_at + buffer_minutes. No se libera una mesa en curso por el reloj.
- Sin importación de ocupación de Fudo, descuentos por reserva ni mensajes.

Migraciones de reservas:
20261012183308, 20261012184342, 20261012185209 y
20261012193029_reservation_actual_preparation.sql. Aplicadas en Supabase.

[Reglas y mapa](../reservas-primera-version.md).

## Seguridad y comprobación

Funciones SECURITY DEFINER con search_path endurecido; ejecutar críticos sólo
desde API. No publicar service_role ni habilitar políticas amplias para corregir
un error de frontend.

El advisor conserva INFO de RLS sin políticas en tablas deliberadamente cerradas:
[referencia](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
También conserva el aviso de protección de contraseñas filtradas deshabilitada:
[referencia](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
No se cambió la configuración de Auth en esta revisión.

Tests SQL con BEGIN/ROLLBACK y fixtures ficticios, sin dejar socios, canjes ni
reservas de prueba. No insertar ventas del CSV en estas tablas: el análisis es local.

## Decisiones/datos todavía pendientes

Vigencia/cupos comerciales/conciliación de bienvenida, catálogo concreto y futuros
beneficios. Las tablas de gastos/inventario y la importación de ventas aún no están
implementadas. [Pendientes vigentes](05-pendientes-y-reglas.md).
