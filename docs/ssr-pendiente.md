# Render SSR — RESUELTO (Angular 20)

## Resolución
El bug de SSR (`document is not defined` / `ImagePerformanceWarning`) que
afectaba a Angular 18.2 quedó **resuelto al actualizar a Angular 20 (LTS)**.

Cambios aplicados durante la actualización 18 → 20:
- Todas las apps Angular a `^20.0.0`, Ionic a `^9.0.0` (club), TypeScript a `~5.8`.
- `main.server.ts`: ahora recibe y pasa el `BootstrapContext` a
  `bootstrapApplication` (requerido en Angular 20; su ausencia causaba
  `NG0401 Missing Platform`).
- `server.ts`: usa `CommonEngine` desde `@angular/ssr/node` con
  `allowedHosts` configurado (Angular 20 valida el host del request SSR y, si
  no está permitido, cae a CSR).
- `app.config.server.ts`: `provideServerRendering()` desde `@angular/ssr`.

## Verificación (local, build de producción)
- `GET /` → 200, HTML con hero, footer, JSON-LD y logo renderizados en servidor.
- `GET /carta` → 200, página renderizada en servidor.
- `GET /reservas` → 200, formulario de solicitudes renderizado e hidratado.
  La consulta por enlace privado ocurre sólo en navegador; datos y tokens no
  se incorporan al HTML SSR. Ver `docs/reservas-primera-version.md`.

## Configuración de producción
El server SSR lee `SSR_ALLOWED_HOSTS` (coma-separado). Por defecto incluye
`localhost`, `restaurantecostamar.cl` y `www.restaurantecostamar.cl`. Ajustar
en el contenedor si cambia el dominio.
