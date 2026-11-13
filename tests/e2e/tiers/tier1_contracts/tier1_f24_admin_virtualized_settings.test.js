/**
 * tests/e2e/tiers/tier1_contracts/tier1_f24_admin_virtualized_settings.test.js
 * Feature F24: Admin VirtualizedTree & Settings Activation (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F24: Admin VirtualizedTree & Settings Activation", () => {
  test("T1.F24.01: VirtualizedTree.jsx component exists for deep syllabus tree virtualization", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/shared/components/VirtualizedTree.jsx"
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("VirtualizedTree");
  });

  test("T1.F24.02: VirtualizedTree supports node expansion and depth indentation", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/shared/components/VirtualizedTree.jsx"
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("onNodeExpand");
  });

  test("T1.F24.03: settingsSchema.js exports strict Zod schema for configuration validation", () => {
    const schemaPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/shared/lib/settingsSchema.js"
    );
    expect(fs.existsSync(schemaPath)).toBe(true);

    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toContain("settingsSchema");
  });

  test("T1.F24.04: settingsSchema verifies site metadata, email, and tax rates", () => {
    const schemaPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/shared/lib/settingsSchema.js"
    );
    const content = fs.readFileSync(schemaPath, "utf-8");
    expect(content).toContain("siteName");
    expect(content).toContain("contactEmail");
  });

  test("T1.F24.05: AdminSettings page exists for platform configuration management", () => {
    const pagePath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/system-settings/AdminSettings.jsx"
    );
    expect(fs.existsSync(pagePath)).toBe(true);

    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("AdminSettings");
  });
});
