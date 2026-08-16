#!/usr/bin/env bash
# Bootstrap script for Trstprep deployment prerequisites.
# Run this ONCE on the deploy host (Linux) before `docker compose up -d`.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Checking Loki Docker logging driver plugin (required for centralized logging)..."
if ! docker plugin ls --format '{{.Name}}' 2>/dev/null | grep -q '^loki$'; then
  echo "    Installing grafana/loki-docker-driver plugin..."
  docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
else
  echo "    loki plugin already installed."
fi

echo "==> Provisioning TLS certificate (one-shot, requires DOMAIN + CERTBOT_EMAIL in .env)..."
if [ -f deploy/setup-ssl.sh ]; then
  ./deploy/setup-ssl.sh
else
  echo "    deploy/setup-ssl.sh not found; run certbot certonly manually."
fi

echo "==> Bootstrap complete. Start the stack with:"
echo "    docker compose up -d"
