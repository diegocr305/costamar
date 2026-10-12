# Reservas — primera versión, 12 de octubre de 2026

Implementado en web `/reservas`, Club `/reservas` y admin `/reservas`.
Fudo mantiene pedidos, ocupación de clientes sin reserva y arqueo de caja.
Esta versión no sincroniza Fudo ni envía mensajes automáticos. El equipo contacta
al cliente por su celular para confirmar. No concede descuentos ni cortesías.

## Operación diaria

1. El cliente solicita sin registro desde la web. En Club se precargan nombre y celular y se consultan las reservas propias.
2. La solicitud queda **pendiente**; todavía no ocupa mesas ni promete disponibilidad.
3. Caja o atención consulta la agenda por fecha chilena, verifica también Fudo, asigna mesas y confirma. Puede ingresar solicitudes recibidas por teléfono o presencialmente.
4. Al recibir al cliente registra **En visita**. Cuando se desocupan las mesas registra **Finalizada**. El sistema conserva quién realizó cada cambio.
5. Después de la tolerancia se puede marcar **No asistió**. No se cancela automáticamente.

Los roles `cashier`, `manager`, `admin` y `superadmin` gestionan la agenda.
`cashier` necesita aprobación de manager/admin/superadmin para confirmar o cambiar
una asignación de más de dos mesas. Puede recibir y finalizar un grupo ya aprobado.
Sólo `superadmin` cambia reglas, horarios, capacidades y uniones habilitadas.

## Configuración inicial aprobada

| Mesas | Cómodos | Máximo individual |
| --- | --- | --- |
| Salón 1–8, 10, 12, 15 | 2 | 3 |
| Salón 9, 11, 13, 14, 16, 17, 18, 19 | 4 | 4 |
| Terraza 20–23 | 2 | 2 |
| Barra 30–32 | 2 | 2 |

Uniones 1+2, 3+4, 5+6 y 7+8: máximo conjunto 6.
Uniones 10+12, 12+14, 14+16, 16+18 y 9+11, 11+13, 13+17, 17+19:
el equipo debe comprobar y registrar la capacidad conjunta antes de confirmar.
Los grupos de más de dos mesas deben formar una cadena de uniones habilitadas y
registrar capacidad real. La mesa 15 es independiente. No se unen filas distintas.
Terraza y barra no tienen uniones aprobadas; no se agregan sillas automáticamente.

| Días | Horario |
| --- | --- |
| Lunes a jueves | 12:00–19:00 |
| Viernes y sábado | 12:00–22:00 |
| Domingo | 12:00–18:00 |

- Visita prevista: 90 minutos para 1–4 personas; 120 para 5 o más.
- Preparación entre visitas: 15 minutos. El final de la visita debe quedar dentro del horario; el margen de preparación puede extenderse después del cierre.
- Tolerancia: 15 minutos. Llegadas desde 15 minutos antes, el día de la visita.
- Solicitudes públicas: al menos 120 minutos antes, horas de llegada cada 30 minutos.
- Ingreso manual: permite solicitudes cercanas dentro del horario, hasta 15 minutos después de la hora prevista.
- Tamaño de solicitud: 1–100 personas como límite técnico. No representa aforo ni disponibilidad garantizada; sólo se confirma si la asignación validada tiene capacidad.

Los horarios configurables controlan reservas. Cambiar estos horarios no modifica
automáticamente los textos generales de horario en la web. La versión publicada
del horario general también actualiza domingo a las 18:00.

## Privacidad y disponibilidad

El visitante conserva un enlace privado con UUID y token aleatorio en el fragmento
`#` del navegador. El token se envía por POST y sólo se almacena su hash SHA-256;
no aparece en consultas URL ni en el HTML SSR. El enlace permite consultar y cancelar
reservas propias pendientes/confirmadas antes de su hora. Compartirlo concede ese acceso.
Las reservas del Club se autorizan por identidad JWT. Notas internas e historial de
funcionarios se excluyen de las respuestas al cliente.

Tablas y RPC están cerradas a `anon`/`authenticated`; sólo la API con `service_role`
accede al módulo. Creación pública limitada a 5 solicitudes por IP cada 5 minutos,
con validación de datos y campo trampa. En producción la API confía en un proxy:
Nginx, con el puerto Docker de API ligado a loopback.

Los cambios de reservas se serializan con bloqueo transaccional en PostgreSQL.
Una misma solicitud puede reintentarse sin duplicarla. Reservas confirmadas y en
visita impiden superposiciones de sus mesas, incluyendo preparación. Las llegadas
reales pueden extender el intervalo previsto y una visita en curso sigue ocupando
la mesa hasta finalizarla. Una llegada incompatible con el próximo turno se rechaza
para revisión del equipo. Estas comprobaciones no conocen clientes sin reserva en Fudo.

Los cambios de configuración se auditan. Las reservas existentes conservan sus
duraciones, márgenes y tolerancias guardados; la capacidad se valida al modificar
una asignación. No se cancelan reservas existentes al editar la configuración.

## Verificación y despliegue

Pasaron 72 pruebas API, builds de shared/API/admin/Club/web SSR y dos pruebas SQL
transaccionales con rollback. Cubren privacidad, roles, reintentos, uniones,
capacidad, conflictos, cancelación, ocupación real y llegada de grupos aprobados.
Revisión de navegador sobre bundles reales con API simulada: SSR/hidratación,
solicitud/reintento/enlace privado/cancelación, precarga Club, agenda de caja,
confirmación y configuración de propietario, sin desbordes a 320/390/1280 px.
No se enviaron mensajes ni se crearon reservas reales durante esta revisión.

Las tres migraciones de reservas están aplicadas en Supabase. Para publicar aplicaciones:

```bash
./deploy.sh api web club admin
```

Después del despliegue, comprobar con el acceso Google real del equipo: agenda,
solicitud de prueba, confirmación, llegada y finalización. La comprobación de
navegador usa identidades simuladas y no sustituye esa validación en producción.

El advisor de Supabase muestra INFO de RLS sin políticas en tablas que están
intencionalmente cerradas al cliente ([referencia](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).
Persiste el aviso anterior de protección de contraseñas filtradas deshabilitada,
sin cambios en esta entrega ([referencia](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

Próximos módulos independientes: gastos/cuentas por pagar con ingreso manual o
CSV, análisis de ventas exportadas y, posteriormente, inventario con recetas.
El CSV histórico de ventas del usuario no forma parte del código publicado.
