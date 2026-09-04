/**
 * Trstprep API Backend - Canonical Production Entry Point
 *
 * Imports and delegates to the primary Express server implementation (`app-port5001.js`).
 * This provides standard Node.js entry point conventions (`node src/server.js`)
 * while preserving backward compatibility with existing PM2, Docker, and script configurations.
 */
import app from "./app-port5001.js";

export default app;
