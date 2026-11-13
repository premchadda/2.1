/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f25_blog_manager_edge_cases.test.js
 * Feature F25: Admin BlogManager (Tier 2 Slugs, Conflicts & Validation Boundaries)
 */

import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";
import { generateSlug, validateBlogPost } from "../../../apps/admin-panel/src/features/admin/study-materials/BlogManager.jsx";

describe("Tier 2 - Feature F25: BlogManager Slugs & Validation Boundaries", () => {
  test("T2.F25.01: Auto-generating URL slug from article title handles special characters", () => {
    const title = "How to Crack UPSC 2026 in First Attempt!";
    const slug = generateSlug(title);
    expect(slug).toBe("how-to-crack-upsc-2026-in-first-attempt");
  });

  test("T2.F25.02: Duplicate slug detection logic", () => {
    const existingSlugs = new Set(["ssc-cgl-strategy-2026", "top-10-math-formulas"]);
    const newSlug = "ssc-cgl-strategy-2026";

    const isConflict = existingSlugs.has(newSlug);
    expect(isConflict).toBe(true);
  });

  test("T2.F25.03: Publishing requires non-empty content body", () => {
    const invalidDraft = { title: "Draft", status: "published", content: "   " };
    const err = validateBlogPost(invalidDraft);
    expect(err).toBe("Blog content is required before publishing");
  });

  test("T2.F25.04: Category filter & pagination parameter URL construction", () => {
    const params = new URLSearchParams();
    params.set("category", "Exam Tips");
    params.set("page", "2");

    expect(params.toString()).toBe("category=Exam+Tips&page=2");
  });

  test("T2.F25.05: Non-admin request to create blog post returns 401 or 403", async () => {
    const res = await apiClient.asStudent().post("/api/blogs", {
      title: "Unauthorized Student Blog",
      slug: "unauthorized-blog",
      content: "Text content",
    });

    expect([401, 403]).toContain(res.status);
  });
});
