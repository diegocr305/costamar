# Equipo y preferencias del Club

Implementado el 12-10-2026. Base de datos actualizada con la migración `20261012154557_club_team_personalization.sql`.

## Equipo y accesos

El superadministrador entra en **Equipo y accesos** (`/usuarios`), escribe nombre y correo de Google, y guarda. Puede editar el nombre o suspender/reactivar el acceso. El rol asignado es `cashier`, mostrado como Atención / mesero. Permite validar cupones, consultar canjes y operar la agenda de reservas; no gestionar campañas, socios ni accesos. Los cambios de reservas de más de dos mesas requieren manager/admin/superadmin; atención puede recibir y finalizar grupos ya aprobados.

No crea contraseñas ni envía correos. El dueño comparte `https://admin.restaurantecostamar.cl` con el integrante; este ingresa con Google usando el correo autorizado. Si aún no existe su cuenta, queda pendiente y se asigna el rol cuando Supabase confirma su correo. Incluye automáticamente al personal cashier que ya existía.

`GET /team`, `POST /team {email,fullName,isActive}`: solo superadmin. `GET /team/access`: cualquier usuario autenticado, devuelve su rol vigente. La API valida firma/expiración del JWT y consulta `user_roles` en cada petición: suspender quita los permisos de atención aunque el token conserve claims anteriores. Conserva cuenta de Club y canjes históricos. Operaciones de acceso atómicas y auditadas; no permite cambiar cuentas con roles de administración desde Equipo.

Las rutas antiguas `/users` también quedan restringidas al superadmin. El frontend renueva su rol al iniciar sesión y al entrar en rutas con permisos. Si la comprobación falla, no concede privilegios.

## Personaliza tu experiencia

En **Mi perfil**, después del registro, aparece “Conozcámonos mejor”. Comuna, preferencias gastronómicas (varias) y tipo de visita son opcionales, editables y se pueden borrar. No modifican la elegibilidad de los regalos. No se solicita género. El teléfono conserva el ajuste pedido anteriormente: `+56 9` fijo y ocho dígitos.

`PATCH /club/preferences` admite `commune`, `foodPreferences` (`seafood`, `hot_dishes`, `drinks`, `desserts`) y `visitType` (`family`, `couple`, `friends`, `alone`, `prefer_not_to_say`, o vacío), además de `marketingEmail` y `marketingWhatsapp`. Identidad del JWT, sin userId del cliente. Guarda el cambio y el consentimiento promocional en una transacción; las modificaciones de canales tienen auditoría. Los cambios parciales conservan los otros campos.

## Socios y preferencias

Superadmin/admin pueden consultar `/club/socios` y `GET /club/admin/members`. Filtros combinables por cumpleaños del mes de Chile, gustos, tipo de visita, comuna exacta, nombre/código y canal promocional autorizado. Paginación de veinte resultados. Los contactos se muestran únicamente para sus respectivos canales consentidos; se consultan preferencias actuales.

Cumpleaños sigue siendo un beneficio general sin cupos. Gustos y visitas familiares son declaraciones del socio. No se deduce frecuencia ni inactividad a partir del registro o de cupones: falta integrar visitas/pedidos. El envío de campañas, correo, WhatsApp o notificaciones no está implementado en esta versión.

## Validación y publicación

58 pruebas de API; compilaciones de shared/API/admin/Club; SQL con rollback para permisos, autorización pendiente, suspensión, protección del superadmin, segmentación, contactos y consentimiento; flujos de navegador con API simulada a 320, 390 y 1280 px. Las pruebas no crean personal real ni envían comunicaciones. El OAuth real con una cuenta nueva se verifica después de desplegar.

RLS activo; tablas de autorizaciones y auditoría solo accesibles al backend. RPC nuevas revocadas a anon/authenticated. El asesor de Supabase informa RLS sin políticas en estas tablas intencionalmente cerradas al cliente, además del aviso previo de protección de contraseñas filtradas desactivada. Referencias: [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

En el servidor:

```bash
git pull origin main
./deploy.sh api admin club
```

Publicar API antes de usar el admin actualizado: este comprueba el endpoint `/team/access`.
