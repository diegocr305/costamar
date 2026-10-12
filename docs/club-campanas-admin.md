# Campañas y beneficios — administración

Implementado el 12 de octubre de 2026. Ruta: `/club/campanas` en el admin existente.

## Qué permite

- Superadmin, admin y manager pueden crear promociones y editar beneficios existentes. Cashier conserva escaneo, canje e historial; no puede cambiar campañas.
- Listado de todos los estados: borrador, activa, pausada y cerrada. Resultados globales y por campaña: emitidos, disponibles, canjeados, vencidos, anulados y cupos restantes.
- Editor de nombre, premio personal, descripción, imagen existente, fechas en hora de Chile, cupos, días de uso y productos permitidos de la carta.
- Creación de nuevas campañas de tipo `promotion`; cumpleaños y fundadores conservan su tipo e identificador.
- Cupones paginados, filtrados por estado y nombre/código de socio o cupón. Acceso al historial filtrado por campaña.
- Cambiar el estado del cupón actualiza la lista inmediatamente y vuelve a la primera página; Buscar aplica el nombre o código ingresado. Corregido el 12-10-2026 tras la prueba del dueño.
- El Club muestra título, descripción y premio de cada promoción; ya no presenta toda promoción como regalo de fundadores.

## Reglas

- Cumpleaños es general y sin límite de socios, con un cupón por año y vencimiento al terminar su mes. La interfaz no ofrece cupos ni días de uso para cumpleaños; la BD también rechaza limitarlos.
- Las nuevas promociones deben tener cupos positivos y fecha de término antes de activarse. El inicio puede quedar vacío para comenzar al activarla.
- Se asignan automáticamente a socios activos, con nombre, teléfono, fecha de nacimiento y mayoría de edad, al completar/actualizar perfil o consultar sus cupones. No hay botón de reclamar.
- La emisión es transaccional, idempotente por campaña/socio y respeta los cupos bajo bloqueo de campaña.
- El cupón vence al cumplirse los días configurados o al terminar la campaña, lo que ocurra primero. Modificar la campaña no modifica las fechas de los cupones emitidos.
- Pausar/cerrar detiene nuevas asignaciones. Los cupones existentes conservan su vigencia y pueden canjearse dentro de ella.
- No puede reducirse el límite por debajo del total ya emitido; anulados y vencidos no liberan automáticamente cupos.
- Guardar campaña y catálogo es una operación atómica. Los cambios se registran en `club_campaign_events`, solo backend.
- Cuando existe catálogo, el personal debe seleccionar un producto disponible por cada función configurada (bebestible/postre/regalo). El canje verifica la selección, la membresía activa, el rol del funcionario, la mesa/consumo y evita doble canje. Guarda los nombres entregados en el registro histórico.
- Si todavía no hay catálogo, el personal verifica el premio indicado en la descripción; no se inventan productos ni selecciones.
- Los 60 cupos actuales de fundadores y la vigencia pendiente se preservaron. Excluir cuentas de prueba, fijar 50 cupos comerciales y definir vigencia sigue siendo decisión del dueño.

## API

Roles `superadmin`, `admin`, `manager`:

- `GET /club/admin/campaigns` y `GET /club/admin/stats`: campañas con resultados y productos.
- `POST /club/admin/campaigns`: crear promoción.
- `PATCH /club/admin/campaigns/:id`: editar y cambiar estado.
- `GET /club/admin/campaigns/:id/products`: catálogo configurado.
- `PUT /club/admin/campaigns/:id/products`: reemplazar catálogo (`{products:[{productId,role}]}`).
- `GET /club/admin/campaigns/:id/coupons?status=&q=&page=1&pageSize=20`: cupones paginados.
- `GET /club/admin/redemptions?campaignId=&date=&q=&page=1&pageSize=20`: canjes, reutilizando el contrato del historial de personal.

La API de personal acepta también `campaignId` para filtrar historial. `POST /club/staff/redeem` recibe productos como `{productId,role}`; las opciones se devuelven como `allowedProducts` al consultar el socio.

## Base de datos y despliegue

Migración `20261012141825_club_campaign_admin` aplicada por MCP. Nuevas RPC solo ejecutables por backend. La auditoría tiene RLS activo sin políticas públicas. Los tests SQL crearon datos temporales con rollback; no dejaron promociones de prueba.

Después del push, ejecutar en el servidor:

```bash
./deploy.sh api admin club
```

No volver a aplicar la migración ni modificar `.env` o Nginx para este cambio.

Prueba con cuenta superadmin/admin/manager: abrir Campañas y beneficios, crear un borrador, definir cupos y término, configurar productos, activar y consultar cupones. Usar una cuenta de socio para verificar asignación y una cuenta cashier para canjear los productos elegidos. Confirmar el registro en Historial.

## Validación realizada

- 51 tests Jest de API pasando, incluidos DTOs, roles de administración y horas chilenas (verano/invierno y horas inexistentes por cambio de horario).
- Builds de shared, API, Admin y Club; tipos de API/Admin/Club comprobados.
- Tests SQL: creación, permisos, auditoría, catálogo atómico, cupos, idempotencia, vigencia, pausa, canje con catálogo, filtros y cumpleaños ilimitado. Reejecutados los casos anteriores de cumpleaños e historial.
- Edge local con datos simulados: editor, creación, activación, cupones, historial filtrado, rechazo de cashier en campañas y layout de 320/390/1280 px.
- Security Advisor: avisos informativos esperados para tablas backend sin políticas; ninguna nueva advertencia de seguridad.

Reservas quedan como siguiente módulo; requieren definir capacidad, horarios y reglas de confirmación.
