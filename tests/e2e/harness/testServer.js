/**
 * tests/e2e/harness/testServer.js
 * In-process ephemeral HTTP test server hosting the genuine Express application.
 */

import http from "node:http";
import path from "node:path";
import dns from "node:dns";
import dotenv from "dotenv";

dns.setDefaultResultOrder("ipv4first");
dotenv.config({ path: path.resolve(process.cwd(), "apps/backend/.env") });
dotenv.config();

let serverInstance = null;
let serverBaseUrl = null;

export async function ensureLiveTestServer() {
  if (serverBaseUrl) {
    return serverBaseUrl;
  }

  // 1. If an external server is already configured and reachable, use it
  const configuredUrl = process.env.API_BASE_URL || "http://127.0.0.1:5001";
  try {
    const probe = await fetch(`${configuredUrl}/api/health`, { signal: AbortSignal.timeout(1000) });
    if (probe.status < 500) {
      serverBaseUrl = configuredUrl;
      return serverBaseUrl;
    }
  } catch {
    // External server not running; proceed to start in-process server
  }

  // 2. Start in-process Express server on ephemeral port (port 0)
  const { default: app } = await import("../../../apps/backend/src/app-port5001.js");
  serverInstance = http.createServer(app);
  await new Promise((resolve, reject) => {
    serverInstance.listen(0, "127.0.0.1", () => resolve());
    serverInstance.on("error", reject);
  });

  const { port } = serverInstance.address();
  serverBaseUrl = `http://127.0.0.1:${port}`;
  return serverBaseUrl;
}

export async function stopLiveTestServer() {
  if (serverInstance) {
    await new Promise((resolve) => serverInstance.close(resolve));
    serverInstance = null;
    serverBaseUrl = null;
  }
}
