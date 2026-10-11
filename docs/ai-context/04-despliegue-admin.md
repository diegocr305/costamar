# Desplegar el panel Admin a producción (admin.restaurantecostamar.cl)

Estado: el admin **NO está desplegado** todavía. DNS `admin` ya creado en Cloudflare.
Esta guía deja el admin en vivo con HTTPS (necesario para el escáner QR por cámara).

> No modifica los servicios operativos (web/api/club). Solo AÑADE el admin.

## 0. Fix previo en el código (hacer antes de desplegar)
El `apps/admin/Dockerfile` tiene el mismo bug de healthcheck que ya se corrigió
en web/club: usa `localhost` (puede resolver a ::1 IPv6 y fallar). Cambiar:
```dockerfile
# ANTES
CMD wget --no-verbose --tries=1 --spider http://localhost:4001/ || exit 1
# DESPUÉS
CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4001/ || exit 1
```
El nginx interno del admin escucha en **4001** (`apps/admin/nginx-spa.conf`).

## 1. Añadir el servicio admin a docker-compose.piloto.yml
Agregar junto a web/api/club (loopback, igual patrón que club):
```yaml
  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
    image: costamar/admin:latest
    container_name: costamar-admin
    restart: unless-stopped
    ports:
      - "127.0.0.1:4001:4001"
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://127.0.0.1:4001/ || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    networks:
      - costamar_net
    deploy:
      resources:
        limits:
          memory: 256M
```
> El admin es estático (no usa secretos). La `supabaseAnonKey` publishable y la
> `apiUrl` de producción ya están en `apps/admin/src/environments/environment.prod.ts`.
> Verificar que apunte a `https://api.restaurantecostamar.cl/api/v1`.

## 2. Vhost de Nginx (ya existe el archivo)
`nginx/admin.restaurantecostamar.cl.conf` ya está en el repo (proxy a 127.0.0.1:4001,
sin `http2 on`, con noindex). Instalarlo en el servidor:
```bash
cd costamar
git pull --ff-only
sudo cp nginx/admin.restaurantecostamar.cl.conf /etc/nginx/sites-available/admin.restaurantecostamar.cl
sudo ln -sf /etc/nginx/sites-available/admin.restaurantecostamar.cl /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 3. CORS de la API
Añadir el origen del admin a `ALLOWED_ORIGINS` en el `.env` del servidor y
recrear la api:
```
ALLOWED_ORIGINS=https://restaurantecostamar.cl,https://www.restaurantecostamar.cl,https://admin.restaurantecostamar.cl,https://club.restaurantecostamar.cl
```
```bash
docker compose -f docker-compose.piloto.yml --env-file .env up -d --force-recreate api
```

## 4. Supabase Auth — Redirect URLs
En Supabase → Authentication → URL Configuration → Redirect URLs, añadir:
```
https://admin.restaurantecostamar.cl/auth/callback
https://admin.restaurantecostamar.cl
```

## 5. Levantar el admin
```bash
cd costamar
docker compose -f docker-compose.piloto.yml --env-file .env up -d --build admin
docker inspect --format='{{.State.Health.Status}}' costamar-admin   # healthy
curl -I http://127.0.0.1:4001                 # 200
```
Actualizar `deploy.sh` para incluir `admin` en la lista por defecto y en las
verificaciones (opcional pero recomendado).

## 6. Cloudflare SSL
Modo Full (strict). El cert de origen de Cloudflare ya está en `/etc/ssl/cloudflare/`
(reutilizado por los otros vhosts).

## 7. Verificación final
- `https://admin.restaurantecostamar.cl` → login Google (ya corregido PKCE).
- Entrar como superadmin (`diegocr305@gmail.com`).
- Menú muestra Validar cupón; probar escáner QR (requiere HTTPS → funciona).

## Rollback
```bash
sudo rm /etc/nginx/sites-enabled/admin.restaurantecostamar.cl
sudo nginx -t && sudo systemctl reload nginx
docker stop costamar-admin
```
La web/api/club siguen intactas (el admin es independiente).

## Nota sobre recursos (Lightsail 4GB)
Con api+web+club+admin corriendo, vigilar memoria. El admin es liviano (nginx
estático, 256M). Si hay presión de RAM, el límite del compose la contiene.
