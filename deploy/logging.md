# Centralized Logging — Grafana Loki (normative)

> As of 2026-09-06. Loki is the single log store for the compose stack.
> `docker-compose.yml` defines the `x-logging: &default_logging` anchor
> (Loki driver, `loki-url: http://loki:3100/loki/api/v1/push`,
> `max-retries: "3"`) and every service below reuses it via
> `logging: *default_logging`.

## Which services ship where

**Via the Loki driver (7 services):** `backend-1`, `backend-2`, `frontend`,
`admin-panel`, `nginx`, `prometheus`, `grafana`.

**`json-file` exception (1 service):** `loki` itself
(`grafana/loki:2.9.2`, `max-size=10m`, `max-file=5`) — it cannot ship its own
logs to itself.

**No explicit logging config** (Docker defaults apply): `redis`,
`backend-db`, `certbot`, `certbot-init`.

The Loki driver buffers and drops when Loki is unreachable, so application
containers still start while Loki is down. Logs persist in the `loki-data`
volume; query them from Grafana (add Loki at `http://loki:3100`). Loki sits
on the internal `monitoring-net` only and is not published publicly.

## Application logs

Backend code logs via `apps/backend/src/infrastructure/logger/logger.js`
(pino; JSON in production, pretty-printed in dev) with an in-memory ring in
`logBuffer.js`. Sensitive fields (`password`, tokens, secrets, API keys,
cookies, CSRF, `authorization` headers) are redacted by the logger — keep
them redacted when adding log statements. Admin mutations additionally emit
`audit_trail` rows; the driver captures container stdout/stderr, giving one
pane for app + audit output.

## Nginx logs (file → driver mechanism)

`deploy/nginx/nginx.conf` defines `log_format upstream_log …` with
`access_log /var/log/nginx/access.log upstream_log;` and
`error_log /var/log/nginx/error.log warn;`. These file targets are captured
by the Loki driver **only insofar as they resolve to the container's
stdout/stderr** (stock nginx images symlink those paths to stdout/stderr).
If you repoint them at real files, those bytes stay on container-local
storage (a tmpfs mount here) and never reach Loki — so keep log targets on
the stdout/stderr symlinks and treat Loki retention, not local rotation, as
the retention story.

## Bootstrap prerequisites (fresh host, Linux, run once)

`deploy/bootstrap.sh` (run before `docker compose up -d`):

1. Installs the Docker log-driver plugin (required on **each** host —
   without it, compose fails to create any Loki-logged container):
   `docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions`
2. Provisions TLS via `deploy/setup-ssl.sh` (needs `DOMAIN` +
   `CERTBOT_EMAIL` in `.env`; initial issuance also available as the
   `certbot-init` one-shot, `docker compose --profile init run --rm
certbot-init`).

## Appendix: alternative forwarder (non-normative)

If Loki is ever retired, replace the `&default_logging` anchor with a
syslog forwarder instead (kept here for reference only — do not run both):

```yaml
logging: &default_logging
  driver: syslog
  options:
    syslog-address: "tcp://loghost.internal:514"
    syslog-facility: "local0"
    syslog-format: "rfc5424"
    tag: "trstprep-{{.Name}}"
```
