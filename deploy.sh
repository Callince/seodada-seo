#!/usr/bin/env bash
# Build + (re)deploy the production stack on the Droplet.
# Usage:  ./deploy.sh        (build, migrate, start/refresh everything)
#         ./deploy.sh logs   (tail logs)
#         ./deploy.sh down    (stop the stack)
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE=".env.production"
COMPOSE="docker compose --env-file ${ENV_FILE} -f docker-compose.prod.yml"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found. Copy the template and fill it in:"
  echo "  cp .env.production.example ${ENV_FILE} && nano ${ENV_FILE}"
  exit 1
fi

case "${1:-up}" in
  up)
    echo "==> Building images..."
    ${COMPOSE} build
    echo "==> Applying database migrations..."
    ${COMPOSE} run --rm migrate
    echo "==> Starting services..."
    ${COMPOSE} up -d
    echo "==> Done. Status:"
    ${COMPOSE} ps
    ;;
  logs)
    ${COMPOSE} logs -f --tail=100 "${2:-}"
    ;;
  down)
    ${COMPOSE} down
    ;;
  ps)
    ${COMPOSE} ps
    ;;
  *)
    echo "Unknown command: ${1}. Use: up | logs | down | ps"
    exit 1
    ;;
esac
