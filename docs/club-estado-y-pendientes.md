# Club Costa Mar — estado vigente

Actualizado el 12-10-2026. La versión anterior de este archivo era una bitácora
de las fases del 11 de octubre. Ya se implementaron QR, beneficios, campañas,
atención, equipo, encuesta, resumen y reservas.

Consultar [estado actual y próximos pasos](estado-actual-y-proximos-pasos.md)
y [pendientes/reglas vigentes](ai-context/05-pendientes-y-reglas.md) antes de
desarrollar. No interpretar las propuestas antiguas como trabajo autorizado nuevo.

## Club implementado

- Google OAuth PKCE, registro adulto, nombre/celular/cumpleaños, tarjeta QR.
- Emisión automática, bienvenida, cumpleaños anual y promociones configurables.
- Cupones Disponibles/Utilizados/Vencidos, estados vacíos y accesos coherentes.
- Encuesta opcional: visto/omitido/respondido, preferencias y consentimientos.
- Reserva desde la cuenta con precarga y consulta/cancelación de reservas propias.
- PWA con iconos, actualización e instalación; validación en teléfonos reales pendiente.

## Atención/admin implementado

- QR/código, catálogo según beneficio, mesa obligatoria, canje único y folio.
- Últimos canjes del día e historial; responsable desde identidad autenticada.
- Equipo y accesos; autorización vigente comprobada por petición.
- Socios y resumen para administración.
- Agenda de reservas, confirmación manual y tiempos/mesas configurables por dueño.

## Aún requiere decisiones o datos

- Conciliación/cupos/vigencia de bienvenida y catálogo concreto.
- Beneficios futuros por reservar, OTP y mensajes automáticos.
- Gastos, cuentas por pagar y posteriormente inventario/recetas.
- Puntos/niveles y clasificación por visitas reales completas.

No se modificaron las condiciones comerciales de bienvenida durante la revisión:
60 cupos técnicos y vigencia aún sin definir. No se borraron socios para recuperar cupos.

## Referencias actuales

- [Encuesta](club-encuesta-bienvenida.md)
- [Equipo y preferencias](club-equipo-preferencias.md)
- [Resumen](club-resumen-admin.md)
- [Campañas](club-campanas-admin.md)
- [Canjes](club-orden-canjes.md)
- [Reservas](reservas-primera-version.md)
- [Guía del equipo](guia-equipo-atencion.md)
- [Despliegue](deployment.md)

Las bitácoras de lanzamiento permanecen como historial. El código y las
migraciones versionadas, junto con el estado vigente, definen la implementación.
