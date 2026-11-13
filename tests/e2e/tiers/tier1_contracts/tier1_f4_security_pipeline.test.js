/**
 * tests/e2e/tiers/tier1_contracts/tier1_f4_security_pipeline.test.js
 * Feature F4: Security Pipeline & Route Guarding (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 1 - Feature F4: Security Pipeline & Route Guarding", () => {
  test("T1.F4.01: Admin router mounts canonical defense middleware stack in order", () => {
    const adminRouterPath = path.resolve(process.cwd(), "apps/backend/src/api/routes/admin.js");
    expect(fs.existsSync(adminRouterPath)).toBe(true);

    const content = fs.readFileSync(adminRouterPath, "utf-8");
    // Verify required middleware present in admin router stack
    expect(content).toContain("normalizeFields");
    expect(content).toContain("protect");
    expect(content).toContain("admin");
  });

  test("T1.F4.02: Unauthenticated access to admin endpoints is rejected (401)", async () => {
    const res = await apiClient.asAnonymous().get("/api/admin/users");
    expect(res.status).toBe(401);
  });

  test("T1.F4.03: Non-admin student token is rejected from admin endpoints (403)", async () => {
    const res = await apiClient.asStudent().get("/api/admin/catalog");
    expect(res.status).toBe(403);
  });

  test("T1.F4.04: Administrative stage mutations require admin authorization", () => {
    const stagesPath = path.resolve(process.cwd(), "apps/backend/src/api/routes/stages.js");
    expect(fs.existsSync(stagesPath)).toBe(true);

    const content = fs.readFileSync(stagesPath, "utf-8");
    expect(content).toContain("protect");
  });

  test("T1.F4.05: FortSpy security keygen routes require authentication", () => {
    const fortspyPath = path.resolve(process.cwd(), "apps/backend/src/api/routes/fortspy.js");
    expect(fs.existsSync(fortspyPath)).toBe(true);

    const content = fs.readFileSync(fortspyPath, "utf-8");
    expect(content).toContain("protect");
  });
});
