# Encuesta opcional de bienvenida

Implementada el 12-10-2026. Migración aplicada: `20261012160029_club_optional_survey.sql`.

## Experiencia del socio

La pantalla `/personalizar` se ofrece después de activar la membresía. Los socios existentes con perfil completo y sin encuesta registrada la ven al ingresar a Inicio, incluyendo el retorno de Google y la apertura de una sesión que ya estaba guardada. Los perfiles suspendidos o incompletos no reciben esta invitación automática. Las respuestas previas de personalización se conservan y se consideran respondidas, sin inventar fechas históricas.

Preguntas: gustos gastronómicos (varios), compañía habitual (una opción, incluyendo “Aún no he visitado Costa Mar” y “Prefiero no responder”), comuna opcional y permisos separados para correo/WhatsApp. Los permisos nuevos empiezan sin marcar; los permisos existentes se respetan. Todas las preguntas son opcionales. “Ahora no · Entrar al Club” aparece arriba y abajo. La navegación inferior y la invitación a instalar se ocultan en esta pantalla para mantener un solo paso claro.

Puede guardar una respuesta parcial. El botón de guardar solo se habilita con alguna respuesta; una encuesta vacía no se marca respondida. Omitir conserva las preferencias previas y los consentimientos. Después de ver, omitir o responder no se vuelve a ofrecer automáticamente. El socio puede editar sus respuestas en Mi perfil, incluyendo borrarlas. El historial de participación se conserva al borrar datos.

No afecta emisión, canje, cumpleaños, cupos ni vencimientos. Cumpleaños sigue siendo un beneficio general sin límite de socios.

## Registro y consulta

`POST /club/survey`: `{action: 'viewed'|'skipped'|'responded', preferences?}`. La identidad se obtiene del JWT. Responded exige preferencias validadas y al menos una respuesta; guardado y registro ocurren en la misma transacción. La vista se envía después de renderizar las preguntas. Eventos idempotentes; una vista tardía no revierte una omisión ni una respuesta.

En Admin → Socios y preferencias, filtro Encuesta:

- Sin mostrar: no hay una vista o respuesta registrada.
- Vista · sin respuesta: mostró las preguntas sin guardar ni pulsar omitir.
- Omitida: pulsó Ahora no.
- Respondida: guardó al menos una respuesta, aunque falten otras.

Se muestran fechas disponibles en hora de Chile. No se infiere rechazo a promociones por omitir. Las fechas del admin son registros del servidor; un evento reenviado después de una desconexión tiene la fecha de recepción. Respuestas anteriores al lanzamiento pueden figurar respondidas sin fecha.

Si falla la red al registrar vista/omisión, estas acciones quedan pendientes en el navegador, separadas por usuario, y se reintentan al entrar en Inicio. No se guardan respuestas ni contactos en esta cola. La omisión permite continuar aunque falle el registro. Si el navegador impide o borra el almacenamiento, no se puede garantizar el reenvío de eventos pendientes.

RLS activo. Eventos y RPC solo backend. Las columnas de telemetría no tienen permisos de actualización para el cliente; se conservan permisos de edición de preferencias propios. La API de admin consulta `club_segment_members_survey`; se mantiene la función anterior para compatibilidad durante el despliegue.

## Validación y publicación

61 pruebas de API, compilaciones shared/API/admin/Club, pruebas SQL con rollback de estados/permisos/consentimiento/cupones y flujo en navegador con API simulada: nuevos/antiguos, omisión, respuesta parcial, no repetición, errores de red y tamaños 320/390/1280 px. Comprobación de filtros de admin. El acceso real mediante Google se comprueba después del despliegue.

Asesor Supabase: tabla de eventos con RLS sin políticas deliberadamente cerrada al cliente ([referencia](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)); permanece el aviso previo de [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

```bash
git pull origin main
./deploy.sh api admin club
```

Publicar API junto con las interfaces: necesitan el endpoint de encuesta y el nuevo contrato de socios.
