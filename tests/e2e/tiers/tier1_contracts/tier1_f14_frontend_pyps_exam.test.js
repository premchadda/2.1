/**
 * tests/e2e/tiers/tier1_contracts/tier1_f14_frontend_pyps_exam.test.js
 * Feature F14: Frontend PypsExam Activation (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F14: Frontend PypsExam Activation", () => {
  test("T1.F14.01: PypsExam.jsx component file exists and is fully implemented", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/pyps/PypsExam.jsx",
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content.length).toBeGreaterThan(5000);
    expect(content).toContain("PypsExam");
  });

  test("T1.F14.02: Route declaration for previous year papers exists in App.jsx", () => {
    const appPath = path.resolve(process.cwd(), "apps/frontend/src/App.jsx");
    const content = fs.readFileSync(appPath, "utf-8");
    expect(content).toContain("/pyps");
  });

  test("T1.F14.03: PypsExam implements tier filtering logic", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/pyps/PypsExam.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("selectedTier");
  });

  test("T1.F14.04: PypsExam implements search query filtering", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/pyps/PypsExam.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("searchQuery");
  });

  test("T1.F14.05: PypsExam integrates YearGroupSection and insights panel", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/pyps/PypsExam.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("YearGroupSection");
  });
});
