import { describe, it, expect } from "vitest";
import {
  getCategoryLabel,
  getCategoryPath,
  getCategoryPathLabel,
  resolveTestCategoryTabId,
  getCategoryKind,
  getCategoryPrefixTag,
} from "../categoryHelpers.js";

describe("categoryHelpers", () => {
  describe("getCategoryLabel", () => {
    it("returns label when present", () => {
      expect(getCategoryLabel({ label: "SSC CGL" })).toBe("SSC CGL");
    });

    it("returns name when label is absent", () => {
      expect(getCategoryLabel({ name: "Banking" })).toBe("Banking");
    });

    it("returns slug when name and label are absent", () => {
      expect(getCategoryLabel({ slug: "railway-exams" })).toBe("railway-exams");
    });

    it("returns categoryId or id if no text name exists", () => {
      expect(getCategoryLabel({ categoryId: 42 })).toBe(42);
      expect(getCategoryLabel({ id: 99 })).toBe(99);
    });

    it("returns 'Not linked' when category is null or undefined", () => {
      expect(getCategoryLabel(null)).toBe("Not linked");
      expect(getCategoryLabel(undefined)).toBe("Not linked");
      expect(getCategoryLabel({})).toBe("Not linked");
    });
  });

  describe("getCategoryPath & getCategoryPathLabel", () => {
    const flatCats = [
      { id: "1", name: "Government" },
      { id: "2", name: "SSC", parentId: "1" },
      { id: "3", name: "SSC CGL", parentId: "2" },
    ];

    it("constructs full ancestor path", () => {
      const path = getCategoryPath("3", flatCats);
      expect(path.map((c) => c.name)).toEqual(["Government", "SSC", "SSC CGL"]);
    });

    it("formats ancestor path into slash-separated string", () => {
      expect(getCategoryPathLabel("3", flatCats)).toBe(
        "Government / SSC / SSC CGL",
      );
    });

    it("returns 'Not linked' for non-existent category", () => {
      expect(getCategoryPathLabel("999", flatCats)).toBe("Not linked");
    });
  });

  describe("resolveTestCategoryTabId", () => {
    // Mirrors the live test_categories roots + a PYP sectional leaf.
    const flatCats = [
      { id: "1", name: "Mock Tests", slug: "mock-tests", parent_id: null },
      {
        id: "23",
        name: "Sectional Tests",
        slug: "sectional-tests",
        parent_id: "1",
      },
      { id: "6", name: "PYPs", slug: "pyps", parent_id: null },
      {
        id: "8",
        name: "Sectional",
        slug: "sectional",
        parent_id: "6",
      },
      {
        id: "63",
        name: "English Language",
        slug: "pyp-english-sectional",
        parent_id: "8",
      },
      { id: "20", name: "Live Tests", slug: "live-tests", parent_id: null },
    ];

    it("honours an explicit group id stored in type", () => {
      expect(resolveTestCategoryTabId({ type: "mock-tests" }, flatCats)).toBe(
        "mock-tests",
      );
      expect(resolveTestCategoryTabId({ type: "pyp" }, flatCats)).toBe("pyp");
      expect(resolveTestCategoryTabId({ type: "live-tests" }, flatCats)).toBe(
        "live-tests",
      );
    });

    it("ignores a legacy access-tier value in type and uses the linked root", () => {
      expect(
        resolveTestCategoryTabId({ type: "Pro", categoryId: "63" }, flatCats),
      ).toBe("pyp");
      expect(
        resolveTestCategoryTabId({ type: "Pro", categoryId: "23" }, flatCats),
      ).toBe("mock-tests");
    });

    it("lets isLive win over type and category", () => {
      expect(
        resolveTestCategoryTabId(
          { type: "Pro", isLive: true, categoryId: "23" },
          flatCats,
        ),
      ).toBe("live-tests");
    });

    it("returns null when nothing resolves instead of guessing", () => {
      expect(resolveTestCategoryTabId({ type: "Pro" }, flatCats)).toBeNull();
      expect(resolveTestCategoryTabId(undefined, flatCats)).toBeNull();
      expect(resolveTestCategoryTabId({ categoryId: "" }, flatCats)).toBeNull();
    });
  });

  describe("getCategoryKind & getCategoryPrefixTag", () => {
    it("identifies root category as top with [T] prefix", () => {
      const topCat = { id: "1", name: "Mock Tests", parentId: null, level: 0 };
      expect(getCategoryKind(topCat)).toBe("top");
      expect(getCategoryPrefixTag(topCat)).toBe("[T]");
      expect(getCategoryPrefixTag(topCat, 0)).toBe("[T]");
    });

    it("identifies child category as sub with [S] prefix", () => {
      const subCat = {
        id: "2",
        name: "Sectional",
        parentId: "1",
        level: 1,
      };
      expect(getCategoryKind(subCat)).toBe("sub");
      expect(getCategoryPrefixTag(subCat)).toBe("[S]");
      expect(getCategoryPrefixTag(subCat, 1)).toBe("[S]");
    });

    it("formats nested subcategories with depth-specific tag", () => {
      const deepSub = {
        id: "3",
        name: "English",
        parentId: "2",
        level: 2,
      };
      expect(getCategoryKind(deepSub)).toBe("sub");
      expect(getCategoryPrefixTag(deepSub, 2)).toBe("[S2]");
      expect(getCategoryPrefixTag(deepSub, 3)).toBe("[S3]");
    });
  });
});
