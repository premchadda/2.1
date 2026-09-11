/**
 * Trstprep API Backend - Canonical Production Entry Point
 *
 * Imports and delegates to the primary Express server implementation (`app-port5001.js`).
 * This provides standard Node.js entry point conventions (`node src/server.js`)
 * while preserving backward compatibility with existing PM2, Docker, and script configurations.
 *
 * NOTE on entry points: package.json `main` and `start`/`dev` scripts point at
 * `src/app-port5001.js` (the real server: app creation + listen). This file is
 * a thin re-export shim so `node src/server.js` / `import ... from './server.js'`
 * resolve to the same app instance. Do NOT start a second listener here —
 * keep all listen() logic in app-port5001.js to avoid port conflicts.
 */
import app from "./app-port5001.js";

export default app;
