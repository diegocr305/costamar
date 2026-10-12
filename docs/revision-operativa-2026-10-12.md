# Revisión operativa — 12 de octubre de 2026

Alcance autorizado: corregir errores de web/Club/admin, preparar guía de atención,
analizar el CSV local y actualizar pendientes. Se conservaron condiciones de
beneficios, cupos, horarios y capacidades acordados. Fudo sigue como POS.

## Correcciones

- Consulta de reserva propia con identidad JWT, sin token de visitante; el Club
  renueva tanto la lista como el resumen individual.
- Reintentos de horarios y mapa, recuperación tras respuesta perdida y mensaje
  cuando caduca una hora seleccionada.
- Enlaces privados al cambiar el fragmento sin recargar toda la página. Una
  respuesta anterior no sustituye una consulta nueva ni navega tras salir de la vista.
- Esperas limitadas en guardados y protección de paginación frente a respuestas
  fuera de orden.
- Preparación contada desde la salida real, también ante visitas que se prolongan.
  La agenda señala el margen de una visita finalizada. No cambia los minutos
  configurados ni cancela automáticamente reservas.

Migración `20261012193029_reservation_actual_preparation.sql` aplicada en Supabase.
No se borraron datos ni se modificaron campañas, cupos o consentimientos.

## Entregables

- [Guía del equipo](guia-equipo-atencion.md): reservas, ingreso manual,
  confirmación/contacto, llegada/salida, canjes, errores y modelos de mensaje manual.
- [Estado vigente](estado-actual-y-proximos-pasos.md) y documentos ai-context
  actualizados; las bitácoras históricas se identifican como tales.
- [Analizador local](../tools/analysis/README.md) versionado, con datos ficticios en tests.
- Informe real en `private-reports/ventas-fudo-2026-10-12/`: HTML/Markdown,
  PDF, gráficos SVG/PNG/PDF, JSON y tablas CSV. La guía también tiene PDF local.

El archivo fuente y los informes quedan excluidos de Git. La herramienta no sube
ventas a la app ni copia nombres, comentarios o funcionarios al reporte agregado.
Las cifras reales permanecen en el informe privado.

## Verificación

- 74 pruebas API, 20 suites: pasaron. Consulta individual usa actor del JWT,
  rechaza UUID inválido y traduce preparación a conflicto HTTP 409.
- 5 pruebas del analizador: importes exactos, exclusión de abiertos/eliminados,
  ceros/negativos, IDs duplicados, importes inválidos y privacidad/escape HTML.
- Builds API/admin/Club/web SSR: pasaron. Shared mantiene tipos compatibles.
- Dos pruebas SQL con rollback: permisos, propiedad, tokens, reintentos,
  uniones/capacidad, superposición, llegada real, grupo aprobado y margen desde
  salida. Una confirmación al terminar exactamente la preparación es válida.
- Navegador local sobre bundles reales con API simulada: solicitudes, cancelación,
  reintentos, enlace inválido, enlace tras respuesta perdida, hora caducada,
  consulta Club, agenda/capacidades/roles/configuración. Sin errores de ejecución.
- Smoke tests de cupones, encuesta opcional y canjes: pasaron. Sin desbordes a
  320/390/1280 px. API simulada; no se enviaron mensajes ni se consumieron regalos reales.
- Informe/guía: revisión de HTML y PDFs A4, imágenes locales, sin scripts ni red.
- Lectura de producción: HTTP 200 en salud API, configuración pública de reservas,
  web de reservas, Club y admin. No se realizaron mutaciones ni login Google real.

Advisor de seguridad sin nuevos hallazgos: persisten INFO de tablas backend con
RLS sin políticas y el aviso anterior de protección de contraseñas filtradas.
Referencias en [documentación de BD](ai-context/01-base-datos.md).

## Publicación y límites

El dueño publica las nuevas correcciones:

```bash
./deploy.sh api web club admin
```

La migración ya está aplicada; no repetirla. Los checks locales no sustituyen
Google/cámara/PWA en dispositivos reales ni la coordinación con Fudo. No se
implementaron gastos, inventario, integración SII ni beneficios por reservar.
