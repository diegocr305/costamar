# Resumen del Club en admin

Implementado el 12-10-2026. Migración aplicada en Supabase: `20261012165153_club_overview.sql`.

En Inicio (`/dashboard`), superadmin y admin ven “Así va el Club”:

- Socios totales y activos.
- Altas de membresía de hoy, últimos siete y treinta días.
- Cupones disponibles: issued, vigentes y de socios activos. No incluye vencidos ni socios suspendidos; los cupones emitidos de campañas pausadas/cerradas conservan su vigencia según las reglas existentes.
- Canjes de hoy y últimos siete días, según registros de canje.
- Cumpleañeros del mes entre socios activos.
- Encuestas respondidas y porcentaje de socios activos.
- Distribución de encuesta: sin mostrar, vista sin respuesta, omitida y respondida. Estados excluyentes sobre los socios activos; respondida puede ser parcial.

Los periodos incluyen el día actual y usan días calendario en America/Santiago, con límites de medianoche local, sin asumir días de 24 horas. Registros de membresía y canjes no equivalen al total de visitas reales. Omitir no se interpreta como rechazo a promociones. El resumen no emite ni canjea cupones ni modifica beneficios o consentimientos.

“Actualizar resumen” vuelve a consultar. Si falla la primera carga, muestra error y reintento, sin cifras cero ficticias. Si falla después de una carga correcta, mantiene esas cifras y las identifica como la última consulta correcta con fecha y hora. No es un panel en tiempo real.

Los enlaces abren socios activos, cumpleaños, estados de encuesta, campañas/cupons e historial de canjes con la fecha de la consulta. Socios interpreta `birthday=true` y `surveyStatus` de la URL; historial interpreta `date=YYYY-MM-DD`. Cashier mantiene su resumen de canjes y herramientas de atención; no solicita el resumen general. Manager tampoco tiene acceso al resumen general.

## API y seguridad

`GET /club/admin/overview`, solo superadmin/admin. Devuelve `ClubOverview` (tipo compartido): fecha, zona horaria, generatedAt y agregados de members/surveys/coupons/redemptions. No incluye nombres, teléfonos ni correos.

RPC `club_admin_overview(p_actor uuid)`: estable, solo lectura, search_path vacío, ejecución exclusiva para service_role. Comprueba rol vigente del actor y toma una instantánea coherente de los conteos. Identidad del JWT, sin actor desde el cliente. RLS existente permanece activo.

Asesor de seguridad: mismos avisos previos de tablas internas con RLS sin políticas ([referencia](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)) y [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Validación y despliegue

64 pruebas API, compilaciones shared/API/admin, SQL con rollback para permisos/conteos/fechas/vencimientos/socios suspendidos/lectura y navegador con API simulada a 320/390/1280 px para cifras, enlaces, filtros, errores, totales vacíos y aislamiento de cashier. El fixture SQL tiene en cuenta los regalos que asignan los triggers de alta de socios.

En el servidor:

```bash
git pull origin main
./deploy.sh api admin
```

Siguiente paso propuesto: registro de visitas reales, pendiente de acordar cómo identificar una misma visita y evitar duplicados. No implementado en este cambio.
