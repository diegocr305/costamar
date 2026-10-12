# Club Costa Mar — actualización del lanzamiento, 12 de octubre de 2026

> Bitácora histórica de la entrega inicial del día. Campañas, atención, equipo,
> encuesta, resumen y reservas se implementaron después de esta entrega. Para
> pendientes y despliegue actuales leer [estado vigente](estado-actual-y-proximos-pasos.md).

## Estado real

- Supabase: migración `20261012125543_club_automatic_benefits` aplicada por MCP.
- Campaña `barco-cumpleanero` activa: un bebestible + un postre personal, con consumo asociado.
- Dos cupones de cumpleaños emitidos para socios elegibles de octubre, periodo `y-2026`.
- Vencimiento: 1 de noviembre a las 00:00 de America/Santiago (último día de uso: 31 de octubre).
- Cron cada 15 minutos: emisión para socios de su mes y actualización de cupones vencidos. Primer run confirmado como `succeeded`.
- Al completar/actualizar el perfil se asignan cumpleaños y bienvenida si corresponde. La nueva API sincroniza también al consultar cupones.
- Un cupón de cumpleaños por campaña/socio/año; no se vuelve a emitir después de canjear. Cambiar la fecha de nacimiento después de emitir cumpleaños requiere un procedimiento administrativo; la edición ordinaria queda bloqueada.
- Bienvenida conserva 60 cupos para pruebas y vigencia sin definir. No se borraron socios ni cupones existentes. La conciliación y el ajuste comercial a 50 siguen pendientes.

## Interfaz preparada localmente

- Portada con acceso directo a Google, sin pasar por otro botón de ingreso; espera y error visibles.
- Beneficios concretos con iconos de regalo, cumpleaños y teléfono; se eliminaron textos técnicos y promesas de puntos no implementados.
- Página de beneficios explica premios, condiciones y cómo utilizarlos.
- Inicio presenta solo regalos disponibles y evita repetir la misma campaña como noticia. Canjeados y vencidos quedan en Mis cupones.
- Asignación automática: se elimina el paso de reclamar desde Inicio; la ruta antigua de claim sigue compatible.
- Imagen del jugo contenida, con proporción original. Botones dorados con texto oscuro, estados legibles y transición respetuosa de movimiento reducido.
- Acceso a completar perfil para socios antiguos sin teléfono/fecha de nacimiento.
- Navegación inferior oculta para visitantes sin sesión.

## Validación

- Build de shared, Club y API completados.
- Jest API: 38 tests pasando.
- `supabase/tests/club_automatic_benefits.sql`: casos de idempotencia, canje, elegibilidad, cambio de cumpleaños, siguiente año, zona chilena y 29-feb; pruebas con rollback, sin dejar cuentas de prueba.
- Navegador Edge local con datos simulados: acceso directo a OAuth, dos regalos sin duplicados, imagen real del jugo, fecha chilena, pantallas de 320/390/1280 px y sin errores de ejecución.
- Security Advisor sin nuevos hallazgos; avisos conocidos de tablas backend sin políticas y contraseñas filtradas (acceso mediante OAuth).
- La interfaz nueva aún no está publicada en Lightsail. Los cambios se entregan mediante commit y push; el dueño ejecutará el despliegue.

## Admin e historial de atención

- Cuenta `costamarbarracevichera@gmail.com`: rol `cashier` asignado en Supabase, tanto en `user_roles` como en `app_metadata.role`. Cerrar sesión y entrar nuevamente para renovar el JWT.
- Migración `20261012131216_club_staff_redemption_history` aplicada por MCP. RPC solo ejecutable por backend, sin abrir RLS de canjes a los clientes.
- Ruta admin `/club/historial`: fecha chilena, búsqueda por mesa/socio/código/funcionario y paginación. Muestra campaña, socio, código, referencia de consumo, quién confirmó y fecha/hora. Incluye los registros históricos existentes; los que no tenían mesa se muestran sin referencia registrada.
- API `GET /club/staff/redemptions?date=YYYY-MM-DD&q=&page=1&pageSize=20`: mismos permisos de canje (`superadmin`, `admin`, `manager`, `cashier`).
- Nuevos canjes requieren mesa/pedido/boleta en la API; se registra junto al funcionario identificado por el JWT.
- Admin con logo oficial, colores marinos, login renovado, navegación adaptable, herramientas del día y acceso directo del cajero a escanear.
- Admin y API compilados; 42 tests Jest pasando. Pruebas SQL de historial con rollback y navegador en móvil/escritorio, incluidos permisos de cajero y rechazo de rutas de carta/historial para roles no autorizados.

## Publicar

Una vez que el commit esté en GitHub, en el servidor Lightsail, desde la carpeta del repositorio:

```bash
./deploy.sh api club admin
```

El script trae los cambios de GitHub y reconstruye API, Club y Admin. Las dos migraciones ya están aplicadas; no volver a aplicarlas. No modifica `.env` ni Nginx.

Verificación posterior:

```bash
curl -fsS https://api.restaurantecostamar.cl/api/v1/health
curl -I https://club.restaurantecostamar.cl/
docker inspect --format='{{.State.Health.Status}}' costamar-club
docker inspect --format='{{.State.Health.Status}}' costamar-admin
```

En el navegador: revisar la nueva portada; Google debe abrir desde el primer botón. Completar perfil, ver regalos, entrar a Mis cupones y mostrar Mi tarjeta al personal. Si la versión instalada conserva la portada anterior, cerrar y abrir el Club con conexión para permitir actualizarla.

En `https://admin.restaurantecostamar.cl`, ingresar nuevamente con la cuenta del restaurante, escanear, indicar mesa/pedido/boleta y confirmar. En Historial buscar la referencia y verificar socio y funcionario.

## Próximo trabajo

Campañas administrativas y reservas siguen pendientes. Catálogo de productos permitidos, conciliación de cuentas de prueba y vigencia de bienvenida requieren definición antes de ampliar promociones. Este cambio no implementa inventario, puntos ni OTP.
