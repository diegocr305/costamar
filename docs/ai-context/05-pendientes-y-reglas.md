# Pendientes y reglas vigentes — Costa Mar

Actualizado el 12-10-2026. Ver [estado general](../estado-actual-y-proximos-pasos.md).
Esta lista reemplaza los pendientes históricos anteriores.

## Terminado

- Admin operativo con Google, roles vigentes, navegación por permisos y equipo.
- Carta pública/administrativa, Club, QR, emisión/canje de bienvenida y cumpleaños.
- Cumpleaños automático durante el mes chileno, un cupón por socio/año.
- Protección del cambio de fecha de nacimiento tras emitir beneficio.
- Campañas configurables, catálogo, cupos, vigencias, resultados y cupones paginados.
- Mesa obligatoria para canje; pedido/boleta/nota opcionales; folio e historial.
- Encuesta opcional y estados visto/omitido/respondido; preferencias y consentimientos.
- Socios y resumen del Club para superadmin/admin.
- Reservas web sin registro, Club con cuenta, agenda para atención, ingreso manual,
  mesas/uniones, confirmación, llegada/salida, tolerancia y auditoría.
- Correcciones de revisión: estado individual Club, recuperación de enlace,
  hora caducada, reintento de mapa y preparación posterior a salida real.
- Guía del equipo y análisis privado reproducible del CSV, sin importación en BD.

## Reglas confirmadas que se conservan

### Club

- Bienvenida: un bebestible personal entre jugo/bebida/schop, con consumo asociado.
  Personal, no jarra, no acumulable ni canjeable por dinero; alcohol requiere
  mayoría de edad y verificación presencial.
- La campaña se presenta comercialmente como primeros 50 fundadores. Se verificó
  que su configuración técnica todavía tiene 60 cupos para pruebas. No ajustar
  sin resolver conciliación y aprobación comercial.
- Cumpleaños: un bebestible y un postre personal, con consumo asociado, perfil
  completo y socio adulto activo. Vigencia en mes calendario America/Santiago,
  un cupón/año, sin cupos de socios. 29 de febrero cuenta como febrero.
- Encuesta y preferencias opcionales; omitir no afecta regalos. El consentimiento
  promocional se decide por canal y no se presupone por responder o reservar.
- Registros históricos y canjes no se borran para recuperar cupos.

### Reservas

Mapa y reglas completas: [primera versión](../reservas-primera-version.md).

- Salón 1–8/10/12/15: 2 cómodos, máximo 3. Salón 9/11/13/14/16/17/18/19: 4.
- Terraza 20–23 y barra 30–32: 2 por mesa; sin uniones aprobadas.
- 1+2, 3+4, 5+6, 7+8 permiten 6. Uniones vecinas de cada fila grande requieren
  validar capacidad conjunta. Mesa 15 independiente; no unir filas distintas.
- Más de dos mesas: confirmación/cambios especiales por manager/admin/superadmin.
  Atención puede registrar llegada/finalización una vez aprobado el grupo.
- Lunes–jueves 12–19, viernes/sábado 12–22, domingo 12–18.
- Inicialmente 90 min para 1–4; 120 para 5+; preparación 15; tolerancia 15;
  mínimo público 120 min y slots de media hora. Superadmin modifica configuración.
- La solicitud es pendiente hasta confirmación manual. No envía mensajes, no
  concede regalos por reservar y no sincroniza la ocupación de Fudo.
- Una visita sigue ocupando la mesa hasta finalizar; después de la salida real
  se respeta también el margen de preparación.

## Decisiones del dueño pendientes

1. Vigencia de bienvenida, cuentas de prueba y ajuste comercial de cupos.
2. Catálogo concreto de productos autorizados para cada beneficio.
3. Eventual descuento/cortesía por reservar: condiciones, presupuesto y límites.
4. Gastos: responsable, categorías, documentos, pagos parciales y correcciones.
5. Inventario: compras, unidades, conteos, recetas y mermas antes de descontar stock.
6. OTP, WhatsApp/email y otras integraciones: proveedor, costo y alcance.

No introducir estas reglas a partir de una propuesta antigua: requieren decisión
o datos que todavía no están disponibles.

## Validaciones prácticas pendientes

- Google real de cada empleado, cámara QR y PWA en sus teléfonos.
- Ensayo de reservas y canjes con el equipo, siguiendo la [guía](../guia-equipo-atencion.md).
- Desplegar cada nueva corrección cuando el dueño la publique; el admin y
  reservas ya están accesibles, no volver a crear infraestructura existente.

## Próximos módulos propuestos, aún no implementados

1. Gastos/cuentas por pagar con entrada manual e importación.
2. Reportes de ventas CSV en admin con detección de duplicados.
3. Recetas/costos y luego inventario.
4. Registro integral de visitas del Club, puntos, niveles y segmentación de
   frecuencia. Las llegadas de reservas no identifican todas las visitas del Club.

## Reglas técnicas

- service_role sólo backend; secretos y datos privados fuera de Git.
- JWT aporta identidad; autorización consulta el rol vigente en BD por petición.
- RLS y RPC cerradas al cliente para operaciones de atención.
- Backend/BD manda en emisión, canje, elegibilidad, cupos y conflictos de mesas.
- Sin clientes ni importes reales del CSV en código, fixtures o documentación pública.
- El dueño despliega. `./deploy.sh api web club admin` conserva `.env` y Nginx.
