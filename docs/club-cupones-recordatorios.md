# Recordatorios de cupones por vencer — Club Costa Mar

> **Actualización 12-nov-2026:** los comandos de esta guía (`supabase db push`, `supabase secrets set` con la clave en la línea de comandos, `functions deploy` sin `--project-ref`) quedaron reemplazados por los de [docs/deployment.md, sección 9](deployment.md). En especial: **no uses `db push`** en este proyecto (el historial de migraciones remoto no coincide con el repo) y carga la clave de Resend desde un archivo local ignorado por git, no escribiéndola en la terminal.

Avisa a los socios **7 días antes** de que expire un cupón del Club, en dos canales
según el consentimiento que cada socio dio al inscribirse:

- **Email** → envío **automático** con [Resend](https://resend.com) (una vez al día).
- **WhatsApp** → **cola en el panel admin** (Reservas → "Cupones por vencer"). El equipo
  abre `wa.me` con el mensaje ya escrito y presiona enviar. Sin costo ni cuenta de Meta.

Un socio con ambos consentimientos recibe ambos canales. Se avisa **una sola vez por
cupón y canal** (idempotente): aunque el cron corra varias veces, nadie recibe el aviso dos veces.

> Nada se envía solo por email hasta que configures Resend y los secretos (pasos 1–4).
> La cola de WhatsApp funciona de inmediato al desplegar, sin configurar nada.

---

## Arquitectura

```
pg_cron (diario 10:00 Chile)
   └─ club_dispatch_coupon_reminders()
        ├─ club_prepare_coupon_reminders(7)   -- selecciona cupones y arma la cola
        └─ net.http_post → Edge Function "coupon-reminders"
                              ├─ club_pending_email_reminders()  -- correos a enviar
                              ├─ Resend API                      -- envía cada correo
                              └─ club_mark_email_reminder()      -- marca sent/failed/skipped

Panel admin (Reservas)
   └─ GET  /club/staff/coupon-reminders            -- cola de WhatsApp (wa.me)
      POST /club/staff/coupon-reminders/:id/sent   -- marca como avisado
```

Todo el "qué cupón, de quién, a quién" vive en RPCs `security definer` de Postgres.
La Edge Function solo resuelve el correo (está en `auth.users`, no en `club_members`)
y llama a Resend. La API expone la cola de WhatsApp con los roles del equipo
(`superadmin`, `admin`, `manager`, `cashier`).

---

## Qué debes hacer tú (una sola vez)

### 1. Crear la cuenta Resend y verificar el dominio

1. Crea una cuenta gratis en [resend.com](https://resend.com) (plan gratis: 3.000 correos/mes).
2. En **Domains → Add Domain**, agrega `restaurantecostamar.cl`.
3. Resend te muestra unos registros DNS (SPF, DKIM y, opcional, DMARC). Agrégalos en
   **Cloudflare → DNS** tal cual te los da Resend. Importante: esos registros deben ir
   **DNS only** (nube gris), no proxied.
4. Espera a que Resend marque el dominio como **Verified** (suele ser minutos).
5. En **API Keys → Create API Key**, genera una llave (empieza con `re_...`) y cópiala.

### 2. Elegir el remitente

Usa una dirección de tu dominio verificado, por ejemplo:

```
Costa Mar <club@restaurantecostamar.cl>
```

No hace falta crear ese buzón en Gmail; Resend firma el envío con tu dominio. Si quieres
recibir respuestas, configura `club@` como alias/redirección en tu correo.

### 3. Cargar los secretos en la Edge Function

Desde la raíz del repo, con el proyecto Supabase ya vinculado (`supabase link`):

```bash
supabase secrets set \
  RESEND_API_KEY="re_tu_llave_real" \
  REMINDER_FROM="Costa Mar <club@restaurantecostamar.cl>" \
  CRON_SECRET="genera-un-secreto-largo-aleatorio" \
  CLUB_URL="https://club.restaurantecostamar.cl"
```

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta la plataforma automáticamente;
> no los pongas tú.

Genera un `CRON_SECRET` aleatorio, por ejemplo:

```bash
openssl rand -hex 32
```

### 4. Desplegar la Edge Function

```bash
supabase functions deploy coupon-reminders
```

### 5. Decirle a la base cómo invocar la función (para el email automático)

El cron lee dos *settings* de la base para disparar la Edge Function. Configúralos una vez
(reemplaza `<PROJECT_REF>` por tu referencia de proyecto y usa **el mismo** `CRON_SECRET` del paso 3):

```sql
-- En el SQL Editor de Supabase (una sola vez):
alter database postgres
  set app.settings.edge_base_url = 'https://<PROJECT_REF>.supabase.co';
alter database postgres
  set app.settings.edge_cron_secret = 'el-mismo-CRON_SECRET-del-paso-3';
```

> Si **no** configuras estos settings, el cron igual arma la cola de WhatsApp todos los
> días; solo el email automático queda en pausa hasta que los definas. Nada se rompe.

---

## Aplicar la migración

La migración `20261107120000_club_coupon_reminders.sql` crea la tabla, las RPCs y el cron.

```bash
supabase db push
```

Esto además crea dos tareas de `pg_cron` (`costamar-coupon-reminders-std` a las 14:00 UTC y
`costamar-coupon-reminders-dst` a las 13:00 UTC) para cubrir el horario chileno con y sin
horario de verano. Ambas son idempotentes, así que la doble marca no duplica avisos.

---

## Probar sin esperar al cron

```sql
-- 1) Arma la cola ahora mismo (ventana de 7 días):
select public.club_prepare_coupon_reminders(7);

-- 2) Mira la cola de WhatsApp (lo que verá el equipo en el panel):
select * from public.club_whatsapp_reminder_queue();

-- 3) Mira los correos que la Edge Function intentaría enviar:
select * from public.club_pending_email_reminders(200);

-- 4) Dispara el ciclo completo (incluye el POST a la Edge Function si configuraste los settings):
select public.club_dispatch_coupon_reminders();
```

También puedes invocar la Edge Function directamente para probar el email:

```bash
curl -i -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/coupon-reminders" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" -d '{}'
# Respuesta: {"processed":N,"sent":N,"failed":0,"skipped":0}
```

> Para una prueba controlada, crea un cupón de prueba con `expires_at` dentro de los próximos
> 7 días para un socio con `marketing_email = true` y correo válido, y revisa la bandeja.

---

## Panel admin (WhatsApp)

En **Reservas** aparece arriba el bloque **"Cupones por vencer · avisar por WhatsApp"**
(solo si hay avisos pendientes). Por cada socio:

- **Avisar por WhatsApp** → abre `wa.me` con el mensaje de recordatorio ya escrito.
- **Marcar avisado** → lo saca de la cola (registra el envío en la base).

Acceso: `superadmin`, `admin`, `manager` y `cashier` (los mismos roles que gestionan reservas).

---

## Privacidad y consentimiento

- Solo se avisa a socios **activos** que marcaron el consentimiento del canal
  (`marketing_email` / `marketing_whatsapp`) en sus preferencias del Club.
- El correo del socio nunca se guarda en `club_members`: se resuelve en el momento del envío
  desde `auth.users` dentro de la Edge Function (service role), y no se expone al panel.
- La tabla `club_coupon_reminders` está cerrada con RLS sin políticas: solo el backend
  (`service_role`) la lee o escribe.
- El pie del correo recuerda al socio por qué lo recibe y cómo ajustar sus preferencias.

---

## Cambiar la ventana o el horario

- **Ventana (7 días):** el valor por defecto está en `club_prepare_coupon_reminders(p_days)`
  y en `club_dispatch_coupon_reminders()` / `club_whatsapp_reminder_queue()`. Para cambiarla,
  ajusta esos valores en una migración nueva.
- **Horario del cron:** edita las expresiones cron en una migración nueva con
  `cron.alter_job` o reprograma `costamar-coupon-reminders-std/-dst`.
- **Segundo recordatorio (ej. 2 días antes):** hoy se envía **un solo aviso por cupón/canal**.
  Añadir un segundo recordatorio requeriría distinguir el canal por "días restantes"
  (p. ej. un `tier` en `club_coupon_reminders`); no está implementado en esta versión.
