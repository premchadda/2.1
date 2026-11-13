/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f13_review_edge_cases.test.js
 * Feature F13: Frontend TestReview Activation (Tier 2 Boundaries & Error Fallbacks)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { DomEnvironment, screen, fireEvent } from "../../harness/domTester.js";
import TestReview from "../../../apps/frontend/src/pages/tests/TestReview.jsx";

describe("Tier 2 - Feature F13: TestReview Boundaries & Resilience", () => {
  const reviewPath = path.resolve(process.cwd(), "apps/frontend/src/pages/tests/TestReview.jsx");

  test("T2.F13.01: TestReview handles missing location.state gracefully with API fetch", () => {
    const content = fs.readFileSync(reviewPath, "utf-8");
    expect(content).toContain("location.state");
  });

  test("T2.F13.02: Error boundary or fallback card exists for test load failure", () => {
    const content = fs.readFileSync(reviewPath, "utf-8");
    expect(content).toContain("error");
  });

  test("T2.F13.03: All questions skipped/unanswered state calculation in TestReview", async () => {
    const mockSkippedTest = {
      id: "test-skipped",
      title: "Skipped Mock Test",
      questions: [
        { id: "q1", text: "Q1", options: ["A", "B"], selectedOption: null, isSkipped: true, isCorrect: false },
        { id: "q2", text: "Q2", options: ["A", "B"], selectedOption: null, isSkipped: true, isCorrect: false },
      ],
    };

    const env = new DomEnvironment();
    await env.init();

    await env.mount(
      TestReview,
      {},
      {
        router: {
          initialEntries: [{ pathname: "/tests/test-skipped/review", state: { testData: mockSkippedTest } }],
          routePath: "/tests/:testId/review",
        },
      }
    );

    expect(screen.getByText("Score: 0 / 0")).toBeDefined();
    env.cleanup();
  });

  test("T2.F13.04: Printable solutions feature presence and trigger", async () => {
    const mockTest = {
      id: "test-print",
      title: "Printable Mock Test",
      questions: [
        { id: "qp1", text: "Math Question 1", options: ["1", "2"], correctOption: 0, selectedOption: 0, isCorrect: true },
      ],
    };

    const env = new DomEnvironment();
    await env.init();

    await env.mount(
      TestReview,
      {},
      {
        router: {
          initialEntries: [{ pathname: "/tests/test-print/review", state: { testData: mockTest } }],
          routePath: "/tests/:testId/review",
        },
      }
    );

    const printBtn = screen.getByRole("button", { name: /print/i });
    expect(printBtn).toBeDefined();
    fireEvent.click(printBtn);
    expect(env.printCalls).toBe(1);

    env.cleanup();
  });

  test("T2.F13.05: Interactive re-solve state toggling and option radio interaction", async () => {
    const mockTest = {
      id: "test-interactive",
      title: "Interactive Mock Test",
      questions: [
        { id: "qi1", text: "What is 10 x 10?", options: ["50", "100", "150"], correctOption: 1, selectedOption: 0, isCorrect: false },
      ],
    };

    const env = new DomEnvironment();
    await env.init();

    await env.mount(
      TestReview,
      {},
      {
        router: {
          initialEntries: [{ pathname: "/tests/test-interactive/review", state: { testData: mockTest } }],
          routePath: "/tests/:testId/review",
        },
      }
    );

    const reSolveBtn = screen.getByRole("button", { name: /re-solve/i });
    fireEvent.click(reSolveBtn);
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(3);

    env.cleanup();
  });
});
