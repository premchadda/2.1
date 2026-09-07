# Database Read Replicas

> As of 2026-09-06. Normative config: `apps/backend/config/database-replicas.js`
> (path is repo-root relative). Read this doc before touching pool code or
> adding new `dbHelpers` query methods.

## Overview

The backend uses **read/write splitting** with two `pg` pools:

- **Write pool (primary)** — all writes AND all default reads.
- **Read pool (replica)** — only used when code opts in explicitly via the
  `*ReadOnly` helpers AND `DATABASE_READ_URL` is configured.

If `DATABASE_READ_URL` is **not** set, the read pool **is** the write pool
(`readPool === writePool` in `database-replicas.js`), so `*ReadOnly` calls
transparently hit the primary. There is no separate fallback query path.

## Environment variables (all of them)

| Variable                     | Default                                      | Purpose                                                                          |
| ---------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`               | (required)                                   | Primary connection string (writes + default reads).                              |
| `DATABASE_READ_URL`          | falls back to `DATABASE_URL`                 | Replica connection string. Unset = no replica.                                   |
| `PG_POOL_MAX`                | `12`                                         | Max connections, write pool.                                                     |
| `PG_READ_POOL_MAX`           | `6`                                          | Max connections, read pool (only when `DATABASE_READ_URL` is set).               |
| `PG_CONNECTION_TIMEOUT_MS`   | `20000`                                      | `connectionTimeoutMillis`, both pools.                                           |
| `PG_IDLE_TIMEOUT_MS`         | `60000`                                      | `idleTimeoutMillis`, both pools.                                                 |
| `PG_QUERY_TIMEOUT_MS`        | `30000` dev/test, `15000` otherwise          | `query_timeout`, both pools. `NODE_ENV=development\|test` selects the dev value. |
| `PG_STATEMENT_TIMEOUT_MS`    | `30000` dev/test, `15000` otherwise          | `statement_timeout`, both pools. Same `NODE_ENV` rule.                           |
| `PG_SSL_REJECT_UNAUTHORIZED` | `"false"` (i.e. `rejectUnauthorized: false`) | Set to `"true"` only for providers with verifiable certs.                        |
| `NODE_ENV`                   | —                                            | `development`/`test` = longer query/statement timeouts (see above).              |

```bash
# Primary (required)
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<db>

# Replica (optional — omit to serve all reads from the primary)
DATABASE_READ_URL=postgresql://<user>:<password>@<replica-host>:<port>/<db>

# Pool sizing (optional — defaults shown)
PG_POOL_MAX=12
PG_READ_POOL_MAX=6
```

## Helper taxonomy: default-primary vs replica-explicit

`apps/backend/src/infrastructure/database/postgres-helpers.js` wires
`pool = getWritePool()` and `readPool = getReadPool()` (top of file) and
imports both getters from `../../../config/database-replicas.js`.

### Default-primary (reads served from the PRIMARY)

Despite the names, these are **not** replica reads — they use `this.pool`
(the write pool):

- `find()` — multi-row read (`this.pool.query`)
- `findById()` — single-row read by id (`this.pool.query`)
- `findOne()` — single-row read (`this.pool.query`)
- `findByPublicId()` — single-row read by public id (`this.pool.query`)
- All writes: `insertOne`, `insertMany`, `updateById`, `deleteById`,
  `deleteMany`, transactions (`withTransaction`)

**Rule: if you just wrote data and must read it back, use these.**
They are immune to replication lag by construction.

### Replica-explicit (read pool only)

Only these three touch `readPool`:

- `findReadOnly()` — on replica error logs `DB FindReadOnly Error (<collection>)` and returns `[]`
- `findByIdReadOnly()` — on replica error logs `DB FindByIdReadOnly Error (<collection>)` and returns `null`
- `findByPublicIdReadOnly()` — on replica error logs `DB findByPublicIdReadOnly Error (<collection>)` and returns `null`

> **Empty-on-replica-error:** `*ReadOnly` helpers never throw on query
> failure — they return an empty result (`[]` / `null`). Callers must treat
> an empty result as "unknown", not as "confirmed absent", when correctness
> matters. There is no automatic retry on the primary.

### Example usage

```javascript
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";

// Write (primary)
await dbHelpers.insertOne("users", { email: "user@example.com" });

// Read that must be fresh (primary)
const me = await dbHelpers.findById("users", userId);

// Read that may be slightly stale (replica when configured)
const tests = await dbHelpers.findReadOnly("tests", { isActive: true });
```

Low-level access (same correct import path from backend `src/`):

```javascript
import {
  getReadPool,
  getWritePool,
  readQuery,
  writeQuery,
  checkPoolsHealth,
  warmPools,
} from "../../../config/database-replicas.js";
```

## When to use the replica

Good candidates: collection listings, dashboard aggregates, search, analytics —
anything where seconds-old data is acceptable.

Do NOT use the replica for: writes, transactions, or read-after-write flows
(use the default-primary helpers instead).

## Observability (real log lines)

Pool warm-up (`warmPools()`, called at startup):

```
[DB] Connection pools warmed successfully.
[DB] Pool pre-warming encountered an issue (non-fatal): <message>
```

Background pool errors (process survives; surfaced instead of unhandled rejections):

```
[DB writePool background error]: <message>
[DB readPool background error]: <message>
```

Health: `checkPoolsHealth()` returns `{ writePool: { healthy, latencyMs },
readPool: { healthy, latencyMs, isReplica } }` (`isReplica` is false when the
read pool falls back to the primary).

Provider note: connection strings for direct (non-pooler) managed-Postgres
hosts may be IPv6-only; the config forces IPv4-first DNS and prints a warning
recommending the provider's connection pooler host when it detects a direct
database host. Prefer the pooler host in `DATABASE_URL`.

## Performance tuning

```bash
PG_POOL_MAX=12        # primary: writes + all default reads
PG_READ_POOL_MAX=6    # replica: only *ReadOnly traffic
```

Size the primary for total traffic (it serves every default read); size the
replica only for traffic you deliberately route via `*ReadOnly`.
