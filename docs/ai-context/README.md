# Costa Mar — Brief para IA de desarrollo

Esta carpeta es el contexto completo para que otra IA continúe el desarrollo.
El dueño usará estos documentos como contexto. **Leer primero el
[estado vigente](../estado-actual-y-proximos-pasos.md)**: las bitácoras anteriores
de fases no representan pendientes actuales ni autorización para reglas nuevas.

## Orden de lectura
1. `00-contexto-proyecto.md` — qué es, apps, infra, auth, roles, reglas de oro.
2. `01-base-datos.md` — esquema Supabase completo (tablas, RLS, funciones, Storage).
3. `02-api-endpoints.md` — endpoints actuales de la API y los que faltan.
4. `03-panel-admin-spec.md` — funciones implementadas y permisos del panel.
5. `04-despliegue-admin.md` — actualizar las aplicaciones ya desplegadas.
6. `05-pendientes-y-reglas.md` — reglas de negocio, decisiones pendientes, pendientes técnicos.

## Prioridad del dueño
1. Consolidar Radar Comercial, desplegado con General diario; correo al final.
2. Consolidar la operación de reservas y cupones con meseros y caja.
3. Analizar ventas exportadas y preparar decisiones de gastos/cuentas por pagar.
4. Recetas/costos e inventario después, cuando haya datos suficientes.

## Cómo trabajar en este repo
- Monorepo pnpm. Comandos: `pnpm --filter @costamar/<app> <script>` (build, dev, test, lint).
- Apps: `web`, `club`, `admin`, `api`, y `shared` (tipos/constantes/validación compartidos).
- Siempre: recompilar `@costamar/shared` tras cambiar tipos (`pnpm --filter @costamar/shared build`).
- BD: usar el MCP de Supabase o la CLI; migraciones en `supabase/migrations/`.
- Despliegue: `deploy.sh` + `docs/deployment.md`. No tocar `.env` del servidor ni `/etc/nginx` por git.
- No commitear secretos. No inventar datos comerciales. UI en español.
- CSV e informes privados fuera de Git; resultados en `private-reports/`.

## Documentos complementarios (fuera de esta carpeta)
- `docs/web-redesign-2026-10-12.md` — rediseño público preparado localmente, sin desplegar.
- `docs/radar-comercial.md` — reglas, arquitectura, endpoints y operación del Radar.
- `docs/guia-radar-comercial.md` — rutina de revisión para dueño y administradora.
- `docs/radar-verificacion-produccion-2026-10-12.md` — pruebas remotas y límites.
- `docs/deployment.md` — despliegue general, actualización segura, rollback, fixes.
- `docs/club-oauth-setup.md` — configuración Google OAuth + Supabase Auth.
- `docs/club-fundadores-conciliacion.md` — reporte de socios para la campaña.
- `docs/club-estado-y-pendientes.md` — bitácora de estado del Club.
- `docs/guia-equipo-atencion.md` — guía para operar reservas y canjes.
- `tools/analysis/README.md` — análisis local reproducible de CSV de Fudo.
- `.kiro/specs/costamar-platform/` — spec original (requirements/design/tasks).
