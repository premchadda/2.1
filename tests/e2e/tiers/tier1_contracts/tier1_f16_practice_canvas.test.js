/**
 * tests/e2e/tiers/tier1_contracts/tier1_f16_practice_canvas.test.js
 * Feature F16: Frontend PracticeSessionCanvas Activation (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F16: Frontend PracticeSessionCanvas Activation", () => {
  test("T1.F16.01: PracticeSessionCanvas.jsx component file existence and size", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/tests/components/PracticeSessionCanvas.jsx",
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content.length).toBeGreaterThan(15000);
    expect(content).toContain("PracticeSessionCanvas");
  });

  test("T1.F16.02: PracticeSessionCanvas utilizes React Portal for focus rendering", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/tests/components/PracticeSessionCanvas.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("createPortal");
  });

  test("T1.F16.03: PracticeSessionCanvas supports answer submission and timer", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/tests/components/PracticeSessionCanvas.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("submittedAnswers");
    expect(content).toContain("timer");
  });

  test("T1.F16.04: PracticeSessionCanvas supports option strike-through", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/tests/components/PracticeSessionCanvas.jsx",
    );
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("struckOptions");
  });

  test("T1.F16.05: PracticeLab references practice workspace and session flows", () => {
    const labPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/tests/PracticeLab.jsx",
    );
    expect(fs.existsSync(labPath)).toBe(true);

    const content = fs.readFileSync(labPath, "utf-8");
    expect(content).toContain("Practice");
  });
});
