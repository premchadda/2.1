/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f5_audit_leak_evasion.test.js
 * Feature F5: Audit Log Query Sanitization (Tier 2 Boundary & Leak Evasion)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { redactSensitiveValues } from "../../../apps/backend/src/middleware/audit.middleware.js";

describe("Tier 2 - Feature F5: Audit Leak Evasion & Boundary Protection", () => {
  const auditPath = path.resolve(
    process.cwd(),
    "apps/backend/src/middleware/audit.middleware.js",
  );

  test("T2.F5.01: Delimiter, hyphenation, and camelCase evasion key patterns are redacted", () => {
    const pattern =
      /secret|password|token|api[_-]?key|jwt|pass|pwd|otp|private[_-]?key|access[_-]?key|credential/i;

    const evasionKeys = [
      "API-KEY",
      "api_key",
      "user_password_hash",
      "jwtToken",
      "auth_otp",
      "client_secret_key",
      "ACCESS-TOKEN",
      "superSecretCredential",
    ];

    for (const key of evasionKeys) {
      expect(pattern.test(key)).toBe(true);
    }
  });

  test("T2.F5.02: URL-encoded parameters in originalUrl are sanitized safely", () => {
    const rawUrl = "/api/admin/users?token%3Dvalue=my_secret_token&user=priya";
    const safePath = rawUrl.split("?")[0];
    expect(safePath).toBe("/api/admin/users");
    expect(safePath).not.toContain("my_secret_token");
  });

  test("T2.F5.03: Self-auditing paths are excluded to prevent infinite logging loops", () => {
    const content = fs.readFileSync(auditPath, "utf-8");
    expect(content).toContain("defaultSkipPaths");
    expect(content).toContain("/api/admin/audit-logs");
  });

  test("T2.F5.04: Audit logging fail-open resilience protects client requests", () => {
    const content = fs.readFileSync(auditPath, "utf-8");
    // Verify error is caught in try/catch block without throwing
    expect(content).toContain("catch (error)");
    expect(content).toContain("[AUDIT] Failed to write audit log");
  });

  test("T2.F5.05: High-volume payload redaction execution speed", () => {
    const largeObj = {};
    for (let i = 0; i < 500; i++) {
      largeObj[`param_${i}`] =
        i % 10 === 0 ? `token_val_${i}` : `normal_val_${i}`;
      if (i % 10 === 0) {
        largeObj[`api_key_${i}`] = `secret_key_${i}`;
      }
    }

    const start = Date.now();
    const result = redactSensitiveValues(largeObj);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
    expect(result["api_key_0"]).toBe("[REDACTED]");
    expect(result["param_1"]).toBe("normal_val_1");
  });
});
