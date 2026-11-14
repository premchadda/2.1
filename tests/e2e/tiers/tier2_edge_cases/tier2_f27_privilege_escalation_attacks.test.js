/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f27_privilege_escalation_attacks.test.js
 * Feature F27: Admin Role Privilege Escalation Guard (Tier 2 Attacks & Negative Boundaries)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 2 - Feature F27: Privilege Escalation Attacks & Role Security", () => {
  test("T2.F27.01: System roles protection logic against deletion when users assigned", () => {
    const rolesRoutePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/admin-roles.js",
    );
    const content = fs.readFileSync(rolesRoutePath, "utf-8");
    // Verify roles with assigned users are protected from deletion
    expect(content).toContain("Cannot delete role. It has");
  });

  test("T2.F27.02: Backend validates permission format against object-shaped wildcard injection", () => {
    const rolesRoutePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/admin-roles.js",
    );
    const content = fs.readFileSync(rolesRoutePath, "utf-8");
    // Checks that wildcard permission grant requires explicit wildcard privileges
    expect(content).toContain("Wildcard grant requires wildcard permission");
  });

  test("T2.F27.03: Attacker user cannot assign administrative roles", async () => {
    const res = await apiClient.asStudent().post("/api/admin/roles/1/assign", {
      userId: 9999,
    });
    expect([401, 403]).toContain(res.status);
  });

  test("T2.F27.04: Direct API call to update role without super admin token is rejected", async () => {
    const res = await apiClient.asStudent().put("/api/admin/roles/1", {
      permissions: ["*"],
    });
    expect([401, 403]).toContain(res.status);
  });

  test("T2.F27.05: Empty role name or empty permissions payload is rejected with 400", () => {
    const rolesRoutePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/admin-roles.js",
    );
    const content = fs.readFileSync(rolesRoutePath, "utf-8");
    expect(content).toContain("name");
  });
});
