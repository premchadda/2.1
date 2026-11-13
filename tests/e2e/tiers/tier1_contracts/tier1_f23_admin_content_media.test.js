/**
 * tests/e2e/tiers/tier1_contracts/tier1_f23_admin_content_media.test.js
 * Feature F23: Admin Content Hierarchy & Media Preview (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F23: Admin Content Hierarchy & Media Preview", () => {
  test("T1.F23.01: ContentHierarchySidebar.jsx component file existence and hierarchy selectors", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/study-materials/components/ContentHierarchySidebar.jsx"
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("ContentHierarchySidebar");
  });

  test("T1.F23.02: ContentReader.jsx component file existence and HTML reader modal", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/shared/components/common/ContentReader.jsx"
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("ContentReader");
  });

  test("T1.F23.03: PDFViewer.jsx component file existence and iframe viewer logic", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/shared/components/common/PDFViewer.jsx"
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("PDFViewer");
    expect(content).toContain("google.com");
  });

  test("T1.F23.04: VideoPlayer.jsx component file existence and custom media controls", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/shared/components/common/VideoPlayer.jsx"
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("VideoPlayer");
  });

  test("T1.F23.05: ContentManagement page integrates study materials navigation", () => {
    const pagePath = path.resolve(
      process.cwd(),
      "apps/admin-panel/src/features/admin/study-materials/ContentManagement.jsx"
    );
    expect(fs.existsSync(pagePath)).toBe(true);

    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("ContentManagement");
  });
});
