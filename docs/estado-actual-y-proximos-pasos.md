# Costa Mar — estado actual y próximos pasos

Actualizado el 12 de octubre de 2026. Este documento y
[`ai-context/05-pendientes-y-reglas.md`](ai-context/05-pendientes-y-reglas.md)
son la referencia actual de pendientes. Las bitácoras anteriores describen
entregas históricas; sus frases “no implementado” o “pendiente desplegar” no
sustituyen este estado.

## Implementado

| Área | Funciones listas | Referencia |
| --- | --- | --- |
| Web y carta | Carta pública, categorías, productos/fotos, SSR y formulario de reservas | Código web/API y reservas |
| Club | Google, perfil, QR, regalos disponibles/usados/vencidos, cumpleaños automático | [Lanzamiento](club-lanzamiento-2026-10-12.md) |
| Encuesta opcional | Visto, omitido y respondido; preferencias editables y consentimiento por canal | [Encuesta](club-encuesta-bienvenida.md) |
| Atención | Escaneo/código, mesa obligatoria, folio, últimos canjes e historial | [Canjes](club-orden-canjes.md) |
| Campañas | Crear/editar promociones, catálogo, cupos, vigencia, resultados y cupones | [Campañas](club-campanas-admin.md) |
| Equipo | Dueño autoriza/suspende atención; API consulta el rol vigente por petición | [Equipo](club-equipo-preferencias.md) |
| Resumen del Club | Altas, encuestas, cumpleaños, cupones y canjes para superadmin/admin | [Resumen](club-resumen-admin.md) |
| Reservas | Solicitud web/Club, agenda, ingreso manual, mesas/uniones, confirmación, llegada/salida y auditoría | [Reservas](reservas-primera-version.md) |
| Análisis CSV | Herramienta local reproducible y reporte privado; no importación en la BD | [Análisis](../tools/analysis/README.md) |
| Radar comercial | Búsqueda oficial, sincronización, fichas, perfiles, favoritos, seguimiento, avisos y documentos privados; preparado localmente | [Radar](radar-comercial.md) |

API, configuración pública de reservas y web/Club/admin respondieron HTTP 200 en
la comprobación de lectura del 12-10-2026. Eso verifica disponibilidad, no sustituye
una prueba completa con Google real, cámara y personal en sus dispositivos.
El dueño realiza el despliegue de nuevas correcciones mediante `deploy.sh`.

## Correcciones de la revisión

- Consultar una reserva desde el Club actualiza también su resumen individual.
- Un enlace privado inválido puede reintentarse o abandonarse para crear una nueva solicitud, sin reutilizar por accidente su identificador.
- Al expirar un horario mientras el formulario queda abierto, se solicita elegir otra hora.
- El mapa de mesas puede reintentarse tras un fallo de carga. Las operaciones de guardado tienen tiempo de espera limitado.
- La preparación también se cuenta desde la salida real de una visita finalizada. Se mantiene el margen configurado, incluso ante una salida tardía.
- El CSV y los resultados privados están excluidos de Git. Se reconciliaron importes y se verificó que el reporte no copie nombres ni notas de clientes.

## Decisiones comerciales pendientes

1. **Bienvenida:** definir vigencia, conciliación de cuentas de prueba y ajuste comercial a 50. Se comprobó que la campaña mantiene 60 cupos técnicos y sin vencimiento configurado; no se cambiaron cupos ni cuentas.
2. **Productos de beneficios:** seleccionar el catálogo real cuando aún no esté definido. La herramienta existe; el listado concreto lo decide el negocio.
3. **Reservar con beneficio:** decidir premio/descuento, condiciones, antelación, días, límites y acumulación antes de implementarlo. Hoy reservar no genera cupones.
4. **Gastos:** decidir quién registra, qué comprobantes usará y las categorías iniciales. Definir pagos parciales y correcciones antes de construir cuentas por pagar.
5. **Inventario:** aportar compras, unidades, conteos iniciales, recetas y mermas. Los productos de la carta no equivalen a existencias.
6. **OTP, mensajes y otras integraciones:** elegir proveedor, presupuesto y alcance. No hay envío promocional ni verificación telefónica automática.

## Próximo orden propuesto

El dueño aprobó desarrollar primero Radar Comercial y confirmó la primera
versión en producción. La ampliación de filtros y General diario está
implementada y comprobada localmente; requiere su migración nueva y desplegar
API/Admin/worker. El conector Supabase falla al renovar OAuth, por lo que esa
migración nueva se entrega para ejecución del dueño. El correo sigue desactivado.
Después se retoman los siguientes pasos operativos:

1. Usar reservas y canjes con el equipo y validar Google/cámara/PWA en los teléfonos reales.
2. Gastos y cuentas por pagar con registro manual/importación, después de definir responsables y documentos.
3. Vista de ventas por CSV con previsualización y prevención de duplicados; conservar Fudo como POS.
4. Recetas/costos e inventario cuando se tenga información suficiente.

El análisis privado ofrece comparaciones de ventas y demanda; no calcula utilidad,
stock, productos más vendidos ni obligaciones fiscales. Tampoco identifica
automáticamente clientes de Fudo como socios del Club.

## Validación que depende del entorno real

- Inicio de sesión Google de cada integrante autorizado.
- Cámara QR en Android/iPhone mediante HTTPS.
- Instalación y actualización de la PWA en dispositivos reales.
- Ensayo operativo: solicitud, contacto manual, confirmación, llegada y salida.
- Comprobación de mesas ocupadas en Fudo antes de confirmar reservas.

Guía para el equipo: [`guia-equipo-atencion.md`](guia-equipo-atencion.md).
Los informes de ventas quedan en `private-reports/`, fuera de GitHub.
