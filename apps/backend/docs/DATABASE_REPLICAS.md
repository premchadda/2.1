# Database Read Replicas

This document explains how to configure and use PostgreSQL read replicas with Trstprep V2.1.

## Overview

Trstprep supports **read/write splitting** using PostgreSQL read replicas. This separates read-heavy operations from write operations, improving performance and reducing load on the primary database.

- **Write Pool (Primary)**: Used for all INSERT, UPDATE, DELETE operations
- **Read Pool (Replica)**: Used for SELECT operations when configured

## Supabase Setup

### Enabling Read Replicas

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Replication**
3. Enable **Read Replicas** (available on Pro plans and above)
4. Copy the connection string for the read replica

### Connection Strings

Supabase provides two connection strings:
- **Primary**: `postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres`
- **Read Replica**: Available in Dashboard → Database → Connection string → Read replica

## Environment Variables

Add these to your `.env` file:

```bash
# Primary database (read/write)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB

# Read replica (optional - falls back to primary if not set)
DATABASE_READ_URL=postgresql://USER:PASSWORD@HOST:PORT/DB

# Read pool configuration (optional)
PG_READ_POOL_MAX=10
```

## Configuration

The read replica configuration is in `config/database-replicas.js`:

- **Write Pool**: Uses `DATABASE_URL` with `PG_POOL_MAX` connections
- **Read Pool**: Uses `DATABASE_READ_URL` with `PG_READ_POOL_MAX` connections
- **Fallback**: If `DATABASE_READ_URL` is not set, the read pool uses the primary database

## API Methods

### Write Operations (Use Write Pool)

These methods use the primary database:

- `find()` - Find multiple records
- `findById()` - Find by ID
- `findOne()` - Find single record
- `insertOne()` - Insert record
- `insertMany()` - Insert multiple records
- `updateById()` - Update by ID
- `deleteById()` - Delete by ID
- `deleteMany()` - Delete multiple records

### Read Operations (Use Read Pool)

These methods use the read replica (when configured):

- `findReadOnly()` - Find multiple records (read replica)
- `findByIdReadOnly()` - Find by ID (read replica)
- `findByPublicIdReadOnly()` - Find by public ID (read replica)

### Example Usage

```javascript
import { dbHelpers } from './infrastructure/database/postgres-helpers.js';

// Write operation (uses primary)
await dbHelpers.insertOne('users', { email: 'user@example.com' });

// Read operation (uses read replica when available)
const user = await dbHelpers.findByIdReadOnly('users', userId);
const tests = await dbHelpers.findReadOnly('tests', { isActive: true });
```

## When to Use Read Replicas

### Good Use Cases

- **Listing endpoints**: GET requests for collections (tests, questions, etc.)
- **Dashboard data**: User stats, progress, achievements
- **Search operations**: Full-text search queries
- **Analytics**: Read-heavy aggregation queries

### Do NOT Use For

- **Writes**: Any INSERT, UPDATE, DELETE (use write pool)
- **Transactions**: Use write pool with `withTransaction()`
- **Recent writes**: If you just wrote data and need to read it immediately, use write pool to avoid replication lag

## Monitoring

Pool status is logged on startup:

```
[WritePool] Connected to primary database
[ReadPool] Connected to read replica (DATABASE_READ_URL configured)
```

If no read replica is configured:

```
[ReadPool] No DATABASE_READ_URL configured - using primary for reads
```

## Troubleshooting

### Replication Lag

If you experience stale reads after writes, it's likely replication lag. Solutions:

1. Use `findReadOnly()` only for non-critical reads
2. Use `find()` for reads that must be up-to-date
3. Consider implementing a cache invalidation strategy

### Connection Errors

If the read replica is unavailable, the pool will fall back to the primary. Check:

1. `DATABASE_READ_URL` is correctly formatted
2. Network connectivity to the replica
3. Supabase read replica is enabled (Pro plan required)

## Performance Tuning

Adjust pool sizes based on your workload:

```bash
# Primary pool (for writes + fallback reads)
PG_POOL_MAX=20

# Read pool (for read-heavy operations)
PG_READ_POOL_MAX=10
```

For high-traffic applications, consider:

- Increasing `PG_READ_POOL_MAX` for more concurrent reads
- Reducing `PG_QUERY_TIMEOUT_MS` for faster query termination
- Monitoring connection usage via Supabase dashboard
