# Panel Admin — funciones y permisos vigentes

Actualizado el 12-10-2026. Angular 20 SPA, `apps/admin`,
`https://admin.restaurantecostamar.cl`. Este documento reemplaza la propuesta
anterior de reservas/campañas: ambos módulos están implementados.

## Rutas y permisos

| Ruta | Función | Roles |
| --- | --- | --- |
| /dashboard | Inicio y herramientas del día | Roles de personal; resumen Club sólo superadmin/admin |
| /reservas | Agenda, ingreso manual, asignación, confirmación y atención | superadmin/admin/manager/cashier |
| /club/validar | QR o código, validación/canje y últimos canjes | superadmin/admin/manager/cashier |
| /club/historial | Canjes por fecha, búsqueda y paginación | superadmin/admin/manager/cashier |
| /club/campanas | Campañas, catálogo, cupos, resultados y cupones | superadmin/admin/manager |
| /club/socios | Socios, encuesta y preferencias | superadmin/admin |
| /usuarios | Autorizar/suspender personal de atención | superadmin |
| /radar | Mi Radar, General diario, fichas, perfiles, seguimiento y avisos | superadmin/admin |
| /carta | Consultar carta; escritura restringida en API | superadmin/admin/manager; escritura superadmin/admin |
| /inventario | Pantalla de preparación, sin stock funcional | superadmin/admin/inventory |
| /pedidos | Pantalla de preparación; Fudo sigue como POS | Personal autorizado por navegación |

## Reservas

- Filtrar fecha chilena, estado y cliente/referencia; páginas de 20.
- Crear solicitudes por teléfono/WhatsApp/presencial y asignar mesas por zona.
- Uniones habilitadas y capacidad conjunta validada antes de confirmar.
- Más de dos mesas requiere manager/admin/superadmin para confirmar o cambiar
  asignación; cashier puede recibir/finalizar grupos ya aprobados.
- Estados: pendiente, confirmada, en visita, finalizada, cancelada y no asistió.
- Visita en curso no se libera por reloj; salida real inicia margen de preparación.
- Historial muestra responsable, cambios y notas internas.
- Configuración completa exclusiva superadmin: tiempos, 7 horarios, 26 mesas y
  las 12 uniones previamente aprobadas. No inventar otras uniones/aforo.
- Actualizar agenda y comprobar Fudo: no hay sincronización de clientes sin reserva.
- No envía mensajes ni genera cupones por reservar.

Mapa/contratos: [reservas](../reservas-primera-version.md).
Operación: [guía del equipo](../guia-equipo-atencion.md).

## Club y equipo

Canje requiere mesa; boleta/pedido/nota son opcionales. Identidad del funcionario
desde JWT, folio y transacción en BD. Roles vigentes comprobados por petición;
suspender acceso en Equipo revoca privilegios aunque el token tenga claims viejos.

Referencias:
[canjes](../club-orden-canjes.md),
[campañas](../club-campanas-admin.md),
[equipo](../club-equipo-preferencias.md),
[encuesta](../club-encuesta-bienvenida.md),
[resumen](../club-resumen-admin.md).

## Convenciones

Componentes standalone, signals y FormsModule; API autenticada y DTOs validados.
Navegación filtrada y guards de ruta, con autorización independiente en backend.
Errores y estados vacíos en español; versión móvil comprobada a 320/390/1280 px.
No mostrar funciones preparadas como operativas ni introducir nuevas reglas
comerciales sin datos/acuerdo.

Pendientes reales: [estado y próximos pasos](../estado-actual-y-proximos-pasos.md).
