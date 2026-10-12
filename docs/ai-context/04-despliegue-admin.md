# Actualizar Admin y las aplicaciones existentes

Actualizado el 12-10-2026. Admin, Club, API y web ya están accesibles.
No volver a crear el servicio, DNS ni vhost del admin a partir de instrucciones
históricas. Dockerfile y healthcheck usan 127.0.0.1, evitando el problema IPv6.

## Actualizar en el servidor

El dueño realiza el despliegue desde la carpeta del repositorio:

```bash
./deploy.sh api web club admin
```

El script ejecuta git pull --ff-only, recompila servicios y revisa su estado.
No modifica `.env` ni `/etc/nginx`. Las migraciones entregadas por MCP ya están
aplicadas en Supabase: no ejecutarlas de nuevo.

## Comprobación

```bash
curl -fsS https://api.restaurantecostamar.cl/api/v1/health
curl -fsS https://api.restaurantecostamar.cl/api/v1/reservations/config
curl -I https://restaurantecostamar.cl/reservas
curl -I https://club.restaurantecostamar.cl/
curl -I https://admin.restaurantecostamar.cl/
docker inspect --format='{{.State.Health.Status}}' costamar-admin
docker inspect --format='{{.State.Health.Status}}' costamar-club
```

Con Google real del empleado: Reservas y Validar cupón deben estar disponibles;
campañas/accesos se restringen según rol. Verificar cámara bajo HTTPS.
Con la cuenta del dueño: comprobar configuración y Equipo y accesos.

Una respuesta HTTP 200 no verifica permisos ni operación completa. Las pruebas
locales usan datos/identidades simulados; la prueba de turno necesita dispositivos
y cuentas reales. Al actualizar una PWA instalada, cerrarla y abrirla con conexión
para permitir que descargue la nueva versión.

Guía: [atención](../guia-equipo-atencion.md).
Infraestructura y recuperación: [despliegue general](../deployment.md).
