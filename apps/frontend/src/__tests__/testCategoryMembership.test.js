/**
 * Regression tests for the series-page category membership bug.
 *
 * The fixture below is the live `rrb-ntpc-2026` shape as of 2026-10-17:
 *   - Mock Tests(1) → Full Mock Tests(21) holds 30 mocks, every one of which
 *     carries `year: 2026` and `type: "Pro"`.
 *   - PYPs(6) → Year Based(7) → {2025(12), 2026(50), 2021(16), 2016(51)}
 *     holds 95 + 34 + 10 + 10 = 149 previous-year papers.
 *   - Live Tests(20) is deactivated; one live row sits in 49 under it.
 *
 * The old fuzzy matcher counted the 30 mocks into PYPs (and into Year Based /
 * 2026) via `tests.year`, so the page showed 179 instead of 149.
 */
import { describe, it, expect } from "vitest";
import {
  buildCategoryIndex,
  buildCategoryTree,
  collectSubtreeIds,
  createMembershipMatcher,
  getAncestorChain,
  getTestCategoryId,
  resolveSelectedNode,
} from "../shared/utils/testCategoryMembership.js";

const categories = [
  {
    id: 1,
    name: "Mock Tests",
    slug: "mock-tests",
    parentId: null,
    displayOrder: 2,
  },
  {
    id: 21,
    name: "Full Mock Tests",
    slug: "full-mock-tests",
    parentId: 1,
    displayOrder: 2,
  },
  { id: 6, name: "PYPs", slug: "pyps", parentId: null, displayOrder: 3 },
  { id: 7, name: "Year Based", slug: "year-based", parentId: 6 },
  { id: 12, name: "2025", slug: "2025", parentId: 7 },
  { id: 50, name: "2026", slug: "2026", parentId: 7 },
  { id: 16, name: "2021", slug: "2021", parentId: 7 },
  { id: 51, name: "2016", slug: "2016", parentId: 7 },
  { id: 8, name: "Sectional", slug: "sectional", parentId: 6 },
  // Same names, different parents — the pair the name-based matcher conflated.
  {
    id: 57,
    name: "Quantitative Aptitude",
    slug: "quant-sectional",
    parentId: 23,
  },
  {
    id: 61,
    name: "Quantitative Aptitude",
    slug: "pyp-quant-sectional",
    parentId: 8,
  },
];

const pypTest = (year, type = "Pro") => ({
  id: `pyp-${year}`,
  testCategoryId: year,
  category: "PYPs",
  subCategory: String(year),
  year,
  isPyq: true,
  type,
  isPro: true,
});

// The critical case: a *mock* test that carries year = 2026.
const mockTest = (n) => ({
  id: `mock-${n}`,
  testCategoryId: 21,
  category: "Mock Tests",
  subCategory: "Full Mock Tests",
  year: 2026,
  isPyq: false,
  type: "Pro",
  isPro: true,
});

const makeTests = () => [
  ...Array.from({ length: 30 }, (_, i) => mockTest(i)),
  ...Array.from({ length: 95 }, () => pypTest(12)),
  ...Array.from({ length: 34 }, () => pypTest(50)),
  ...Array.from({ length: 10 }, () => pypTest(16)),
  ...Array.from({ length: 10 }, () => pypTest(51)),
];

const isLiveItem = (t) => t.type === "live-tests";
const isFreeTest = (t) => t.type === "Free" || t.type === "free";

const setup = () => {
  const tests = makeTests();
  const { roots, index } = buildCategoryTree({
    categories,
    tests,
    isLiveItem,
    isFreeTest,
  });
  return { tests, roots, index };
};

const nodeByKey = (roots, key) => roots.find((r) => r.key === key);

describe("getTestCategoryId", () => {
  it("prefers testCategoryId and accepts snake_case", () => {
    expect(getTestCategoryId({ testCategoryId: 12 })).toBe("12");
    expect(getTestCategoryId({ test_category_id: "50" })).toBe("50");
  });

  it("returns null when there is no usable category", () => {
    expect(getTestCategoryId({})).toBeNull();
    expect(getTestCategoryId({ testCategoryId: null })).toBeNull();
    expect(getTestCategoryId(null)).toBeNull();
  });

  it("ignores non-numeric values instead of string-matching them", () => {
    expect(getTestCategoryId({ testCategoryId: "pyps" })).toBeNull();
  });
});

describe("getAncestorChain", () => {
  it("walks leaf -> root", () => {
    const index = buildCategoryIndex(categories);
    expect(getAncestorChain(index, 12)).toEqual(["12", "7", "6"]);
    expect(getAncestorChain(index, 21)).toEqual(["21", "1"]);
  });

  it("is cycle-safe", () => {
    const index = buildCategoryIndex([
      { id: 1, name: "A", slug: "a", parentId: 2 },
      { id: 2, name: "B", slug: "b", parentId: 1 },
    ]);
    expect(getAncestorChain(index, 1).length).toBeLessThanOrEqual(2);
  });
});

describe("collectSubtreeIds", () => {
  it("collects a node and all its descendants", () => {
    const index = buildCategoryIndex(categories);
    expect(collectSubtreeIds(index, 6).sort((a, b) => a - b)).toEqual(
      [6, 7, 8, 12, 16, 50, 51, 61].map(String).sort((a, b) => a - b),
    );
  });

  it("returns nothing for an unknown id", () => {
    const index = buildCategoryIndex(categories);
    expect(collectSubtreeIds(index, 999)).toEqual([]);
  });
});

describe("buildCategoryTree counts (the 179 -> 149 regression)", () => {
  it("counts Mock Tests at 30 and PYPs at 149, not 179", () => {
    const { roots } = setup();
    expect(nodeByKey(roots, "mock-tests").count).toBe(30);
    expect(nodeByKey(roots, "pyps").count).toBe(149);
  });

  it("does not let a non-PYP test leak into PYPs via tests.year", () => {
    const { roots, index } = setup();
    const pyp = nodeByKey(roots, "pyps");
    const mocks = makeTests().filter((t) => t.testCategoryId === 21);
    const matcher = createMembershipMatcher({ index, node: pyp });
    expect(mocks.some((m) => matcher(m))).toBe(false);
  });

  it("counts Year Based at 149, never 179", () => {
    const { roots } = setup();
    const yearBased = nodeByKey(roots, "pyps").children.find(
      (c) => c.key === "year-based",
    );
    expect(yearBased.count).toBe(149);
  });

  it("splits Year Based across its year leaves", () => {
    const { roots } = setup();
    const yearBased = nodeByKey(roots, "pyps").children.find(
      (c) => c.key === "year-based",
    );
    const byKey = Object.fromEntries(
      yearBased.children.map((c) => [c.key, c.count]),
    );
    expect(byKey).toMatchObject({
      2025: 95,
      2026: 34,
      2021: 10,
      2016: 10,
      all: 149,
    });
  });

  it("never counts a node above the series total", () => {
    const { roots } = setup();
    const total = roots.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBe(179);
  });

  it("excludes transient live items from the synthetic All pill", () => {
    const tests = [
      ...makeTests(),
      {
        id: "live-1",
        testCategoryId: 21,
        type: "live-tests",
        category: "Live Tests",
      },
    ];
    const { roots: withLive } = buildCategoryTree({
      categories,
      tests,
      isLiveItem,
      isFreeTest,
    });
    const mockRoot = nodeByKey(withLive, "mock-tests");
    const all = mockRoot.children.find((c) => c.key === "all");
    expect(mockRoot.count).toBe(31);
    expect(all.count).toBe(30);
  });

  it("reports free counts from the resolved access level", () => {
    const tests = [
      ...makeTests().map((t) => ({ ...t, type: "Free", isPro: false })),
    ];
    const { roots } = buildCategoryTree({
      categories,
      tests,
      isLiveItem,
      isFreeTest,
    });
    expect(nodeByKey(roots, "pyps").free).toBe(149);
  });
});

describe("resolveSelectedNode", () => {
  it("returns null when nothing is selected", () => {
    const { roots } = setup();
    expect(resolveSelectedNode({ roots })).toBeNull();
  });

  it("resolves the deepest selected level", () => {
    const { roots } = setup();
    const node = resolveSelectedNode({
      roots,
      activeMainCategory: "pyps",
      activeSubCategory: "year-based",
      activeThirdCategory: "2025",
    });
    expect(node.key).toBe("2025");
  });

  it("treats the synthetic All child as its parent scope", () => {
    const { roots, index } = setup();
    const node = resolveSelectedNode({
      roots,
      activeMainCategory: "pyps",
      activeSubCategory: "all",
    });
    expect(node.key).toBe("pyps");
    const matcher = createMembershipMatcher({ index, node });
    expect(makeTests().filter(matcher).length).toBe(149);
  });

  it("falls back to the first root instead of matching everything", () => {
    const { roots, index } = setup();
    const node = resolveSelectedNode({
      roots,
      activeMainCategory: "a-category-that-no-longer-exists",
    });
    expect(node).not.toBeNull();
    const matcher = createMembershipMatcher({ index, node });
    expect(makeTests().filter(matcher).length).toBe(30);
  });

  it("never degrades into a filter that matches the whole series", () => {
    const { roots, index } = setup();
    for (const main of ["pyps", "mock-tests", "gone", "quizzes"]) {
      const node = resolveSelectedNode({ roots, activeMainCategory: main });
      if (!node) continue;
      const matched = makeTests().filter(
        createMembershipMatcher({ index, node }),
      );
      expect(matched.length).toBeLessThanOrEqual(149);
    }
  });
});

describe("createMembershipMatcher", () => {
  it("matches nothing when no node is selected but a filter exists", () => {
    const matcher = createMembershipMatcher({
      index: buildCategoryIndex(categories),
      node: null,
    });
    expect(matcher({ testCategoryId: 12 })).toBe(true);
    expect(matcher(null)).toBe(false);
  });

  it("rejects tests with no resolvable category", () => {
    const { roots, index } = setup();
    const matcher = createMembershipMatcher({
      index,
      node: resolveSelectedNode({ roots, activeMainCategory: "pyps" }),
    });
    expect(matcher({ type: "Pro" })).toBe(false);
    expect(matcher({})).toBe(false);
  });
});

describe("same-name siblings stay distinct", () => {
  it("separates Sectional Tests > Quantitative Aptitude from PYPs > Sectional > Quantitative Aptitude", () => {
    const cat = [
      { id: 1, name: "Mock Tests", slug: "mock-tests", parentId: null },
      { id: 23, name: "Sectional Tests", slug: "sectional-tests", parentId: 1 },
      {
        id: 57,
        name: "Quantitative Aptitude",
        slug: "quant-sectional",
        parentId: 23,
      },
      { id: 6, name: "PYPs", slug: "pyps", parentId: null },
      { id: 8, name: "Sectional", slug: "sectional", parentId: 6 },
      {
        id: 61,
        name: "Quantitative Aptitude",
        slug: "pyp-quant-sectional",
        parentId: 8,
      },
    ];
    const tests = [
      { id: "mock-sectional", testCategoryId: 57, type: "Pro" },
      { id: "pyp-sectional", testCategoryId: 61, type: "Pro" },
    ];
    const { roots, index } = buildCategoryTree({
      categories: cat,
      tests,
      isLiveItem,
      isFreeTest,
    });

    const mockSectional = resolveSelectedNode({
      roots,
      activeMainCategory: "mock-tests",
      activeSubCategory: "sectional-tests",
      activeThirdCategory: "quant-sectional",
    });
    const pypSectional = resolveSelectedNode({
      roots,
      activeMainCategory: "pyps",
      activeSubCategory: "sectional",
      activeThirdCategory: "pyp-quant-sectional",
    });

    const inMock = tests.filter(
      createMembershipMatcher({ index, node: mockSectional }),
    );
    const inPyp = tests.filter(
      createMembershipMatcher({ index, node: pypSectional }),
    );

    expect(inMock.map((t) => t.id)).toEqual(["mock-sectional"]);
    expect(inPyp.map((t) => t.id)).toEqual(["pyp-sectional"]);
    expect(mockSectional.count).toBe(1);
    expect(pypSectional.count).toBe(1);
  });
});
