#!/usr/bin/env bash
# ================================================================
# Costa Mar — Despliegue seguro en el servidor (Lightsail).
# Hace git pull --ff-only (preserva tu .env), reconstruye los
# contenedores indicados y valida el estado.
#
# Uso:
#   ./deploy.sh            -> actualiza web + api + club (todo el piloto)
#   ./deploy.sh web        -> solo la web pública
#   ./deploy.sh club       -> solo el club
#   ./deploy.sh api        -> solo la API (recrea para aplicar .env)
#   ./deploy.sh web club   -> varios servicios
#
# NO toca Nginx (/etc/nginx) ni tu archivo .env.
# ================================================================
set -euo pipefail

COMPOSE=(docker compose -f docker-compose.piloto.yml --env-file .env)
SERVICES=("$@")
if [ ${#SERVICES[@]} -eq 0 ]; then
  SERVICES=("web" "api" "club" "admin")
fi

echo "==> 1/4 Trayendo cambios de GitHub (git pull --ff-only)"
git pull --ff-only

# Radar es optativo. Una vez activado, conservar su configuración al desplegar API.
# No cargar .env como código shell ni imprimir sus secretos.
if grep -Eq $'^RADAR_ENABLED=(true|1)\r?$' .env || printf '%s\n' "${SERVICES[@]}" | grep -qx 'radar-worker'; then
  COMPOSE+=(-f docker-compose.radar.yml)
  if printf '%s\n' "${SERVICES[@]}" | grep -qx 'api' && ! printf '%s\n' "${SERVICES[@]}" | grep -qx 'radar-worker'; then
    SERVICES+=(radar-worker)
  fi
fi

echo "==> 2/4 Reconstruyendo: ${SERVICES[*]}"
"${COMPOSE[@]}" up -d --build "${SERVICES[@]}"

echo "==> 3/4 Estado de contenedores"
"${COMPOSE[@]}" ps

echo "==> 4/4 Verificaciones"
# API
if printf '%s\n' "${SERVICES[@]}" | grep -qx "api"; then
  echo -n "API health: "
  curl -fsS http://127.0.0.1:3000/api/v1/health && echo "" || echo "FALLO"
fi
# Web
if printf '%s\n' "${SERVICES[@]}" | grep -qx "web"; then
  echo -n "Web: "
  curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000 || echo "FALLO"
fi
# Club
if printf '%s\n' "${SERVICES[@]}" | grep -qx "club"; then
  echo -n "Club: "
  curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4002 || echo "FALLO"
  echo -n "Club healthcheck: "
  docker inspect --format='{{.State.Health.Status}}' costamar-club 2>/dev/null || echo "n/a"
fi
# Admin
if printf '%s\n' "${SERVICES[@]}" | grep -qx "admin"; then
  echo -n "Admin: "
  curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4001 || echo "FALLO"
  echo -n "Admin healthcheck: "
  docker inspect --format='{{.State.Health.Status}}' costamar-admin 2>/dev/null || echo "n/a"
fi

echo ""
echo "Listo. Recuerda: si cambiaron archivos en nginx/, reinstalalos a mano"
echo "(git NO toca /etc/nginx). Ver docs/deployment.md seccion 2 y 7."
