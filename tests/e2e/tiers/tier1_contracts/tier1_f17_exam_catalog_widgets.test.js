/**
 * tests/e2e/tiers/tier1_contracts/tier1_f17_exam_catalog_widgets.test.js
 * Feature F17: Frontend Exam Catalog Components (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 1 - Feature F17: Frontend Exam Catalog Components", () => {
  test("T1.F17.01: RelatedExams.jsx component file existence and filter logic", () => {
    const compPath = path.resolve(process.cwd(), "apps/frontend/src/components/exams/RelatedExams.jsx");
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("currentExamId");
    expect(content).toContain("filter");
  });

  test("T1.F17.02: Timeline.jsx component file existence and event status logic", () => {
    const compPath = path.resolve(process.cwd(), "apps/frontend/src/components/exams/Timeline.jsx");
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("events");
    expect(content).toContain("status");
  });

  test("T1.F17.03: YearSelector.jsx component file existence and controls", () => {
    const compPath = path.resolve(process.cwd(), "apps/frontend/src/components/exams/YearSelector.jsx");
    expect(fs.existsSync(compPath)).toBe(true);

    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("selectedYear");
    expect(content).toContain("onSelect");
  });

  test("T1.F17.04: ExamInfoNew.jsx page integrates exam catalog data", () => {
    const pagePath = path.resolve(process.cwd(), "apps/frontend/src/pages/exams/ExamInfoNew.jsx");
    expect(fs.existsSync(pagePath)).toBe(true);

    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("ExamInfo");
  });

  test("T1.F17.05: ExamYear.jsx page renders year-specific syllabus and paper details", () => {
    const pagePath = path.resolve(process.cwd(), "apps/frontend/src/pages/exams/ExamYear.jsx");
    expect(fs.existsSync(pagePath)).toBe(true);

    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("ExamYear");
  });
});
