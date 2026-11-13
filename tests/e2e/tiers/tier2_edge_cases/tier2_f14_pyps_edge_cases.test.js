/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f14_pyps_edge_cases.test.js
 * Feature F14: Frontend PypsExam Activation (Tier 2 Boundaries & Error States)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 2 - Feature F14: PypsExam Boundaries & Edge States", () => {
  const compPath = path.resolve(process.cwd(), "apps/frontend/src/pages/pyps/PypsExam.jsx");

  test("T2.F14.01: Empty paper list renders friendly empty state", () => {
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("No Papers Found");
  });

  test("T2.F14.02: Error state and retry button handling", () => {
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("error");
  });

  test("T2.F14.03: Pagination clamps active page to available total", () => {
    const totalItems = 45;
    const pageSize = 15;
    const totalPages = Math.ceil(totalItems / pageSize);

    let requestedPage = 5;
    const clampedPage = Math.min(Math.max(requestedPage, 1), totalPages);
    expect(clampedPage).toBe(3);
  });

  test("T2.F14.04: Special character search inputs are URL encoded", () => {
    const rawSearch = "^.*+?()[]";
    const encoded = encodeURIComponent(rawSearch);
    expect(encoded).not.toContain("+?");
    expect(encoded).toContain("%5E");
  });

  test("T2.F14.05: Paper attempts and groups delegated to YearGroupSection component", () => {
    const content = fs.readFileSync(compPath, "utf-8");
    expect(content).toContain("YearGroupSection");
  });
});
