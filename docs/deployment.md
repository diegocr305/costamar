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
