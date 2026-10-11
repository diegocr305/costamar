# Configuraciones Nginx del host (Lightsail)

Estas configuraciones corren en el **Nginx del host** (no en Docker). Hacen de
reverse proxy hacia los contenedores Docker, que exponen sus puertos solo en
`127.0.0.1`.

## Mapa de proxy

| Dominio                          | Contenedor      | Puerto host |
|----------------------------------|-----------------|-------------|
| restaurantecostamar.cl           | costamar-web    | 4000        |
| admin.restaurantecostamar.cl     | costamar-admin  | 4001        |
| api.restaurantecostamar.cl       | costamar-api    | 3000        |
| club.restaurantecostamar.cl      | costamar-club   | 4002        |

## Requisito: exponer puertos al host

En producción, para que el Nginx del host alcance los contenedores, crear un
archivo `docker-compose.prod-ports.yml` que publique los puertos solo en
loopback, y levantar con:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod-ports.yml up -d
```

Ejemplo de `docker-compose.prod-ports.yml`:

```yaml
services:
  api:   { ports: ["127.0.0.1:3000:3000"] }
  web:   { ports: ["127.0.0.1:4000:4000"] }
  admin: { ports: ["127.0.0.1:4001:4001"] }
  club:  { ports: ["127.0.0.1:4002:4002"] }
```

## Instalación de los virtual hosts

```bash
# Copiar cada config a sites-available
sudo cp nginx/restaurantecostamar.cl.conf       /etc/nginx/sites-available/
sudo cp nginx/admin.restaurantecostamar.cl.conf /etc/nginx/sites-available/
sudo cp nginx/api.restaurantecostamar.cl.conf   /etc/nginx/sites-available/
# club: solo cuando exista el registro DNS 'club' en Cloudflare
# sudo cp nginx/club.restaurantecostamar.cl.conf /etc/nginx/sites-available/

# Activar con symlinks
sudo ln -s /etc/nginx/sites-available/restaurantecostamar.cl.conf       /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin.restaurantecostamar.cl.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.restaurantecostamar.cl.conf   /etc/nginx/sites-enabled/

# Validar y recargar
sudo nginx -t
sudo systemctl reload nginx
```

> IMPORTANTE: No reemplazar el virtual host productivo existente
> (`/etc/nginx/sites-available/restaurantecostamar`) sin respaldarlo primero
> y verificar el despliegue en un entorno de prueba.
