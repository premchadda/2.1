/**
 * tests/e2e/tiers/tier1_contracts/tier1_f25_admin_blog_manager.test.js
 * Feature F25: Admin BlogManager Route & Activation (Tier 1 Contract & Sanity)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 1 - Feature F25: Admin BlogManager Route & Activation", () => {
  test("T1.F25.01: Backend blog route file existence and CRUD endpoints", () => {
    const routePath = path.resolve(process.cwd(), "apps/backend/src/api/routes/blog.js");
    expect(fs.existsSync(routePath)).toBe(true);

    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("router.get");
    expect(content).toContain("router.post");
    expect(content).toContain("router.put");
    expect(content).toContain("router.delete");
  });

  test("T1.F25.02: Admin panel App.jsx imports BlogManager and mounts on /blogs", () => {
    const appPath = path.resolve(process.cwd(), "apps/admin-panel/src/App.jsx");
    expect(fs.existsSync(appPath)).toBe(true);

    const content = fs.readFileSync(appPath, "utf-8");
    expect(content).toContain("BlogManager");
    expect(content).toContain('path="blogs"');
  });

  test("T1.F25.03: Backend blog route supports draft and published post statuses", () => {
    const routePath = path.resolve(process.cwd(), "apps/backend/src/api/routes/blog.js");
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("status");
  });

  test("T1.F25.04: Backend blog route handles slugs and category categorization", () => {
    const routePath = path.resolve(process.cwd(), "apps/backend/src/api/routes/blog.js");
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("slug");
    expect(content).toContain("category");
  });

  test("T1.F25.05: Admin blog mutation endpoints require admin authentication", async () => {
    const res = await apiClient.asAnonymous().post("/api/blogs", {
      title: "Test Blog Post",
      slug: "test-blog-post",
      content: "Sample content here",
    });

    expect([401, 403]).toContain(res.status);
  });
});
