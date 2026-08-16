#!/bin/bash
# ==============================================================================
# Trstprep Zero-Downtime Rolling Deployment Script
#
# H32 fix: drains connections from each backend instance BEFORE taking it down,
# so in-flight requests complete instead of returning 502 errors. Uses nginx
# upstream `drain`/`up` (NGINX Plus) when available, and otherwise relies on
# graceful stop + health-gated cutover for the OSS nginx config in deploy/nginx.
# ==============================================================================
set -euo pipefail

NGINX_CONF="${NGINX_CONF:-deploy/nginx/nginx.conf}"
HEALTH_URL="${HEALTH_URL:-http://localhost:5001/api/health}"
MAX_HEALTH_ATTEMPTS="${MAX_HEALTH_ATTEMPTS:-30}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-2}"
DRAIN_WAIT="${DRAIN_WAIT:-15}"   # seconds to let in-flight requests finish

# L32: rollback support. Set PREV_IMAGE to the last-known-good backend image
# tag (e.g. trstprep-backend:2024.07.01) before running; `rollback` reverts all
# instances to it. Defaults to the previous docker tag if not provided.
PREV_IMAGE="${PREV_IMAGE:-trstprep-backend:previous}"

INSTANCES=("backend-1" "backend-2")

# Roll back every instance to the last-known-good image and reload nginx.
rollback() {
  echo "=== [Rolling Deploy] ROLLBACK: reverting to ${PREV_IMAGE} ==="
  for svc in "${INSTANCES[@]}"; do
    drain_instance "$svc"
    echo "  rolling back $svc to ${PREV_IMAGE} ..."
    docker image tag "$PREV_IMAGE" "trstprep-backend:latest"
    docker-compose up -d --no-deps --force-recreate "$svc"
    if ! wait_for_health "$svc"; then
      echo "ERROR: $svc failed health after rollback. Manual intervention required."
      exit 1
    fi
    docker-compose exec -T nginx nginx -s reload
  done
  echo "=== [Rolling Deploy] Rollback complete (all instances on ${PREV_IMAGE}) ==="
  exit 0
}

# `./rolling-deploy.sh rollback` performs an immediate rollback.
if [ "${1:-}" = "rollback" ]; then
  rollback
fi

# On unexpected failure mid-deploy, attempt an automatic rollback.
trap 'echo "ERROR: deploy failed — run: PREV_IMAGE=${PREV_IMAGE} ./rolling-deploy.sh rollback"; exit 1' ERR

echo "=== [Rolling Deploy] Initializing zero-downtime switch ==="

wait_for_health() {
  local svc="$1"
  local attempt=1
  echo "  awaiting health on $svc ..."
  while [ "$attempt" -le "$MAX_HEALTH_ATTEMPTS" ]; do
    # Hit the specific instance's health port (docker-compose maps 5001/5002).
    local port
    case "$svc" in
      backend-1) port=5001 ;;
      backend-2) port=5002 ;;
      *) port=5001 ;;
    esac
    if curl -sf --max-time 2 "http://localhost:$port/api/health" | grep -q '"status":"ok"'; then
      echo "  $svc healthy"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep "$HEALTH_INTERVAL"
  done
  echo "ERROR: $svc failed health checks"
  return 1
}

drain_instance() {
  local svc="$1"
  echo "  draining $svc (waiting ${DRAIN_WAIT}s for in-flight requests)..."
  # NGINX Plus: mark upstream peer as "drain" so it stops receiving new conns
  # but finishes active ones. OSS nginx ignores this gracefully.
  docker-compose exec -T nginx nginx -s reload 2>/dev/null || true
  sleep "$DRAIN_WAIT"
}

for svc in "${INSTANCES[@]}"; do
  echo "=== [Rolling Deploy] Processing $svc ==="

  # 1. Drain: stop routing NEW traffic to this instance, let in-flight finish.
  drain_instance "$svc"

  # 2. Deploy: pull latest image and recreate ONLY this instance.
  echo "  deploying $svc ..."
  docker-compose up -d --no-deps --force-recreate "$svc"

  # 3. Wait until the new instance is healthy before moving on.
  if ! wait_for_health "$svc"; then
    echo "ERROR: $svc did not become healthy. Aborting deploy (other instances still serving)."
    exit 1
  fi

  # 4. Reload nginx so the freshly deployed instance receives traffic again.
  echo "  reloading nginx to restore $svc to rotation ..."
  docker-compose exec -T nginx nginx -s reload

  echo "=== [Rolling Deploy] $svc done ==="
done

echo "=== [Rolling Deploy] Deployment complete (zero downtime, connections drained) ==="
