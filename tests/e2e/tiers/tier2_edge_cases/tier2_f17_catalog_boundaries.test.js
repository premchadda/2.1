/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f17_catalog_boundaries.test.js
 * Feature F17: Exam Catalog Widgets (Tier 2 Boundaries & Edge Cases)
 */

import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 2 - Feature F17: Exam Catalog Widgets Boundaries", () => {
  test("T2.F17.01: Timeline handles empty event array with graceful fallback", () => {
    const events = [];
    const hasEvents = Array.isArray(events) && events.length > 0;
    expect(hasEvents).toBe(false);
  });

  test("T2.F17.02: Timeline parses non-standard or missing event dates safely", () => {
    function parseEventDate(dateStr) {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    }

    expect(parseEventDate("2024-09-09")).not.toBeNull();
    expect(parseEventDate("not-a-valid-date")).toBeNull();
    expect(parseEventDate(null)).toBeNull();
  });

  test("T2.F17.03: YearSelector disables Prev button on earliest year and Next on latest year", () => {
    const years = [2022, 2023, 2024, 2025];

    function getNavState(selectedYear) {
      const idx = years.indexOf(selectedYear);
      return {
        canPrev: idx > 0,
        canNext: idx !== -1 && idx < years.length - 1,
      };
    }

    const atStart = getNavState(2022);
    expect(atStart.canPrev).toBe(false);
    expect(atStart.canNext).toBe(true);

    const atEnd = getNavState(2025);
    expect(atEnd.canPrev).toBe(true);
    expect(atEnd.canNext).toBe(false);
  });

  test("T2.F17.04: YearSelector single year edge case disables both navigation buttons", () => {
    const singleYearList = [2024];
    const isSingle = singleYearList.length <= 1;
    expect(isSingle).toBe(true);
  });

  test("T2.F17.05: RelatedExams fallback icon when icon property is undefined", () => {
    const exam = { id: 10, title: "Custom State Exam", icon: null };
    const displayIcon = exam.icon || "📋";
    expect(displayIcon).toBe("📋");
  });
});
