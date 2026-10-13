# Radar Comercial — primera versión

Radar es un módulo privado de Admin, en `/radar`, autorizado para superadmin/admin. Busca oportunidades de Compra Ágil y licitaciones mediante las API oficiales de ChileCompra, guarda sus detalles y permite organizar el trabajo comercial. El Club y la web pública no incluyen esta sección.

## Funciones

### Mi Radar y General diario

Mi Radar muestra por defecto coincidencias del perfil y compras que guardaste
manualmente o marcaste como favoritas. Su filtro «Por revisar» conserva compras
ambiguas: exclusiones, títulos de jornadas/eventos y categorías amplias. Una
coincidencia indica afinidad temática, no elegibilidad ni utilidad garantizada.

El motor reconoce variantes explícitas como colación/colaciones,
almuerzo/almuerzos, coffee/coffe/cofee/café, cena, refrigerio, lunch y cóctel.
La comparación ignora tildes y mayúsculas y exige límites de palabra. Las palabras
excluidas ya no descartan automáticamente una compra mixta: un coffee break con
vasos desechables queda «Por revisar». El detalle también reconoce códigos
UNSPSC concretos observados en las respuestas oficiales. Los títulos sin pistas
pueden seguir escapando al Radar; no se promete cobertura absoluta.

General diario consulta procesos **publicados y activos de cualquier rubro**,
sin heredar palabras, presupuestos o exclusiones del perfil gastronómico.
«Diario» describe la rutina de revisión: incluye publicaciones anteriores que
siguen abiertas, no solamente las publicadas hoy. Compra Ágil permite Todo Chile
o región del comprador; el listado básico de licitaciones es nacional y la
región/comprador se comprueban al abrir el detalle.

La vista está paginada y permite búsqueda manual. «Guardar y ver ficha» incorpora
una oportunidad a tu seguimiento, incluso si no coincide con el perfil.
Los cierres y estados se muestran según la fuente: comprobar siempre la ficha
oficial antes de postular.

Las consultas generales usan cache de 15 minutos y comparten el límite global
de 9.000 consultas/24 h con el worker. No toman su lease ni requieren que termine
una sincronización. Si la fuente falla y existe una copia anterior, se muestra
con fecha y aviso de desactualización; un fallo sin copia no aparece como cero
resultados. «Actualizar fuente» solicita una consulta nueva respetando pausas.
La sincronización prioriza coincidencias claras/seguidas y procesa hasta ocho
detalles de candidatos ambiguos por ciclo para contener consumo.

### Actualizar una instalación que ya tiene Radar

Aplicar **solo la migración nueva**
`supabase/migrations/20261013001000_radar_general_and_matching.sql`; no volver a
ejecutar la migración inicial. Se agregan clasificación, selección manual, cache
general y RPC privadas. Se conservan fichas, favoritos, notas y estados. El
worker reinicia el descubrimiento con las variantes ampliadas.

Después, en el servidor:

```bash
git pull --ff-only
./deploy.sh api admin radar-worker
```

No requiere nuevas variables de entorno ni configurar correo. Mantener
`RADAR_EMAIL_ENABLED=false` si todavía no se activará. La nueva migración fue
probada en PostgreSQL local; el conector MCP continúa fallando al renovar OAuth,
por lo que no se aplicó automáticamente a la base remota.

Rutas nuevas, con los mismos permisos superadmin/admin:

- `GET /api/v1/radar/general`: procedimiento, página, búsqueda, región de Compra Ágil y actualización opcional.
- `POST /api/v1/radar/general/:source/:code/import`: guardar/abrir ficha con identidad del administrador.
- `GET /api/v1/radar/opportunities?match=review`: filtro de clasificación; también admite matched, manual y recommended.

Pruebas adicionales: `supabase/tests/radar_general.sql`, variantes del clasificador,
cache/paginación/fallos de la vista general, guardado manual y permisos HTTP.
Se consultaron ambas listas nacionales reales y se verificó su navegación y
guardado desde navegador con PostgreSQL local. El SQL de prueba usa rollback y
requiere un administrador en la base desechable.

- Listado con búsqueda, procedimiento, estado oficial, perfil, comuna/dirección, presupuestos CLP, favoritos y seguimiento comercial.
- Fichas con comprador, presupuesto y su tipo, lugar/plazo de entrega, convocatoria, cierre original, productos y documentos informados.
- Perfiles configurables: regiones, palabras positivas/negativas, comunas preferidas y presupuestos. Las comunas destacan coincidencias; no certifican distancia ni excluyen automáticamente otros destinos.
- Favoritos, notas y etapas internas independientes de los estados oficiales. «Postulada» registra una acción realizada manualmente en Mercado Público.
- Histórico de cambios, avisos internos y correo transaccional opcional con Resend.
- Carga de PDF/DOCX/PNG/JPG de hasta 10 MB, almacenamiento privado y descarga autorizada con enlace de 60 segundos.
- Sincronización periódica en un proceso separado, contador de consultas, última revisión, errores y reanudación tras límites temporales.

No hay postulación automática, interpretación por IA, puntuación económica ni utilidad calculada en esta entrega. Estos módulos pertenecen a la segunda fase. Los datos se consultan realmente; la aplicación no incluye un catálogo de oportunidades simuladas ni usa los archivos de diagnóstico locales como fuente productiva.

## Fuentes y tratamiento de datos

Compra Ágil usa `/v2/compra-agil` y su detalle por código, con ticket en cabecera. Licitaciones usa `/servicios/v1/publico/licitaciones.json`, con ticket en la consulta saliente del servidor. Las respuestas y errores nunca deben incluir el ticket en el navegador o en logs.

Los presupuestos pueden ser estimados. El listado no garantiza que incluyan IVA. Las líneas «1 EA» o «1 Global» pueden corresponder a un servicio completo; se conserva la descripción y no se inventan raciones. La región del comprador tampoco confirma el destino del servicio.

La API revisada informa adjuntos mediante ID y nombre, sin una descarga de archivos verificada. Se permite adjuntar bases descargadas legítimamente del portal. Las cargas se conservan para revisión humana; no se presentan como documentos ya analizados.

Cuando un cierre no trae zona horaria, se muestra la hora original como pendiente de confirmar. Desde la ficha, el administrador puede verificarla en Mercado Público e ingresar fecha/hora de Chile. La conversión usa America/Santiago y sus cambios de horario. Los avisos de cierre solo se generan con fecha inequívoca o verificada. Si cambia el cierre original, se invalida la confirmación anterior.

El primer llamado de Compra Ágil requiere revisar la condición de empresa de menor tamaño; la consulta de empresa por RUT no acredita elegibilidad. Los requisitos y costos permanecen pendientes hasta su revisión.

Referencias: [API ChileCompra](https://www.chilecompra.cl/api/), [guía Compra Ágil](https://www.chilecompra.cl/wp-content/uploads/2026/05/Documentacion_API_Compra_Agil-2-1.pdf), [convocatorias](https://www.chilecompra.cl/2026/03/compra-agil-conoce-como-funciona-un-segundo-llamado-y-como-participar-correctamente/).

## Arquitectura

`apps/admin/src/app/features/radar` contiene la interfaz Angular. `apps/api/src/radar` contiene rutas, permisos, servicio, adaptadores y worker. `packages/shared/src/types/radar.ts` publica los contratos.

El worker reutiliza la imagen Docker de API, ejecutando `node dist/radar/worker.js`. No abre puerto HTTP ni carga los módulos del restaurante. Esta opción evita duplicar dependencias del monorepo. Tiene límite de 256 MB en el override de Compose; OCR/IA requerirán volver a evaluar recursos.

La migración `20261012233000_radar_comercial.sql` crea tablas `radar_profiles`, `radar_opportunities`, `radar_versions`, `radar_alerts`, `radar_candidates`, `radar_cursors`, `radar_control`, `radar_requests` y `radar_uploads`. Las líneas de productos y metadatos documentales se conservan como arrays JSON dentro de la ficha; los archivos cargados tienen registro separado.

Tablas y RPC están cerradas a anon/authenticated, con RLS y permisos de service_role. El bucket `radar-documents` es privado y una política restrictiva impide acceso directo desde esos roles, incluso si otras políticas de Storage son amplias. La API exige JWT y consulta el rol vigente mediante el mecanismo existente antes de autorizar Radar.

La ingestión transaccional conserva el seguimiento manual, guarda versiones y genera avisos. Notas/favoritos son compartidos por el equipo comercial autorizado. La API rechaza un guardado si otra edición cambió la versión de seguimiento.

## Sincronización

El intervalo propuesto es 900 segundos. El worker verifica la cola cada 30 segundos y utiliza un lease de base de datos para evitar procesos duplicados. Consulta secuencialmente, con 5 segundos entre solicitudes por defecto, cachea candidatos y procesa lotes acotados.

Compra Ágil comienza por procesos publicados de las regiones configuradas. Luego consulta ventanas de cambios con solapamiento de cinco minutos y una fecha final fija por ventana. Se guardan página y candidatos pendientes antes de avanzar. Al cambiar un perfil se reinicia la búsqueda de procesos abiertos, y hay conciliación diaria. La primera carga puede necesitar varios ciclos; el panel lo indica.

Licitaciones consulta el listado activo nacional, selecciona candidatos por palabras y obtiene detalle para comprobar geografía y presupuesto. Los procesos ya guardados que están publicados, favoritos, cotizando o postulados reciben revisión de detalle periódica aunque desaparezcan del listado activo.

El presupuesto local de consultas es 9.000 en una ventana móvil de 24 h, dejando margen respecto del límite público anunciado de 10.000. Esto no permite asumir que no existen límites adicionales: ante HTTP 429 se respeta Retry-After o una pausa de cinco minutos si no está disponible. No reintenta autenticación fallida de inmediato. Los fallos temporales tienen reintentos acotados; un HTTP 200 con error en el cuerpo no se interpreta como lista vacía.

Los datos persistidos y las páginas ya encoladas se conservan ante fallos. Un lease interrumpido caduca después de diez minutos. El indicador de última revisión exitosa describe un lote terminado; la paginación inicial puede seguir pendiente y se informa por separado.

## Configuración y despliegue

Estado de la primera entrega: código y migración comprobados localmente. La conexión MCP de Supabase falló al renovar OAuth y la instalación inicial fue realizada por el dueño, que confirmó su funcionamiento. La ampliación «General diario» requiere su migración nueva y despliegue. El servidor sigue a cargo del dueño.

1. Aplicar en Supabase, mediante SQL Editor o el flujo habitual de migraciones, el contenido completo de `supabase/migrations/20261012233000_radar_comercial.sql`. No volver a aplicar si ya figura en el historial. La migración agrega estructuras propias; no modifica reservas, Club ni carta.
2. En el `.env` del servidor, agregar sin publicar el ticket ya entregado:

```dotenv
RADAR_ENABLED=true
MERCADO_PUBLICO_TICKET=COMPLETAR_EN_EL_SERVIDOR
RADAR_INTERVAL_SECONDS=900
RADAR_REQUEST_DELAY_MS=5000
RADAR_EMAIL_ENABLED=false
```

El ticket quedó configurado en los `.env` locales ignorados por Git. Esto no configura automáticamente el servidor remoto. No imprimir `docker compose config` completo ni copiar `.env` en reportes: puede revelar secretos. Para validar Compose, usar `config --quiet`.

3. Actualizar y levantar API, Admin y worker:

```bash
git pull --ff-only
./deploy.sh api admin radar-worker
```

`deploy.sh` agrega `docker-compose.radar.yml` si encuentra `RADAR_ENABLED=true` o se solicita `radar-worker`. Una vez habilitado, un despliegue de API recrea también el worker para mantener versiones alineadas. Los despliegues normales conservan la configuración del Radar.

Alternativa explícita:

```bash
docker compose -f docker-compose.piloto.yml -f docker-compose.radar.yml --env-file .env config --quiet
docker compose -f docker-compose.piloto.yml -f docker-compose.radar.yml --env-file .env up -d --build api admin radar-worker
docker compose -f docker-compose.piloto.yml -f docker-compose.radar.yml --env-file .env logs --tail=80 radar-worker
```

4. Entrar en Admin → Radar comercial. Verificar heartbeat del worker, perfiles, primera carga y última revisión. El worker no usa el healthcheck HTTP de API: su disponibilidad se observa mediante heartbeat persistido. Comprobar por separado API, reservas y Club después del despliegue habitual.

Para pausar las consultas, detener `radar-worker`. Si se deshabilita Radar en `.env`, detener también el worker existente: quitar el override no elimina automáticamente un contenedor anterior. Las fichas almacenadas pueden seguir consultándose.

## Correo opcional

Adaptador implementado para [Resend](https://resend.com/docs/api-reference/emails/send-email). Requiere cuenta, clave API, dominio/remitente verificado y destinatarios comerciales explícitos. No se utiliza la lista de socios del Club.

```dotenv
RESEND_API_KEY=COMPLETAR_EN_EL_SERVIDOR
RADAR_EMAIL_FROM=Costa Mar Radar <radar@TU_DOMINIO_VERIFICADO>
RADAR_EMAIL_TO=TU_CORREO
RADAR_EMAIL_ENABLED=true
```

Admite hasta cinco destinatarios separados por coma. Desplegar API y worker para aplicar cambios. No se enviaron correos reales durante el desarrollo: el proveedor no está configurado y se dejó desactivado.

Cada aviso tiene clave y cuerpo persistidos para reintentos idempotentes. Después de 23 horas de una entrega ambigua pasa a revisión; no reenvía a ciegas fuera de la ventana del proveedor. Los avisos antiguos, anteriores a activar el correo, se conservan en el panel sin generar una avalancha de envíos. Véase [idempotencia de Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Endpoints internos

Todos bajo `/api/v1/radar`, para superadmin/admin:

| Método y ruta | Función |
| --- | --- |
| GET /opportunities | Listado paginado y filtros |
| GET /opportunities/:id | Ficha, documentos guardados y registro de cambios |
| PATCH /opportunities/:id/tracking | Notas, favorito, etapa y cierre verificado |
| GET /profiles | Perfiles |
| POST /profiles | Crear perfil |
| PATCH /profiles/:id | Editar/pausar perfil |
| GET /sync/status | Estado y consumo |
| POST /sync | Solicitar revisión; limitado a una solicitud por minuto |
| GET /alerts | Últimos cien avisos |
| PATCH /alerts/:id/read | Marcar leído para el equipo |
| POST /opportunities/:id/documents | Cargar documento privado |
| GET /opportunities/:id/documents/:documentId | Generar descarga autorizada |

## Verificación

- Compilación de shared, API y Admin.
- Tests de API, incluyendo roles/DTO, variaciones reales de formatos, unidades globales, zonas horarias, cuotas y correo idempotente.
- `supabase/tests/radar.sql`: aislamiento, lease, cuota, ingestión repetida, seguimiento conservado, cambio de cierre y candidatos pendientes; ejecución con rollback en PostgreSQL 16 local.
- Tests de sincronización con PostgreSQL/PostgREST real: reanudación tras página fallida, conservación de candidatos, deduplicación, ficha desaparecida y reinicio al cambiar perfil.
- Navegador con registros oficiales persistidos: filtros con acentos, fichas, seguimiento, perfiles, avisos, teclado y tamaños 320/390/1280 px; caja sin acceso.
- Imagen Docker API/worker construida y conexión oficial v1 desde Node 22/Alpine con TLS válido. Worker ejecutado con base local y API oficial: importó fichas y pausó correctamente al recibir HTTP 429.

Los tests de sincronización requieren un PostgreSQL/PostgREST **desechable** en loopback. Están desactivados en la ejecución normal si no existe `RADAR_TEST_REST_URL`. Sus preparaciones eliminan datos Radar en esa base de pruebas; nunca apuntar al servidor del negocio.

```powershell
$env:RADAR_TEST_REST_URL='http://127.0.0.1:54331'
pnpm --filter @costamar/api exec jest --runInBand
```

Falta comprobar en el entorno remoto la migración, el acceso Google del dueño, las descargas de Storage y el envío real de correo cuando se elija/configure el proveedor. Los tests locales no sustituyen esas verificaciones.
