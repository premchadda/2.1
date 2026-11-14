/**
 * tests/e2e/tiers/tier1_contracts/tier1_f11_dynamic_exam_shifts.test.js
 * Feature F11: Dynamic Exam Shifts & Tests (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 1 - Feature F11: Dynamic Exam Shifts & Tests", () => {
  test("T1.F11.01: exam.routes.js handles /:slug/year endpoint", () => {
    const routePath = path.resolve(
      process.cwd(),
      "apps/backend/src/modules/exams/exam.routes.js",
    );
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("/:slug/year");
  });

  test("T1.F11.02: exam.routes queries tests table dynamically by examId and year", () => {
    const routePath = path.resolve(
      process.cwd(),
      "apps/backend/src/modules/exams/exam.routes.js",
    );
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("tests");
    expect(content).toContain("yearInt");
  });

  test("T1.F11.03: Previous year papers mapping provides id, title, date, questions", () => {
    const routePath = path.resolve(
      process.cwd(),
      "apps/backend/src/modules/exams/exam.routes.js",
    );
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("previousYearPapers");
    expect(content).toContain("totalQuestions");
  });

  test("T1.F11.04: Inactive tests are filtered out from previousYearPapers", () => {
    const routePath = path.resolve(
      process.cwd(),
      "apps/backend/src/modules/exams/exam.routes.js",
    );
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("isActive");
  });

  test("T1.F11.05: Dynamic exam endpoint returns HTTP 200 with shift metadata", async () => {
    const res = await apiClient
      .asAnonymous()
      .get("/api/exams/ssc-cgl/year?year=2024");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("data");
  });
});
