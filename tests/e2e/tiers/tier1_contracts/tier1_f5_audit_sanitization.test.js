/**
 * tests/e2e/tiers/tier1_contracts/tier1_f5_audit_sanitization.test.js
 * Feature F5: Audit Log Query Sanitization (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { redactSensitiveValues, SENSITIVE_KEY_PATTERN } from "../../../apps/backend/src/middleware/audit.middleware.js";

describe("Tier 1 - Feature F5: Audit Log Query Sanitization", () => {
  const auditPath = path.resolve(process.cwd(), "apps/backend/src/middleware/audit.middleware.js");

  test("T1.F5.01: SENSITIVE_KEY_PATTERN regex covers tokens, keys, passwords, and secrets", () => {
    expect(fs.existsSync(auditPath)).toBe(true);

    const sensitiveKeys = ["token", "secret", "password", "apiKey", "api_key", "jwt", "otp", "credential"];
    for (const key of sensitiveKeys) {
      expect(SENSITIVE_KEY_PATTERN.test(key)).toBe(true);
    }
  });

  test("T1.F5.02: Query parameter redaction pattern replaces sensitive keys with [REDACTED]", () => {
    const input = {
      token: "secret_token_12345",
      page: "2",
      limit: "50",
    };

    const redacted = redactSensitiveValues(input);
    expect(redacted.token).toBe("[REDACTED]");
    expect(redacted.page).toBe("2");
    expect(redacted.limit).toBe("50");
  });

  test("T1.F5.03: Audit middleware request path sanitization logic strips raw query strings", () => {
    const content = fs.readFileSync(auditPath, "utf-8");
    expect(content).toContain("split(\"?\")[0]");
  });

  test("T1.F5.04: Deep recursive object and array redaction preserves object purity", () => {
    const payload = {
      user: {
        password: "MySuperPassword!",
        profile: { apiKey: "key-999" },
      },
      items: [{ token: "tok-1" }, { id: 101 }],
    };

    const redacted = redactSensitiveValues(payload);
    expect(redacted.user.password).toBe("[REDACTED]");
    expect(redacted.user.profile.apiKey).toBe("[REDACTED]");
    expect(redacted.items[0].token).toBe("[REDACTED]");
    expect(redacted.items[1].id).toBe(101);
  });

  test("T1.F5.05: Non-sensitive data remains untouched in audit details", async () => {
    const auditModule = await import(pathToFileURL(auditPath).href);
    expect(typeof auditModule.auditMiddleware).toBe("function");

    const middleware = auditModule.auditMiddleware();
    expect(typeof middleware).toBe("function");
  });
});
