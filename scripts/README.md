# Trstprep Maintenance Scripts

This directory contains utility scripts for database maintenance, user management, and debugging.

## Scripts

- **seed-admin.js** - Creates the initial admin user (admin@trstprep.com) with a random strong password if not set. Uses `ADMIN_DEFAULT_PASSWORD` env var for deterministic password (useful for deployments).
- **reset-admin.js** - Resets admin password to a new random strong password (or use ADMIN_DEFAULT_PASSWORD env var).
- **debug-user.js** - Debug utility to check a user's password hash and status. Use with caution.

## Usage

```bash
cd /path/to/trstprep
npm --prefix apps/backend run seed   # or reset, debug
```

Or directly:

```bash
node apps/backend/src/scripts/seed-admin.js
```

Note: These scripts should be moved to `scripts/` at repository root for production deployments as shown above.

## Environment Variables

- `ADMIN_DEFAULT_PASSWORD` - Set to a specific password for admin account (useful for automated deployments). If not set, a random secure password is generated and printed to console.

## Security

- Keep these scripts out of production web-accessible directories.
- Never run debug-user.js in production unless necessary and ensure logs are secured.
- Scripts that modify user data should be used with caution.
