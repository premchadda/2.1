# ==============================================================================
# Trstprep Centralized Logging Configuration (H31)
#
# The docker-compose services now use the local `json-file` driver with rotation
# (see the `logging: *default_logging` anchors). For PRODUCTION, replace that
# block with a driver that ships logs to a central store so all services
# (backend, frontend, admin, nginx) have one searchable audit trail.
#
# Two ready-to-use options are shown below. Uncomment ONE and merge it into the
# `&default_logging` anchor in docker-compose.yml.
# ==============================================================================

# ------------------------------------------------------------------------------
# Option A: Ship to a Syslog/Logstash endpoint (e.g. self-hosted ELK / Syslog-ng)
# ------------------------------------------------------------------------------
# logging: &default_logging
#   driver: syslog
#   options:
#     syslog-address: "tcp://loghost.internal:514"
#     syslog-facility: "local0"
#     tag: "trstprep-{{.Name}}"
#     # ISO timestamp + structured service name for correlation
#     syslog-format: "rfc5424"

# ------------------------------------------------------------------------------
# Option B: Ship to Grafana Loki (already in-cluster via the monitoring-net)
#           Requires the Loki Docker log driver plugin:
#             docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
# ------------------------------------------------------------------------------
# logging: &default_logging
#   driver: loki
#   options:
#     loki-url: "http://loki:3100/loki/api/v1/push"
#     loki-pipeline-stages: |
#       - match:
#           selector: '{app="trstprep"}'
#           stages:
#             - label:
#                 service:
#     loki-external-labels: service={{.Name}}

# ------------------------------------------------------------------------------
# Application-level audit trail
# ------------------------------------------------------------------------------
# - Backend already writes structured logs via shared/logger/logger.js and emits
#   `audit_trail` entries for admin mutations — ensure the chosen log driver
#   captures stderr/stdout (default for json-file/syslog/loki).
# - nginx access/error logs (deploy/nginx/nginx.conf) are captured by the same
#   container logging driver, giving a single pane for web + app + audit logs.
#
# ------------------------------------------------------------------------------
# Operational notes
# ------------------------------------------------------------------------------
# - Rotate/retain centrally: Loki has retention; for syslog use logrotate on the
#   collector. Local json-file keeps max-size=10m, max-file=5 per container.
# - Never log secrets: logger.js already redacts password/token fields; keep it
#   that way when adding new log statements.

# ==============================================================================
# UPDATE (H31 completed): Centralized logging is now LIVE via Grafana Loki.
# ==============================================================================
# The `&default_logging` anchor in docker-compose.yml has been switched from the
# local `json-file` driver to the Loki logging driver:
#
#   x-logging: &default_logging
#     driver: loki
#     options:
#       loki-url: "http://loki:3100/loki/api/v1/push"
#       max-retries: "3"
#
# All services (backend-1/2, frontend, admin-panel, nginx, prometheus, grafana)
# now ship stdout/stderr to the in-cluster `loki` service (grafana/loki:2.9.2)
# over the internal monitoring-net. Logs are persisted in the `loki-data` volume
# and queried from Grafana (add Loki as a data source at http://loki:3100).
#
# NOTES:
# - The prior local json-file rotation (max-size=10m, max-file=5) is REPLACED by
#   Loki's centralized retention. The Option A/B snippets above are kept for
#   reference / alternative forwarders.
# - The Loki logging driver requires the Docker plugin on each host:
#     docker plugin install grafana/loki-docker-driver:latest --alias loki \
#       --grant-all-permissions
#   This is now automated — run `deploy/bootstrap.sh` on a fresh host before
#   `docker compose up -d` to install the plugin and provision the TLS cert.
# - The Loki driver buffers and drops if Loki is unreachable, so application
#   containers still start even when Loki is down.
# - The `loki` service itself keeps the json-file driver (it cannot ship its own
#   logs to itself).
