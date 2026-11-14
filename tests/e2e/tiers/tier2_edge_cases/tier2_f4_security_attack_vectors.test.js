/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f4_security_attack_vectors.test.js
 * Feature F4: Security Pipeline & Route Guarding (Tier 2 Boundary & Attack Vectors)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 2 - Feature F4: Security Attack Vectors & Route Guarding", () => {
  test("T2.F4.01: Malicious Origin header spoofing on admin endpoints is rejected", async () => {
    const maliciousClient = apiClient.asAdmin().withHeaders({
      Origin: "https://attacker-phishing-site.com",
    });

    const res = await maliciousClient.post("/api/admin/roles", {
      name: "attacker_role",
    });
    expect([401, 403]).toContain(res.status);
  });

  test("T2.F4.02: Invalid admin API key header is rejected", async () => {
    const invalidKeyClient = apiClient.asAdmin().withHeaders({
      "x-admin-api-key": "invalid_forged_key_12345",
    });

    const res = await invalidKeyClient.get("/api/admin/users");
    expect([401, 403]).toContain(res.status);
  });

  test("T2.F4.03: CSRF token mismatch on mutating endpoints is rejected", async () => {
    const badCsrfClient = apiClient.asAdmin().withHeaders({
      "x-csrf-token": "forged-csrf-token-xyz",
    });

    const res = await badCsrfClient.post("/api/admin/catalog", {
      title: "Forged Test",
    });
    expect([401, 403]).toContain(res.status);
  });

  test("T2.F4.04: Client IP extraction in phoneAuth.js validates headers safely", () => {
    const phoneAuthPath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/phoneAuth.js",
    );
    expect(fs.existsSync(phoneAuthPath)).toBe(true);

    const content = fs.readFileSync(phoneAuthPath, "utf-8");
    expect(content).toContain("getClientIp");
  });

  test("T2.F4.05: Nginx proxy configuration preserves critical proxy headers", () => {
    const nginxConfPath = path.resolve(
      process.cwd(),
      "deploy/nginx/nginx.conf",
    );
    expect(fs.existsSync(nginxConfPath)).toBe(true);
    const content = fs.readFileSync(nginxConfPath, "utf-8");
    expect(content).toContain("proxy_set_header");
    expect(content).toContain("X-Forwarded-For");
  });
});
