# Despliegue — Costa Mar (piloto web + API) en AWS Lightsail

Infraestructura: Ubuntu 24.04, Nginx 1.24.0 (nativo), Docker + Docker Compose.
Contenedores: `costamar-web` (Angular SSR, `127.0.0.1:4000`) y `costamar-api`
(NestJS, `127.0.0.1:3000`). Cloudflare para DNS y HTTPS. Supabase como datos.

Dominios:
- `restaurantecostamar.cl` → web pública
- `api.restaurantecostamar.cl` → API

> Los puertos 3000 y 4000 se publican SOLO en loopback (`127.0.0.1`). El acceso
> público entra siempre por Nginx. No exponer esos puertos a Internet.

---

## 0. DNS en Cloudflare (requisito)

Crear ambos registros tipo A, **Proxied** (nube naranja), apuntando a la IP
pública del servidor (`3.143.167.192`):

| Type | Name | Content         | Proxy    |
|------|------|-----------------|----------|
| A    | `@`  | 3.143.167.192   | Proxied  |
| A    | `api`| 3.143.167.192   | Proxied  |

> Si `api` no resuelve, la web carga pero la **carta falla** con "No pudimos
> cargar la carta", porque el navegador llama a `https://api.restaurantecostamar.cl`.

SSL/TLS en Cloudflare: modo **Full (strict)** con un certificado de origen
instalado en el servidor en `/etc/ssl/cloudflare/origin.pem` y `origin.key`.

---

## 1. Primer despliegue

```bash
# Docker (si no está)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # reabrir sesión SSH tras esto

# Código
git clone https://github.com/diegocr305/costamar.git
cd costamar

# Variables de entorno (NO vienen del repo)
cp .env.piloto.example .env
nano .env
#  - SUPABASE_SERVICE_ROLE_KEY = sb_secret_... (real, solo backend)
#  - ALLOWED_ORIGINS debe incluir https://restaurantecostamar.cl
#  - SSR_ALLOWED_HOSTS debe incluir 127.0.0.1

# Levantar web + API
docker compose -f docker-compose.piloto.yml --env-file .env up -d --build
```

### Instalar los vhosts de Nginx (manual, git NO toca /etc/nginx)

`git pull` actualiza SOLO el repo. Las configs activas viven en
`/etc/nginx/sites-available|enabled`. Para aplicar cambios de `nginx/`:

```bash
# Respaldar lo activo antes de reemplazar
sudo cp /etc/nginx/sites-available/restaurantecostamar.cl \
        /etc/nginx/sites-available/restaurantecostamar.cl.bak.$(date +%F)
sudo cp /etc/nginx/sites-available/api.restaurantecostamar.cl \
        /etc/nginx/sites-available/api.restaurantecostamar.cl.bak.$(date +%F)

# Copiar las configs del repo
sudo cp nginx/restaurantecostamar.cl.conf     /etc/nginx/sites-available/restaurantecostamar.cl
sudo cp nginx/api.restaurantecostamar.cl.conf /etc/nginx/sites-available/api.restaurantecostamar.cl

# Activar SOLO web y api (NO activar admin ni club todavía)
sudo ln -sf /etc/nginx/sites-available/restaurantecostamar.cl     /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/api.restaurantecostamar.cl /etc/nginx/sites-enabled/

# Validar SIEMPRE antes de recargar
sudo nginx -t
# Si OK:
sudo systemctl reload nginx
```

> admin y club se dejan desactivados hasta tener sus contenedores y DNS.

---

## 2. Actualización desde GitHub (segura, sin perder secretos)

El `.env` real vive solo en el servidor y está en `.gitignore`: `git pull`
nunca lo sobrescribe.

```bash
cd costamar

# 1) Traer cambios sin merge sorpresa (falla si hay divergencia)
git pull --ff-only

# 2) Reconstruir SOLO si cambió código de web/api
docker compose -f docker-compose.piloto.yml --env-file .env up -d --build

# 3) Si cambiaron archivos en nginx/, reinstalarlos manualmente
#    (ver sección "Instalar los vhosts" arriba). git pull NO toca /etc/nginx.
```

Recrear el contenedor aplica los cambios de variables del `.env` (p. ej.
`SSR_ALLOWED_HOSTS`). Para forzar recreación sin rebuild:

```bash
docker compose -f docker-compose.piloto.yml --env-file .env up -d --force-recreate web
```

---

## 3. Validación post-despliegue

```bash
# Contenedores arriba
docker compose -f docker-compose.piloto.yml ps

# API y web por loopback
curl -s http://127.0.0.1:3000/api/v1/health      # {"status":"ok",...}
curl -I http://127.0.0.1:4000                     # HTTP 200

# A través de Nginx (fuerza el Host sin depender del DNS local)
curl -I --resolve restaurantecostamar.cl:443:127.0.0.1 https://restaurantecostamar.cl/
curl -s --resolve api.restaurantecostamar.cl:443:127.0.0.1 \
     https://api.restaurantecostamar.cl/api/v1/health

# Público (requiere DNS ya propagado)
curl -I https://restaurantecostamar.cl/
curl -s https://api.restaurantecostamar.cl/api/v1/carta | head -c 200
```

Nginx:
```bash
sudo nginx -t && echo "config OK"
```

---

## 4. Rollback

### Rollback de código/contenedores
```bash
cd costamar
git log --oneline -5          # ubicar el commit estable anterior
git checkout <commit_estable>
docker compose -f docker-compose.piloto.yml --env-file .env up -d --build
# Volver a main cuando se corrija:  git checkout main
```

### Rollback de Nginx
```bash
# Restaurar el backup que se hizo antes de reemplazar
sudo cp /etc/nginx/sites-available/restaurantecostamar.cl.bak.<fecha> \
        /etc/nginx/sites-available/restaurantecostamar.cl
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Notas de compatibilidad (correcciones persistidas)

- **Nginx 1.24.0 no soporta `http2 on;`** → se eliminó de todas las configs de
  `nginx/`. HTTP/2 lo entrega Cloudflare en el borde; el tramo origen va por
  HTTP/1.1 sobre TLS (estable). Reactivar HTTP/2 requeriría `listen 443 ssl http2;`
  en una versión de Nginx que lo soporte; no es necesario para el piloto.
- **SSR_ALLOWED_HOSTS debe incluir `127.0.0.1`** → Nginx hace `proxy_pass` a
  `127.0.0.1:4000` y el engine SSR valida el Host. Sin esa IP el SSR responde
  HTTP 500 ("URL with hostname 127.0.0.1 is not allowed"). Persistido en el
  default de `server.ts`, en `docker-compose.piloto.yml` y en `.env.piloto.example`.

---

## 6. Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` (sb_secret_...) solo en el backend (`costamar-api`),
  nunca en Angular ni en el repo.
- `.env` excluido por `.gitignore`; solo se versionan los `.example` con placeholders.
- Certificados de origen de Cloudflare en `/etc/ssl/cloudflare/`, nunca en git.
- Cloudflare en **Full (strict)**.
- Puertos 3000/4000 solo en loopback; el acceso público entra por Nginx.

---

## 7. Actualizar producción con los cambios actuales (seguro, sin romper nada)

> Regla de oro: tu `.env` real vive solo en el servidor y está en `.gitignore`.
> `git pull` NO lo toca. Reconstruir contenedores NO borra sus variables.

### Parte A — Fix de los chips de la carta (solo rebuild de la web)

```bash
cd costamar
git pull --ff-only
docker compose -f docker-compose.piloto.yml --env-file .env up -d --build web
curl -I http://127.0.0.1:4000           # 200 OK
```
Nada más cambia: api y (si existe) club siguen intactos.

### Parte B — Publicar el Club (club.restaurantecostamar.cl)

Requisitos previos (una vez):
- DNS en Cloudflare: `A` `club` → IP del servidor, **Proxied**. (ya hecho)
- Google OAuth + Supabase Auth configurados (ver `docs/club-oauth-setup.md`).

1) Permitir el origen del club en CORS de la API. Edita SOLO el `.env` del
   servidor (no se sube al repo) y añade el club a `ALLOWED_ORIGINS`:

```bash
cd costamar
nano .env
#   ALLOWED_ORIGINS=https://restaurantecostamar.cl,https://www.restaurantecostamar.cl,https://admin.restaurantecostamar.cl,https://club.restaurantecostamar.cl
```

2) Levantar el contenedor del club y recrear la API para aplicar el nuevo CORS
   (web no se toca):

```bash
docker compose -f docker-compose.piloto.yml --env-file .env up -d --build club
docker compose -f docker-compose.piloto.yml --env-file .env up -d --force-recreate api
docker compose -f docker-compose.piloto.yml ps
curl -I http://127.0.0.1:4002           # club: 200 OK
```

3) Instalar el vhost de Nginx del club (git NO toca /etc/nginx):

```bash
# Respaldo defensivo si ya existiera
sudo cp /etc/nginx/sites-available/club.restaurantecostamar.cl \
        /etc/nginx/sites-available/club.restaurantecostamar.cl.bak.$(date +%F) 2>/dev/null || true

sudo cp nginx/club.restaurantecostamar.cl.conf /etc/nginx/sites-available/club.restaurantecostamar.cl
sudo ln -sf /etc/nginx/sites-available/club.restaurantecostamar.cl /etc/nginx/sites-enabled/

sudo nginx -t                           # DEBE decir "test is successful"
sudo systemctl reload nginx
```

4) Verificar:

```bash
curl -I https://club.restaurantecostamar.cl/        # 200 (vía Cloudflare)
curl -s https://api.restaurantecostamar.cl/api/v1/health
```

### Rollback del club (si algo falla)

```bash
# Quitar el vhost sin tocar web/api
sudo rm /etc/nginx/sites-enabled/club.restaurantecostamar.cl
sudo nginx -t && sudo systemctl reload nginx

# Detener solo el contenedor del club
docker stop costamar-club
```
La web y la API siguen funcionando: el club es independiente.

---

## 8. Entrega actual: agenda de reservas + WhatsApp, cupones por vencer y tema claro del Club

Commit `c3fbf70`. Esta entrega toca **api**, **admin** y **club** (la web NO cambia).
El despliegue tiene **dos partes independientes**:

- **Parte 1 (contenedores):** aplica de inmediato con `deploy.sh`. Incluye la agenda
  de reservas con "todas las fechas", el botón de confirmar reserva por WhatsApp y el
  Club en tema claro. No necesita tocar la base de datos.
- **Parte 2 (Supabase):** la base de datos de los recordatorios de cupones. Es un paso
  aparte y **puede esperar**, pero la cola de WhatsApp del panel **no funcionará hasta
  aplicar la migración** (el endpoint consulta RPCs que esa migración crea). El email
  automático necesita además la Edge Function y la cuenta de Resend.

> Regla de oro de siempre: `git pull` no toca tu `.env`; reconstruir contenedores no
> borra sus variables; `deploy.sh` no toca Nginx ni Supabase.

### Parte 1 — Desplegar los contenedores (servidor Lightsail)

```bash
cd ~/costamar
./deploy.sh api admin club
# Si la primera vez falta permiso de ejecución:
#   chmod +x deploy.sh && ./deploy.sh api admin club
```

`deploy.sh` hace `git pull --ff-only`, reconstruye `api`, `admin` y `club`, y verifica
el health de cada uno. La web no se incluye porque no cambió.

#### Checklist Parte 1 (contenedores)

- [ ] `cd ~/costamar` y rama correcta (`git rev-parse --abbrev-ref HEAD` → `main`).
- [ ] `./deploy.sh api admin club` termina sin errores.
- [ ] API health: `curl -fsS http://127.0.0.1:3000/api/v1/health` → `{"status":"ok",...}`.
- [ ] Admin responde: `curl -I http://127.0.0.1:4001` → `200`.
- [ ] Club responde: `curl -I http://127.0.0.1:4002` → `200`.
- [ ] En el panel admin, **Reservas**: aparecen "Ver todas las fechas" / "Solo hoy" y, en
      una reserva confirmada, el botón **Confirmar por WhatsApp** abre `wa.me`.
- [ ] El **Club** se ve en tema claro (fondo crema), sin textos ilegibles.

> Nota: mientras la Parte 2 no esté aplicada, el bloque "Cupones por vencer" del panel de
> reservas puede mostrar un error al cargar la cola. Es esperable hasta aplicar la migración.

### Parte 2 — Base de datos de cupones por vencer (Supabase)

> **No uses `supabase db push` en este proyecto.** El historial de migraciones de producción tiene versiones con otras marcas de tiempo que no existen en el repo, y el CLI se niega a continuar (la "solución" sería reescribir ese historial con `migration repair`, que no se recomienda). Las migraciones nuevas se aplican con el Power de Supabase (`apply_migration`) o pegando el archivo en el SQL Editor. Ver sección 9.3.

Se ejecuta **desde tu máquina** (donde el proyecto está vinculado con `supabase link`),
no en el servidor. Guía detallada: `docs/club-cupones-recordatorios.md`.

#### 2.1 Aplicar la migración (habilita la cola de WhatsApp del panel)

```bash
# Ver sección 9.3: se aplica con el Power de Supabase o el SQL Editor (no con db push)
```

Crea la tabla `club_coupon_reminders`, las RPCs, y el cron diario. Con esto la cola de
WhatsApp del panel de reservas ya funciona (envío manual con `wa.me`). El email todavía no.

#### Checklist Parte 2.1 (migración)

- [ ] La migración `20261107120000_club_coupon_reminders.sql` está aplicada (ver sección 9.3).
- [ ] En Supabase SQL Editor: `select * from public.club_whatsapp_reminder_queue();` responde (aunque esté vacío).
- [ ] En el panel admin → Reservas, el bloque "Cupones por vencer" carga sin error.

#### 2.2 Email automático con Resend (PENDIENTE — requiere tu cuenta)

> **Pendiente de ti.** Hasta completar esto, el aviso por **email NO se envía**; solo
> funciona la cola de WhatsApp (Parte 2.1). El sistema no se rompe: el cron igual arma la
> cola todos los días y el email queda en pausa.

Pasos (detalle en `docs/club-cupones-recordatorios.md`):

- [ ] Crear cuenta en [resend.com](https://resend.com) (plan gratis: 3.000 correos/mes).
- [ ] Agregar el dominio `restaurantecostamar.cl` en Resend (**Domains → Add Domain**).
- [ ] Copiar los registros DNS (SPF/DKIM) de Resend a **Cloudflare → DNS** como **DNS only** (nube gris).
- [ ] Esperar a que Resend marque el dominio **Verified**.
- [ ] Generar una **API key** (`re_...`) en Resend.
- [ ] Generar un secreto de cron: `openssl rand -hex 32`.
- [ ] Cargar secretos de la Edge Function:
  ```bash
  npx supabase@3.0.0 secrets set \
    RESEND_API_KEY="re_tu_llave" \
    REMINDER_FROM="Costa Mar <club@restaurantecostamar.cl>" \
    CRON_SECRET="el-secreto-generado" \
    CLUB_URL="https://club.restaurantecostamar.cl"
  ```
- [ ] Desplegar la función: `npx supabase@3.0.0 functions deploy coupon-reminders`.
- [ ] En el SQL Editor de Supabase, apuntar el cron a la función (usar el **mismo** `CRON_SECRET`):
  ```sql
  alter database postgres set app.settings.edge_base_url   = 'https://<PROJECT_REF>.supabase.co';
  alter database postgres set app.settings.edge_cron_secret = 'el-mismo-CRON_SECRET';
  ```
- [ ] Probar con un cupón de prueba a <7 días para un socio con `marketing_email=true`:
  ```bash
  curl -i -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/coupon-reminders" \
    -H "Authorization: Bearer <CRON_SECRET>" -H "Content-Type: application/json" -d '{}'
  # Esperado: {"processed":N,"sent":N,"failed":0,"skipped":0}
  ```

### Orden recomendado de toda la entrega

1. **Ahora:** Parte 1 (`./deploy.sh api admin club`). Reservas y tema claro quedan activos.
2. **Antes de que el equipo use "Cupones por vencer":** Parte 2.1 (migración, ver sección 9.3).
3. **Cuando tengas Resend:** Parte 2.2 (Edge Function + secretos).

### Rollback de esta entrega

```bash
# Contenedores: volver al commit anterior y reconstruir
cd ~/costamar
git checkout 54b5c25        # commit previo a esta entrega
./deploy.sh api admin club
git checkout main           # cuando se corrija

# Supabase: la migración es aditiva (tabla + RPCs nuevas, no altera datos de cupones).
# Para desactivar solo el cron de recordatorios sin perder nada:
#   select cron.unschedule('costamar-coupon-reminders-std');
#   select cron.unschedule('costamar-coupon-reminders-dst');
```

---

## 9. Mercado Público cada hora, reservas por prioridad, correo diario y Resend

Esta entrega agrupa cuatro cambios. Cada uno tiene su checklist. El orden recomendado es:
9.1 (servidor) → 9.3 (migraciones) → 9.4 (Resend + funciones) → 9.5 (pruebas).

### 9.1 Mercado Público: de cada 15 minutos a cada hora (servidor Lightsail)

**Qué pasaba:** el worker mira su base cada 30 segundos, pero eso **no** llama a Mercado Público;
solo pregunta si ya toca un ciclo. Las consultas reales ocurrían cada `RADAR_INTERVAL_SECONDS`
(900 s = 15 min). Medido en producción el 11-nov: **1.779 consultas en 24 h** (≈19 por ciclo).

**Recomendación:** `RADAR_INTERVAL_SECONDS=3600` (1 vez por hora) ≈ 450 consultas/día.
Mantiene los datos frescos para oportunidades que duran días y reduce la carga un 75 %.
Hacerlo 3 veces al día (`28800`) ahorra más, pero una Compra Ágil corta podría publicarse y
cerrar entre revisiones. No verifiqué un límite oficial de Mercado Público; el worker ya
pausa solo si responde 429 y ahora además respeta un tope diario propio.

El valor del `.env` **del servidor** manda: el 3600 por defecto del código solo aplica si la
variable no existe. Edita el `.env` real:

```bash
cd ~/costamar
nano .env
#   RADAR_INTERVAL_SECONDS=3600
#   RADAR_DAILY_REQUEST_LIMIT=1000     # tope de consultas en 24 h (máximo técnico 9000)
./deploy.sh api                         # recrea api + radar-worker con los valores nuevos
docker compose -f docker-compose.piloto.yml -f docker-compose.radar.yml --env-file .env \
  exec radar-worker printenv RADAR_INTERVAL_SECONDS RADAR_DAILY_REQUEST_LIMIT
```

Para ver el consumo real (SQL Editor de Supabase):

```sql
select count(*) as consultas_24h from public.radar_requests where created_at > now() - interval '24 hours';
```

#### Checklist 9.1
- [ ] `.env` del servidor tiene `RADAR_INTERVAL_SECONDS=3600` y `RADAR_DAILY_REQUEST_LIMIT=1000`.
- [ ] `./deploy.sh api` terminó sin errores y `printenv` dentro de `radar-worker` muestra 3600 y 1000.
- [ ] Al día siguiente `consultas_24h` baja de ~1.800 a ~450 (o menos).
- [ ] El panel del Radar sigue mostrando "última revisión" reciente (se actualiza cada hora).

### 9.2 Reservas en el panel: qué cambió

- **Abre en "Hoy"** (por hora). Atajos: **Hoy · Por confirmar · Todas**. El buscador (nombre, teléfono, RES-…) busca en **todas** las fechas.
- **Orden de "Todas":** primero *Por confirmar* (la más próxima arriba), luego *Confirmadas y próximas*, luego
  *Fecha pasada sin cerrar* y al final el *Historial*. Lo más antiguo ya no aparece primero.
- **WhatsApp en pendientes:** "Contactar por WhatsApp" (consulta disponibilidad) y, ya confirmadas, "Confirmar por WhatsApp".
- **Panel de gestión:** queda fijo a la derecha, y los avisos de éxito/error salen **dentro del panel**
  (antes salían arriba de la página y parecía que "no pasaba nada").
- **Por qué algunas reservas no se pueden modificar (es por diseño):**
  - *Canceladas, finalizadas y "No asistió"* están cerradas: solo lectura + historial.
  - *Pendientes con fecha pasada* no se pueden confirmar: cambia la fecha/hora a una futura o cancélala.
  - *Confirmadas con fecha pasada* se pueden marcar "No asistió" o cancelar.

#### Checklist 9.2 (después de `./deploy.sh api admin`)
- [ ] Al entrar a Reservas se ve **Hoy**.
- [ ] **Por confirmar** muestra primero la solicitud más próxima.
- [ ] En una pendiente aparece **Contactar por WhatsApp**; en una confirmada, **Confirmar por WhatsApp**.
- [ ] Gestionar una reserva y guardar con error (p. ej. confirmar sin mesa) muestra el mensaje **dentro del panel**.

### 9.3 Aplicar las migraciones nuevas en Supabase (producción)

Migraciones pendientes, **en este orden**:

1. `supabase/migrations/20261107120000_club_coupon_reminders.sql` — cupones por vencer (tabla, RPCs, cron).
2. `supabase/migrations/20261107140000_reservations_priority_and_digest.sql` — orden de reservas + resumen diario + cron.
3. `supabase/migrations/20261107150000_edge_settings_from_vault.sql` — los despachos de cron leen URL y secreto de Vault.

> **Estado (12-nov-2026):** las tres migraciones y las dos Edge Functions ya están aplicadas/desplegadas en producción. Falta solo cargar `RESEND_API_KEY`.

Ambas son aditivas (no borran datos) y se probaron sobre una copia completa del esquema.
**No uses `db push`** (ver aviso en la sección 8). Opciones:

- **Con el asistente:** pídele que las aplique con el Power de Supabase (`apply_migration`); primero revisa `list_migrations`.
- **A mano:** SQL Editor de Supabase → pegar el contenido de cada archivo → Run.

Verificación (SQL Editor):

```sql
select to_regclass('public.club_coupon_reminders') is not null as cupones,
       exists(select 1 from pg_proc where proname = 'reservation_daily_digest') as resumen,
       (select string_agg(jobname, ', ') from cron.job where jobname like 'costamar-%') as crons;
-- Esperado: cupones = true, resumen = true y crons con costamar-reservations-digest y costamar-coupon-reminders-*
```

#### Checklist 9.3
- [ ] Migración `20261107120000` aplicada sin errores.
- [ ] Migración `20261107140000` aplicada sin errores.
- [ ] La consulta de verificación devuelve `true`, `true` y los cron esperados.
- [ ] En Reservas, el bloque "Cupones por vencer" carga sin error.

### 9.4 Resend y las dos Edge Functions

**Dónde va la clave de Resend: en los *secrets* de Supabase, NO en el `.env` de Lightsail.** Los
correos de cupones y del resumen diario los envían las Edge Functions desde Supabase. El
`RESEND_API_KEY` del `.env` del servidor solo lo usa el Radar (`RADAR_EMAIL_ENABLED`); es otra función.
Buena práctica: una clave distinta por uso (en Resend → API Keys, permiso *Sending access*).

**La clave nunca va al repo ni al chat.** Usa un archivo local ignorado por git:

```powershell
copy supabase\functions\.env.example supabase\functions\.env.local
# Abre supabase\functions\.env.local y completa:
#   RESEND_API_KEY=re_...             (la que creaste en Resend)
#   CRON_SECRET=<un secreto largo>    genera uno con:  [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
npx supabase@3.0.0 secrets set --env-file supabase/functions/.env.local --project-ref pebdhasajkvsjttclbhf
del supabase\functions\.env.local
```

**Para probar sin dominio verificado** (`.env.example` ya viene así): remitente
`Costa Mar <onboarding@resend.dev>` y destinatario `costamarbarracevichera@gmail.com`. Con ese
remitente de prueba Resend **solo entrega al correo dueño de la cuenta**. Por eso:

- El **resumen diario de reservas** (va a ti) funciona de inmediato.
- Los **cupones por vencer** (van a los socios) están protegidos en modo prueba: con un remitente `@resend.dev` la función solo envía a `DIGEST_TO` y **no marca ni quema** el aviso de ningún socio; los errores 401/403/429/5xx de Resend dejan el aviso pendiente para reintentar. Para que lleguen a los socios necesitan el dominio `restaurantecostamar.cl`
  verificado en Resend (registros SPF/DKIM en Cloudflare como *DNS only*) y luego cambiar
  `REMINDER_FROM` a `Costa Mar <club@restaurantecostamar.cl>`.

Desplegar las funciones (`verify_jwt = false` ya está fijado en `supabase/config.toml`; es necesario
porque el cron llama con `Bearer <CRON_SECRET>`, que no es un JWT de Supabase):

```powershell
npx supabase@3.0.0 functions deploy coupon-reminders --project-ref pebdhasajkvsjttclbhf
npx supabase@3.0.0 functions deploy reservations-digest --project-ref pebdhasajkvsjttclbhf
```

Decirle al cron a qué URL llamar. **Se guarda en Supabase Vault** (cifrado). `ALTER DATABASE ... SET app.settings.*` no funciona en Supabase alojado: el rol no tiene permiso. La migración `20261107150000_edge_settings_from_vault.sql` ya hace que las funciones lean de Vault. Una sola vez, en el SQL Editor, con **el mismo** `CRON_SECRET`:

```sql
select vault.create_secret('https://pebdhasajkvsjttclbhf.supabase.co', 'edge_base_url');
select vault.create_secret('EL-MISMO-CRON_SECRET', 'edge_cron_secret');
```

> El resumen diario sale **todos los días a las 09:00 hora de Chile** (el cron corre a las 12:00 y 13:00 UTC y
> solo una de las dos es las 9:00 según el horario de verano). Si ese día no hay reservas ni pendientes, no envía nada.

#### Checklist 9.4
- [ ] Cuenta de Resend creada y clave generada (permiso *Sending access*).
- [ ] `supabase/functions/.env.local` completado, subido con `secrets set` y **borrado**.
- [ ] `npx supabase@3.0.0 secrets list --project-ref pebdhasajkvsjttclbhf` muestra `RESEND_API_KEY`, `CRON_SECRET`, `REMINDER_FROM`, `DIGEST_TO`.
- [ ] Ambas funciones desplegadas (`npx supabase@3.0.0 functions list --project-ref pebdhasajkvsjttclbhf`).
- [ ] `edge_base_url` y `edge_cron_secret` creados en Vault (el secreto debe ser igual al `CRON_SECRET` de la función). Para rotarlo: `select vault.update_secret(id, 'nuevo') from vault.secrets where name = 'edge_cron_secret';` y `secrets set CRON_SECRET=...`.
- [ ] (Más adelante) Dominio `restaurantecostamar.cl` **Verified** en Resend y `REMINDER_FROM` cambiado a `club@restaurantecostamar.cl`.

### 9.5 Pruebas manuales en producción

```powershell
# Resumen diario: envía aunque no haya nada (force) a tu correo de cuenta Resend
curl.exe -i -X POST "https://pebdhasajkvsjttclbhf.supabase.co/functions/v1/reservations-digest" `
  -H "Authorization: Bearer TU_CRON_SECRET" -H "Content-Type: application/json" -d '{\"force\":true}'
# Esperado: HTTP 200 {"sent":true,...} y un correo en costamarbarracevichera@gmail.com

# Sin credencial debe rechazar:
curl.exe -i -X POST "https://pebdhasajkvsjttclbhf.supabase.co/functions/v1/reservations-digest"
# Esperado: HTTP 401
```

Errores comunes: `401` = el `Bearer` no coincide con `CRON_SECRET`; `502 resend:403` = remitente/dominio no
permitido (usa `onboarding@resend.dev` hacia tu propio correo mientras no verifiques el dominio);
`500 DIGEST_TO not set` = falta el secret.

#### Checklist 9.5
- [ ] `force:true` responde 200 y llega el correo con "Reservas de hoy".
- [ ] Sin `Authorization` responde 401.
- [ ] Al día siguiente, a las 09:00 de Chile, llega el correo automático (si hay reservas o pendientes).

### Rollback de esta entrega
```bash
# Servidor: volver el intervalo (si lo necesitas) editando .env y ./deploy.sh api
# Supabase: apagar los cron sin perder datos (SQL Editor)
#   select cron.unschedule('costamar-reservations-digest');
#   select cron.unschedule('costamar-coupon-reminders-std');
#   select cron.unschedule('costamar-coupon-reminders-dst');
# El orden nuevo de reservas se revierte reaplicando reservation_list de 20261012184342_reservation_arrival_occupancy.sql
```

---

## 10. Avisos de reservas por correo (en segundos) y recordatorio

**Estado (12-nov-2026):** migración `20261112120000_reservation_alerts.sql` aplicada y función `reservation-alert` desplegada en producción. Falta solo desplegar el panel (`./deploy.sh admin`) para ver el contador.

### Cómo funciona

| Situación | Qué pasa |
| --- | --- |
| Un cliente envía una solicitud (web o Club) entre **08:00 y 22:59** (hora de Chile) | Llega un correo en segundos a `DIGEST_TO` (hoy `costamarbarracevichera@gmail.com`). Si la visita es hoy, el asunto empieza con `HOY 16:00 · …` |
| La solicitud llega **fuera de ese horario** | No se envía correo; queda pendiente y entra al resumen de las 09:00 |
| Una visita de **hoy** sigue pendiente **1 hora** después | Llega **un** correo "Sigue sin confirmar: …" (una sola vez por reserva; el cron revisa cada 10 min) |
| Ya se confirmó o canceló antes de enviar | No se envía nada |
| Entran más de **20** solicitudes en una hora | Los avisos extra se omiten (contra spam) y quedan en el resumen de las 09:00 |
| Reserva ingresada por el equipo en el panel | No avisa (ya la conoce quien la ingresó) |

El correo trae: cliente, cuándo (y cuánto falta si es hoy), personas, teléfono, referencia, comentario, un botón verde **Contactar por WhatsApp** (mensaje ya escrito) y un botón **Abrir en el panel**.

En el panel de Reservas, el atajo **Por confirmar** muestra un contador con las solicitudes pendientes; la lista y el contador se actualizan solos cada minuto mientras la pestaña esté visible.

**Garantía:** si el sistema de avisos fallara, la reserva del cliente se crea igual (el trigger ignora cualquier error y deja solo un WARNING en los logs).

### Desplegar el panel (servidor Lightsail)

```bash
cd ~/costamar
./deploy.sh admin
```

### Checklist

- [ ] `./deploy.sh admin` terminó sin errores y, tras Ctrl+F5, el atajo **Por confirmar** muestra un número.
- [ ] Prueba real (entre 08:00 y 22:59): en `https://restaurantecostamar.cl/reservas` envía una solicitud de prueba para hoy. Debe llegar el correo en segundos. Luego cancélala desde el panel.
- [ ] Se ve el aviso registrado (SQL Editor): `select kind, status, detail, created_at from public.reservation_alerts order by created_at desc limit 5;` → `status = sent`.
- [ ] Si no llega: `status = failed` trae el motivo en `detail` (p. ej. `resend:403`); `skipped` con "fuera de horario" es lo esperado de noche.

### Apagarlo (si hiciera falta)

```sql
drop trigger reservation_alert_on_insert on public.reservations;       -- deja de avisar solicitudes nuevas
select cron.unschedule('costamar-reservation-reminders');               -- deja de enviar recordatorios
```
El resumen diario de las 09:00 no se ve afectado.

### Pendiente para más adelante: Telegram (gratis)

Un correo puede pasar desapercibido. Telegram permite una notificación push inmediata y es gratis: se crea un bot con @BotFather, se guarda su token en los secrets de Supabase y la misma función `reservation-alert` publica el mensaje en un chat o grupo del equipo (con el botón de WhatsApp como enlace). No está implementado; se retoma cuando se decida.
