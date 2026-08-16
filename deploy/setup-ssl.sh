#!/usr/bin/env bash
# ==============================================================================
# FIX A05: Automated initial Let's Encrypt certificate issuance.
#
# This runs the one-shot `certbot-init` service (compose profile "init"), which
# obtains the initial certificate via the ACME http-01 webroot challenge served
# by nginx at /.well-known/acme-challenge/ (mapped to the certbot-www volume),
# then reloads nginx via the certbot --deploy-hook.
#
# Ongoing renewals are handled automatically by the long-running `certbot`
# service (renew loop) — you only need to run this script once per domain.
#
# PREREQUISITES:
#   - DOMAIN and CERTBOT_EMAIL must be set in your .env (see .env.example).
#   - The nginx service must be up and reachable on port 80 for the ACME
#     http-01 challenge (this script starts nginx if it is not running).
#   - Your DNS A/AAAA record for $DOMAIN must point at this host.
#
# USAGE:
#   ./deploy/setup-ssl.sh
# ==============================================================================
set -euo pipefail

# Resolve repo root (parent of this script's directory) so the script works from
# any working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# Load .env if present so DOMAIN / CERTBOT_EMAIL are available for validation.
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
fi

if [ -z "${DOMAIN:-}" ]; then
  echo "ERROR: DOMAIN is not set. Add DOMAIN=yourdomain.com to your .env." >&2
  exit 1
fi
if [ -z "${CERTBOT_EMAIL:-}" ]; then
  echo "ERROR: CERTBOT_EMAIL is not set. Add CERTBOT_EMAIL=admin@yourdomain.com to your .env." >&2
  exit 1
fi

# Prefer the Docker Compose v2 plugin; fall back to legacy docker-compose.
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

echo ">> Ensuring nginx is running (needed to serve the ACME http-01 challenge)..."
${COMPOSE} up -d nginx

echo ">> Requesting initial certificate for ${DOMAIN} (contact: ${CERTBOT_EMAIL})..."
${COMPOSE} --profile init run --rm certbot-init

echo ""
echo "=============================================================================="
echo " SUCCESS: Initial certificate issuance completed for ${DOMAIN}."
echo ""
echo " Next steps:"
echo "   - nginx has been reloaded via the certbot --deploy-hook."
echo "   - Ongoing renewals are automatic via the long-running 'certbot' service."
echo "   - To force a manual renew: ${COMPOSE} run --rm certbot renew"
echo "=============================================================================="
