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

COMPOSE="docker compose -f docker-compose.piloto.yml --env-file .env"
SERVICES=("$@")
if [ ${#SERVICES[@]} -eq 0 ]; then
  SERVICES=("web" "api" "club")
fi

echo "==> 1/4 Trayendo cambios de GitHub (git pull --ff-only)"
git pull --ff-only

echo "==> 2/4 Reconstruyendo: ${SERVICES[*]}"
# shellcheck disable=SC2086
$COMPOSE up -d --build "${SERVICES[@]}"

echo "==> 3/4 Estado de contenedores"
$COMPOSE ps

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

echo ""
echo "Listo. Recuerda: si cambiaron archivos en nginx/, reinstalalos a mano"
echo "(git NO toca /etc/nginx). Ver docs/deployment.md seccion 2 y 7."
