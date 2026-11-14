/**
 * tests/e2e/tiers/tier1_contracts/tier1_f13_frontend_test_review.test.js
 * Feature F13: Frontend TestReview Activation (Tier 1 Contract & Real DOM Mounting)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { DomEnvironment, screen, fireEvent } from "../../harness/domTester.js";
import TestReview from "../../../apps/frontend/src/pages/tests/TestReview.jsx";

describe("Tier 1 - Feature F13: Frontend TestReview Activation", () => {
  let env;

  const mockTest = {
    id: "test-101",
    title: "SSC CGL Tier 1 Mock 2026",
    questions: [
      {
        id: "q-1",
        text: "What is 2 + 2?",
        options: ["3", "4", "5", "6"],
        correctOption: 1,
        selectedOption: 1,
        isCorrect: true,
        explanation: "2 + 2 = 4 by basic arithmetic.",
      },
    ],
  };

  test("T1.F13.01: TestReview.jsx component file existence and completeness", () => {
    const compPath = path.resolve(
      process.cwd(),
      "apps/frontend/src/pages/tests/TestReview.jsx",
    );
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content.length).toBeGreaterThan(10000);
    expect(content).toContain("TestReview");
  });

  test("T1.F13.02: Frontend App.jsx references or mounts test review routes", () => {
    const appPath = path.resolve(process.cwd(), "apps/frontend/src/App.jsx");
    expect(fs.existsSync(appPath)).toBe(true);

    const content = fs.readFileSync(appPath, "utf-8");
    expect(content).toContain("review");
  });

  test("T1.F13.03: TestReview renders score card and question details headlessly in DOM", async () => {
    env = new DomEnvironment();
    await env.init();

    await env.mount(
      TestReview,
      {},
      {
        router: {
          initialEntries: [
            {
              pathname: "/tests/test-101/review",
              state: { testData: mockTest },
            },
          ],
          routePath: "/tests/:testId/review",
        },
      },
    );

    expect(screen.getByText("Test Paper & Solutions")).toBeDefined();
    expect(screen.getByText("What is 2 + 2?")).toBeDefined();
    expect(screen.getByText("4 ✓ (Correct Answer)")).toBeDefined();

    env.cleanup();
  });

  test("T1.F13.04: Print button triggers window.print() hook in TestReview", async () => {
    env = new DomEnvironment();
    await env.init();

    await env.mount(
      TestReview,
      {},
      {
        router: {
          initialEntries: [
            {
              pathname: "/tests/test-101/review",
              state: { testData: mockTest },
            },
          ],
          routePath: "/tests/:testId/review",
        },
      },
    );

    expect(env.printCalls).toBe(0);
    const printBtn = screen.getByRole("button", { name: /print/i });
    fireEvent.click(printBtn);
    expect(env.printCalls).toBe(1);

    env.cleanup();
  });

  test("T1.F13.05: Interactive re-solve button toggles interactive mode in TestReview", async () => {
    env = new DomEnvironment();
    await env.init();

    await env.mount(
      TestReview,
      {},
      {
        router: {
          initialEntries: [
            {
              pathname: "/tests/test-101/review",
              state: { testData: mockTest },
            },
          ],
          routePath: "/tests/:testId/review",
        },
      },
    );

    const reSolveBtn = screen.getByRole("button", { name: /re-solve/i });
    fireEvent.click(reSolveBtn);
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(4);

    env.cleanup();
  });
});
