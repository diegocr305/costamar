# Despliegue — Costa Mar Platform

Guía de instalación local, despliegue en AWS Lightsail y procedimiento de
rollback.

---

## 1. Requisitos previos

### Local (Windows / macOS / Linux)
- Node.js 20 LTS o superior
- pnpm 9+ (`npm install -g pnpm@9`)
- Docker Desktop (opcional, para probar contenedores)

### Servidor (Lightsail `costamar-prod-01`)
- Ubuntu 24.04 LTS
- Nginx 1.24 (ya instalado en el host)
- Docker Engine + Docker Compose plugin (instalar, ver sección 4)
- Certificado Cloudflare Origin CA en `/etc/ssl/cloudflare/origin.pem` y `origin.key`

---

## 2. Instalación local

```bash
# Desde la raíz del monorepo
pnpm install

# Compilar paquete compartido (requerido antes de las apps)
pnpm --filter @costamar/shared build

# Compilar todas las apps
pnpm build
```

### Variables de entorno
Copiar cada `.env.example` a `.env` y completar valores reales (nunca commitear):

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/club/.env.example apps/club/.env
```

Valores clave (proyecto Supabase `pebdhasajkvsjttclbhf`):
- `SUPABASE_URL` = `https://pebdhasajkvsjttclbhf.supabase.co`
- `SUPABASE_ANON_KEY` = clave pública (frontends)
- `SUPABASE_SERVICE_ROLE_KEY` = clave privada (SOLO API, nunca en frontend)
- `SUPABASE_JWT_SECRET` = secreto para validar firmas JWT (SOLO API)

### Desarrollo
```bash
pnpm dev:api     # API en http://localhost:3000
pnpm dev:web     # Web en http://localhost:4200
pnpm dev:admin   # Admin en http://localhost:4201
pnpm dev:club    # Club en http://localhost:4202
```

### Probar con Docker local
```bash
# Usa docker-compose.yml + docker-compose.override.yml automáticamente
docker compose up --build
```

---

## 3. Preparación DNS (Cloudflare)

Antes de desplegar los subdominios, crear en Cloudflare (proxy activado):

| Tipo | Nombre | Valor          | Proxy    |
|------|--------|----------------|----------|
| A    | admin  | 3.143.167.192  | Proxied  |
| A    | api    | 3.143.167.192  | Proxied  |
| A    | club   | 3.143.167.192  | Proxied  |

> No crear estos registros hasta que exista el virtual host correspondiente.
> Mantener los nameservers de NIC Chile (`audrey`/`tadeo`.ns.cloudflare.com).
> Configurar Cloudflare SSL/TLS en modo **Full (strict)**.

---

## 4. Instalar Docker en Lightsail (una sola vez)

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER   # cerrar y reabrir sesión SSH
docker --version
docker compose version
```

---

## 5. Despliegue en producción

```bash
# 1. Clonar / actualizar el repositorio en el servidor
git pull origin main

# 2. Crear el .env de producción en la raíz (valores reales de Supabase)
#    con SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, ALLOWED_ORIGINS

# 3. Construir y levantar (producción: sin override de dev)
docker compose -f docker-compose.yml -f docker-compose.prod-ports.yml up -d --build

# 4. Verificar que los contenedores están sanos
docker compose ps
docker compose logs -f api

# 5. Instalar / recargar los virtual hosts de Nginx (ver nginx/README.md)
sudo nginx -t && sudo systemctl reload nginx

# 6. Verificar salud end-to-end
curl -I https://restaurantecostamar.cl
curl https://api.restaurantecostamar.cl/api/v1/health
```

> El Nginx del host hace proxy a los puertos `127.0.0.1:{3000,4000,4001,4002}`
> publicados por `docker-compose.prod-ports.yml`.

---

## 6. Registrar la versión desplegada

Tras cada despliegue exitoso, etiquetar el commit:

```bash
git tag -a deploy-$(date +%Y%m%d-%H%M) -m "Despliegue producción"
git push origin --tags
```

---

## 7. Procedimiento de Rollback (< 10 minutos)

Si un despliegue falla (health check no responde 200, errores en logs):

```bash
# 1. Identificar el tag o commit estable anterior
git tag --sort=-creatordate | head -5

# 2. Volver al estado estable
git checkout <tag-o-commit-estable>

# 3. Reconstruir y levantar la versión anterior
docker compose -f docker-compose.yml -f docker-compose.prod-ports.yml up -d --build

# 4. Verificar salud
curl https://api.restaurantecostamar.cl/api/v1/health

# 5. Si las imágenes anteriores siguen en el host, el rollback es inmediato:
docker compose -f docker-compose.yml -f docker-compose.prod-ports.yml up -d
```

### Rollback de infraestructura (Lightsail)
- Antes de cambios mayores, crear un **snapshot** de la instancia en la consola
  de Lightsail. Restaurar el snapshot revierte todo el servidor al estado previo.

### Respaldo de datos
- Supabase: usar las copias de seguridad del plan y exportar las migraciones SQL
  versionadas (`apps/api/supabase/migrations/`).
- Nunca el servidor productivo debe ser el único lugar con datos o código.

---

## 8. Checklist de verificación post-despliegue

- [ ] `docker compose ps` muestra todos los servicios `healthy`
- [ ] `https://api.restaurantecostamar.cl/api/v1/health` responde `200` con `status: ok`
- [ ] `https://restaurantecostamar.cl` carga la portada
- [ ] `https://admin.restaurantecostamar.cl` redirige a login
- [ ] Cloudflare en modo Full (strict)
- [ ] `sudo nginx -t` sin errores
