# Radar: comprobación de producción

## Estado posterior a la actualización: pendiente de despliegue resuelto

El dueño confirmó que aplicó sin errores la migración nueva y ejecutó
`./deploy.sh api admin radar-worker`. Se volvió a comprobar a las 22:08 de Chile:

- Columnas `match_kind`/`manual_selected` y tabla `radar_general_cache`: disponibles.
- API health: HTTP 200, Supabase disponible.
- `/api/v1/radar/general`: HTTP 401 sin sesión; ya no devuelve 404.
- JavaScript publicado de Admin: contiene «General diario».
- Worker: heartbeat 01:07:42 UTC, revisión exitosa 01:06:32 UTC,
  sin error ni bloqueo registrado.

El incidente de versión anterior descrito abajo está resuelto. **No repetir
la migración ni desplegar otra vez por este documento.** El recorrido autenticado
de resultados y archivos continúa pendiente: una ruta protegida disponible y un
esquema correcto no demuestran por sí solos ese recorrido. La cache general
estaba vacía en esta comprobación, lo que tampoco demuestra un fallo de la fuente.

## Registro anterior a la actualización

Comprobación realizada el 12-10-2026, aproximadamente a las 21:55 de Chile
(13-10-2026 00:55 UTC). Las cifras y horas describen ese momento.

## Confirmado

- Erin puede entrar con Google como administradora: confirmado por el dueño.
- API pública `/api/v1/health`: HTTP 200 y Supabase disponible.
- Admin `/radar`: HTTP 200; el recurso JavaScript publicado corresponde al
  Radar anterior y no contiene General diario.
- Worker: heartbeat a las 00:52:45 UTC, última revisión exitosa a las
  00:49:40 UTC y sin error ni bloqueo registrado.
- Base: 33 oportunidades guardadas; perfil gastronómico activo en región 5.
  Los cursores de Compra Ágil y licitaciones terminaron su lote reciente.
- Listado y estado de sincronización rechazan consultas sin sesión: HTTP 401.
- Bucket `radar-documents`: privado, límite de archivo de 10 MB.

## Pendiente encontrado: actualización sin publicar

`GET /api/v1/radar/general` devuelve HTTP 404. En la base faltan
`radar_opportunities.match_kind`, `manual_selected` y `radar_general_cache`.
Por tanto, la ampliación de filtros y General diario todavía no está instalada
en producción. No es un resultado vacío de Mercado Público.

El conector Supabase sigue fallando al renovar OAuth. La conexión REST permite
comprobar datos y permisos, pero no ejecutar esta migración SQL. El servidor
se actualiza desde la consola del dueño, según lo acordado.

## Corrección preparada

1. En la consola del servidor, desde el directorio del proyecto:

   ```bash
   git pull --ff-only
   cat supabase/migrations/20261013001000_radar_general_and_matching.sql
   ```

2. Copiar **el contenido completo de ese archivo** y ejecutarlo en SQL Editor
   del proyecto Supabase de Costa Mar. No ejecutar otra vez la migración inicial
   `20261012233000_radar_comercial.sql`. La migración nueva conserva las fichas,
   notas, favoritos y estados; debe ejecutarse una sola vez.

3. Después de que termine correctamente:

   ```bash
   ./deploy.sh api admin radar-worker
   curl -fsS https://api.restaurantecostamar.cl/api/v1/health
   ```

4. Recargar Admin y abrir Radar → General diario. Comprobar ambos procedimientos,
   buscar colación/coffee/alimentación y abrir una ficha. Guardar una oportunidad
   de interés real, agregar una nota y comprobarla después de volver a entrar.
   Si General diario muestra un fallo, conservar el mensaje para diagnosticarlo;
   no interpretarlo como ausencia de compras.

No requiere variables nuevas ni activar correo. Mantener
`RADAR_EMAIL_ENABLED=false`.

## Límites de esta comprobación

No se usaron sesiones personales ni se crearon usuarios de prueba en producción.
No se modificaron oportunidades reales para simular favoritos o notas. El
recorrido autenticado de la versión nueva, la persistencia de seguimiento y
la carga/descarga de archivos siguen pendientes después de la actualización.
Que el bucket sea privado no demuestra por sí solo que la descarga funcione.

Referencia de implementación y pruebas locales: [Radar comercial](radar-comercial.md).
