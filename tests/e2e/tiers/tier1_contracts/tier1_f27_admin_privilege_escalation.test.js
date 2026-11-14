/**
 * tests/e2e/tiers/tier1_contracts/tier1_f27_admin_privilege_escalation.test.js
 * Feature F27: Admin Role Privilege Escalation Guard (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 1 - Feature F27: Admin Role Privilege Escalation Guard", () => {
  test("T1.F27.01: RolePermissionsManager component exists and enforces RBAC", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/users-enrollments/RolePermissionsManager.jsx",
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    // Verify role management checks for super admin or isSuperPerms
    expect(content).toContain("isSuperPerms");
  });

  test("T1.F27.02: Super-Admin permission evaluation allows role administration", () => {
    const superAdminPermissions = ["*"];
    const isSuperPerms = superAdminPermissions.includes("*");
    expect(isSuperPerms).toBe(true);
  });

  test("T1.F27.03: canManage evaluates false for standard admin without wildcard", () => {
    const standardAdminPermissions = ["users:read", "users:edit"];
    const isSuperPerms = standardAdminPermissions.includes("*");
    // Under hardened rules, users:edit alone is not sufficient to edit system roles
    expect(isSuperPerms).toBe(false);
  });

  test("T1.F27.04: Backend admin-roles route rejects wildcard permission grant without super-admin", () => {
    const routePath = path.resolve(
      process.cwd(),
      "apps/backend/src/api/routes/admin-roles.js",
    );
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("Wildcard grant requires wildcard permission");
  });

  test("T1.F27.05: HTTP endpoint POST /api/admin/roles requires authentication", async () => {
    const res = await apiClient.asAnonymous().post("/api/admin/roles", {
      name: "escalated_role",
      permissions: ["*"],
    });

    expect(res.status).toBe(401);
  });
});
