import { describe, it, expect } from "vitest";
import {
  getCategoryLabel,
  getCategoryPath,
  getCategoryPathLabel,
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
});
