# Iconos públicos y cierres del Radar: auditoría y corrección local

Estado: revisado con el dueño y autorizado para commit/push. Sin deploy ni migración remota.
La base de producción se consultó solamente en lectura. No se modificaron secretos,
archivos `.env`, oportunidades históricas, favoritos, notas ni sincronización.

## Causa comprobada

La consulta de producción encontró 42 oportunidades, 32 de Compra Ágil y 10 de
licitaciones. Todas tenían `closes_raw`, pero ninguna tenía `closes_at` ni cierre
confirmado. Las fuentes entregaban fechas civiles sin zona: por ejemplo,
`2026-10-13 10:00` o `2026-10-15T19:49:00`.

El normalizador anterior conserva esas fechas como texto y sólo genera un instante
si existe offset/Z. El filtro de 24 h consultaba únicamente cierres absolutos o
confirmados, por lo que excluía todo el conjunto observado. Además usaba `>= ahora`,
incluyendo el instante vencido exacto, y la interfaz no tenía un contador periódico.

El filtro ya se aplicaba en la base antes de paginar; ese no era el defecto inicial.
La solución mantiene ese orden y usa la misma fecha efectiva para filtrar, ordenar,
contar, mostrar urgencia y calcular tiempo restante.

## Regla de fechas y limitación de la fuente

Campos utilizados: Compra Ágil `fechas.fecha_cierre`; licitaciones
`Fechas.FechaCierre`, con `FechaCierre` como alternativa del listado. No se usan
publicación, modificación, adjudicación ni `checked_at` como cierre.
Referencias: [diccionario oficial de licitaciones](https://apipre.mercadopublico.cl/documentos/Documentaci%C3%B3n%20API%20Mercado%20Publico%20-%20Licitaciones.pdf)
y los PDF oficiales aportados en `docs/ai-context`.

Las referencias revisadas no garantizan explícitamente la zona de todas las fechas
civiles. Se define **una interpretación operativa** para estas dos fuentes:
`America/Santiago`. Se muestra «Hora de Chile interpretada · por confirmar»;
no se presenta como una fecha ya verificada por ChileCompra. Confirmar siempre
la ficha oficial antes de presentar una oferta. Para Magallanes u otros husos,
la región del comprador no cambia automáticamente el huso del portal.

Prioridad: confirmación del equipo → fecha de fuente con zona explícita →
interpretación de su hora civil en Santiago. Fecha ausente, inválida, hueco DST
o hora repetida ambigua: no disponible, sin inclusión en próximas 24 h.
La verificación manual puede resolver una fecha ambigua cuando se conoce el
instante correcto. No se suman offsets fijos de -3/-4 horas.

## Migración preparada, no aplicada remotamente

`supabase/migrations/20261013014500_radar_deadline_view.sql` crea una función de
conversión y la vista `radar_opportunities_deadlines`, con `effective_closes_at`
y `deadline_basis`. La vista calcula sobre los datos existentes sin reescribirlos.
Es privada, `security_invoker`, accesible sólo a service_role; conserva RLS de
la tabla original. Se comprobó que anon/authenticated no pueden seleccionarla.

La API lee la vista para listados/detalles y sigue escribiendo seguimiento en
la tabla original. Después de guardar consulta la vista; no intenta escribir ni
seleccionar columnas calculadas desde la tabla original. Notas, favoritos,
control de concurrencia y cierre manual se verificaron con PostgreSQL real.

La interpretación nueva permite filtrar fechas civiles ya guardadas y evita
esperar una resincronización. **No habilita correos ni genera nuevos avisos
automáticos sobre fechas interpretadas.** Los avisos de cierre mantienen la regla
actual de fecha inequívoca/confirmada; su automatización no se amplió aquí.

## Consulta, paginación y contadores

Condición exacta: estado publicado y `cierre > ahora && cierre <= ahora + 24 h`.
Instantes UTC; presentación en Chile. La API fija un único `asOf` para ventana,
listado y conteos. Palabras, fuente, región, favoritas, clasificación, perfil,
seguimiento y presupuestos se aplican antes de contar y paginar.

`total`: resultados de todos los filtros aplicados. `closingTotal`: publicadas
dentro de 24 h con los demás filtros aplicados, antes de paginar.
`unknownCloseTotal`: sin cierre válido con esos demás filtros. Estos dos resúmenes
no heredan el checkbox de 24 h para poder informar lo que queda fuera.
El número global de «oportunidades guardadas» del estado de worker es independiente
y ya está identificado como global.

El checkbox aplica inmediatamente, vuelve a página 1 y ordena por cierre próximo.
También se agregan región del comprador y ordenamiento por cierre. Un estado
oficial incompatible con Publicada produce cero resultados; no se ignora el filtro.

El contador por ficha actualiza su reloj cada 30 segundos, sin consultar el listado
al backend. Usa el reloj de referencia de la consulta para reducir diferencias
con el dispositivo y se libera al destruir el componente. Los resultados/conteos
son una **instantánea de la consulta**, identificada en pantalla; «Actualizar
lista» vuelve a calcular el conjunto cuando pasan los cierres. No se hace filtrado
parcial de la página visible para simular un nuevo total global.

## UX/UI pública

Componente `ActionIconComponent`: SVG de trazo coherente para calendario, carta,
ubicación, teléfono, regalo, bolsa, correo, reloj, flechas y actualización.
SVG decorativos ocultos a lectores de pantalla; texto descriptivo permanece.
Silueta WhatsApp obtenida de [Simple Icons, CC0](https://simpleicons.org/?q=whatsapp),
sin dependencia de aplicación. El verde identifica exclusivamente WhatsApp.

Se aplican iconos en header/footer, hero, selección de sabores, Club, contacto,
horarios, reservas, Pedidos/WhatsApp y enlace a opiniones. Botones comparten
alineación, foco, hover, active y disabled; acciones principales con áreas de
44–48 px. Se conserva el teléfono y la URL WhatsApp oficiales configurados.
Se comprobó el número de destino y su enlace; apertura en la app de WhatsApp de
un teléfono real queda pendiente. No se envió ningún mensaje.

## Archivos

- `apps/web/src/app/shared/action-icon.component.ts` y `apps/web/src/styles.css`.
- Componentes públicos App, Home, Club, Reservas, ComingSoon y GoogleReviews.
- `apps/admin/src/app/features/radar/radar.component.*`.
- `apps/api/src/radar/radar.service.ts`, `radar.dto.ts`, `radar.normalize.ts`.
- `packages/shared/src/validation/radar-deadline.ts`, tipos Radar y exports.
- Migración nueva y `radar.deadline*.spec.ts`.

## Validaciones

Shared/API/Admin/Web compilados; Web SSR conserva datos reales y un H1.
Suite general final: **29 suites y 146 pruebas correctas**, incluidos seguimiento
y campos oficiales. Casos de frontera 30 min, 23 h 59,
24 h, 25 h, ahora exacto, vencida, sin fecha, inválida, verano/invierno,
segundos/fracciones, DST ambiguo/hueco y prioridad de confirmación.

PostgreSQL 16/PostgREST desechables: filtro y conteo con 45 filas y tres páginas,
combinaciones de fuente/región/texto/favoritas/estado y seguimiento/concurrencia.
Se comprobó privacidad de la vista y conversiones de verano/invierno en SQL.
Prueba SQL reproducible: `supabase/tests/radar_deadlines.sql`, con rollback.
Las pruebas de normalización y sincronización existentes siguieron pasando.

Navegador: Radar a 1280/390/320 px, paginación, 46 cierres incluidos sobre 48
fixtures, reloj avanzado sin nueva petición del listado y cero errores JS.
Web a 1440/390/320 px y navegación Carta/Reservas/Pedidos/Club, sin overflow.
Los fixtures Radar son ficticios y sólo de la base desechable; las fotos/carta
públicas usadas en Web provienen de la API real. No se usaron sesiones personales.
Capturas y resultados privados: `private-reports/ux-radar/`.

## Próxima publicación, sólo después de revisión

Aplicar una sola vez la migración nueva antes de publicar la API. Después se
requiere desplegar **api, admin y web**. El script recrea también radar-worker
cuando Radar está habilitado para mantener la imagen de API alineada, aunque
no se cambió su lógica de sincronización. No requiere nuevas variables.

El dueño autorizó commit y push después de revisar los resultados y la hora de cierre.
La publicación de código no despliega servicios ni ejecuta SQL en producción.
Las capturas permiten revisar la apariencia; la medición completa WCAG y la
apertura de WhatsApp en dispositivos reales no se presentan como certificadas.
