# Costa Mar — Brief para IA de desarrollo

Esta carpeta es el contexto completo para que otra IA continúe el desarrollo.
El dueño usará estos documentos como especificación. **Léelos en orden.**

## Orden de lectura
1. `00-contexto-proyecto.md` — qué es, apps, infra, auth, roles, reglas de oro.
2. `01-base-datos.md` — esquema Supabase completo (tablas, RLS, funciones, Storage).
3. `02-api-endpoints.md` — endpoints actuales de la API y los que faltan.
4. `03-panel-admin-spec.md` — **PRIORIDAD**: spec del panel (reservas + cupones + inventario).
5. `04-despliegue-admin.md` — poner `admin.restaurantecostamar.cl` en producción.
6. `05-pendientes-y-reglas.md` — reglas de negocio, decisiones pendientes, pendientes técnicos.

## Prioridad del dueño
1. Desplegar el panel admin a producción.
2. Panel con manejo integral de **reservas** y **cupones/campañas**.
3. Inventario, después.

## Cómo trabajar en este repo
- Monorepo pnpm. Comandos: `pnpm --filter @costamar/<app> <script>` (build, dev, test, lint).
- Apps: `web`, `club`, `admin`, `api`, y `shared` (tipos/constantes/validación compartidos).
- Siempre: recompilar `@costamar/shared` tras cambiar tipos (`pnpm --filter @costamar/shared build`).
- BD: usar el MCP de Supabase o la CLI; migraciones en `supabase/migrations/`.
- Despliegue: `deploy.sh` + `docs/deployment.md`. No tocar `.env` del servidor ni `/etc/nginx` por git.
- No commitear secretos. No inventar datos comerciales. UI en español.

## Documentos complementarios (fuera de esta carpeta)
- `docs/deployment.md` — despliegue general, actualización segura, rollback, fixes.
- `docs/club-oauth-setup.md` — configuración Google OAuth + Supabase Auth.
- `docs/club-fundadores-conciliacion.md` — reporte de socios para la campaña.
- `docs/club-estado-y-pendientes.md` — bitácora de estado del Club.
- `.kiro/specs/costamar-platform/` — spec original (requirements/design/tasks).
