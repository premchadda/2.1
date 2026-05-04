# Trstprep

Trstprep is a monorepo for an online exam-preparation platform focused on competitive exams such as SSC and Railway. The repository contains the learner-facing web app, a separate admin panel, a Node.js API, shared workspace packages, and supporting docs/scripts.

## Workspace Layout

```text
.
|-- apps/
|   |-- backend/       # Express API + background worker entrypoints
|   |-- frontend/      # Learner-facing React + Vite app
|   `-- admin-panel/   # Admin React + Vite app
|-- packages/
|   |-- shared-config/
|   `-- shared-hooks/
|-- dev-tools/         # audit, and maintenance scripts
|-- docs/              # Product, API, architecture, and audit docs
|-- turbo.json
`-- package.json
```

## Tech Stack

- Backend: Node.js, Express, PostgreSQL, Redis/BullMQ, Socket.IO
- Frontend/Admin: React 18, Vite, Tailwind CSS, React Router, Axios
- Monorepo tooling: npm workspaces, Turborepo, Prettier

## Apps And Ports

| App         | Path               | Default Port |
| ----------- | ------------------ | ------------ |
| Backend API | `apps/backend`     | `5001`       |
| Frontend    | `apps/frontend`    | `3000`       |
| Admin panel | `apps/admin-panel` | `3002`       |

Health check: `http://localhost:5001/api/health`

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL database
- Redis optional for API-only development, recommended if running the worker/queues

## Installation

```bash
npm install
```

## Environment Setup

Copy the example files before starting the apps:

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
cp apps/admin-panel/.env.example apps/admin-panel/.env
```

### Backend Required Variables

The backend exits on startup if these are missing:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
JWT_SECRET=generate-a-strong-secret-at-least-32-characters
FRONTEND_URL=http://localhost:3000
```

Common additional variables:

```env
PORT=5001
NODE_ENV=development
ADMIN_PANEL_URL=http://localhost:3002
REDIS_URL=redis://localhost:6379
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

### Frontend And Admin Variables

The browser apps primarily read `VITE_API_URL` for API requests. In local development, the Vite dev servers also support proxying to the backend via `VITE_BACKEND_URL`.

Typical local values:

```env
# apps/frontend/.env
VITE_API_URL=/api
VITE_SOCKET_URL=/
VITE_ADMIN_URL=http://localhost:3002
VITE_BACKEND_URL=http://localhost:5001

# apps/admin-panel/.env
VITE_API_URL=/api
VITE_MAIN_SITE_URL=http://localhost:3000
VITE_ADMIN_SITE_URL=http://localhost:3002
VITE_BACKEND_URL=http://localhost:5001
```

## Running The Monorepo

Start everything through Turborepo:

```bash
npm run dev
```

Or run individual apps:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:admin
```

Backend-only worker process:

```bash
cd apps/backend
npm run worker:dev
```

## Build Commands

```bash
npm run build
npm run build:backend
npm run build:frontend
npm run build:admin
```

## Testing And Linting

Root commands:

```bash
npm run test
npm run lint
npm run format
```

Current state:

- Backend has Jest-based test scripts.
- Frontend test script is a placeholder and does not run a real suite yet.
- Admin panel does not currently expose a test script in `package.json`.

## Useful Scripts

```bash
npm run docs
npm run watch-docs
```

The `dev-tools/scripts` directory also contains one-off audit and repair scripts for data maintenance.

## Notable Features In This Repo

- Separate learner app and admin panel
- JWT-based auth and role-protected admin APIs
- Exam, test-series, practice, study-material, current-affairs, leaderboard, and community routes
- WebSocket support and optional Redis-backed queues
- Shared workspace packages for config and hooks

## Documentation

- Main docs index: [docs/README.md](docs/README.md)
- API docs: [docs/api/API_DOCUMENTATION.html](docs/api/API_DOCUMENTATION.html)
- Architecture docs: [docs/architecture](docs/architecture)
- Admin separation notes: [docs/architecture/ADMIN_SEPARATION_BLUEPRINT.md](docs/architecture/ADMIN_SEPARATION_BLUEPRINT.md)

## Notes

- The repo contains historical audits and archive docs; not all documents reflect the latest code state.
- Root and app package versions are currently `2.0.0` even though some older docs still mention `2.1.0`.
