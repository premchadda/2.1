/**
 * Runtime route-graph regression tests.
 *
 * WHY THIS EXISTS
 * ---------------
 * A static/AST route scan is NOT trustworthy in this repo: it misses
 * multi-line `router.get(\n  "/path",` registrations and therefore
 * under-reports duplicates. The audit that produced this file found 21
 * duplicate registrations using the LIVE Express router stacks, while the
 * static scan found only 16. These tests use runtime stacks, which is
 * ground truth.
 *
 * Express resolves the FIRST matching registration, so a duplicate means the
 * later handler is unreachable dead code that still reads like live code.
 * These tests fail the build if that regresses.
 */
import { jest, describe, it, expect, beforeAll } from "@jest/globals";

// Route modules import these four names from postgres-helpers. Stub them so the
// suite never opens a real connection (pg would otherwise connect at import
// time and crash after teardown). Route construction never calls them.
const poolStub = {
  query: jest.fn(),
  connect: jest.fn(() => ({ query: jest.fn(), release: jest.fn() })),
  end: jest.fn(),
};
const dbHelpersStub = new Proxy({}, { get: () => jest.fn() });

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: poolStub,
    dbHelpers: dbHelpersStub,
    withTransaction: jest.fn(),
    ensureTestSectionsSchema: jest.fn(),
    execSavepoint: jest.fn(),
  }),
);

const adminRoutes = (await import("../api/routes/admin.js")).default;
const { mountExtractedRoutes } =
  await import("../api/routes/public-routes-index.js");

/** Express 4 encodes mount prefixes as ^\/path\/?(?=\/|$) */
const decodeMount = (src) =>
  !src
    ? ""
    : src
        .replace(/^\^/, "")
        .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
        .replace(/\\\//g, "/")
        .replace(/^\/\?$/, "");

/** Expand a router stack into Map<"VERB /full/path", registrationCount>. */
const expand = (stack, prefix = "") => {
  const found = new Map();
  const bump = (k) => found.set(k, (found.get(k) || 0) + 1);
  for (const layer of stack) {
    if (layer.route) {
      const tail = layer.route.path === "/" ? "" : layer.route.path;
      for (const m of Object.keys(layer.route.methods)) {
        if (m === "_all") continue;
        bump(`${m.toUpperCase()} ${prefix + tail}`);
      }
    } else if (layer.name === "router" && layer.handle?.stack) {
      const src = layer.regexp?.source || "";
      const p = src === "^\\/?(?=\\/|$)" ? "" : decodeMount(src);
      for (const [k, n] of expand(layer.handle.stack, prefix + p)) {
        // ACCUMULATE, never overwrite: admin.js mounts ~24 sub-routers that all
        // use the "" prefix, so a key seen in two of them must sum to 2. Using
        // set() here silently hides cross-sub-router duplicates.
        found.set(k, (found.get(k) || 0) + n);
      }
    }
  }
  return found;
};

/** Keys registered more than once. */
const duplicatesOf = (graph) =>
  [...graph.entries()]
    .filter(([, n]) => n > 1)
    .map(([k, n]) => `${k} (x${n})`)
    .sort();

describe("admin route graph (/api/admin)", () => {
  let graph;
  beforeAll(() => {
    graph = expand(adminRoutes.stack, "/api/admin");
  });

  it("registers no route more than once", () => {
    // Express resolves the first match; every later copy is dead code.
    expect(duplicatesOf(graph)).toEqual([]);
  });

  it("exposes the curriculum taxonomy CRUD exactly once per verb", () => {
    const missing = [];
    for (const entity of [
      "subjects",
      "units",
      "chapters",
      "topics",
      "subtopics",
    ]) {
      const keys = [
        `GET /api/admin/${entity}`,
        `POST /api/admin/${entity}`,
        `PUT /api/admin/${entity}/:id`,
        `DELETE /api/admin/${entity}/:id`,
      ];
      for (const k of keys)
        if (graph.get(k) !== 1) missing.push(`${k} -> ${graph.get(k) || 0}`);
    }
    expect(missing).toEqual([]);
  });

  it("keeps banners / faqs / exam-categories single-owned", () => {
    const wrong = [];
    for (const entity of ["banners", "faqs"]) {
      for (const k of [
        `GET /api/admin/${entity}`,
        `POST /api/admin/${entity}`,
        `PUT /api/admin/${entity}/:id`,
        `DELETE /api/admin/${entity}/:id`,
      ]) {
        if (graph.get(k) !== 1) wrong.push(`${k} -> ${graph.get(k) || 0}`);
      }
    }
    for (const k of [
      "GET /api/admin/exam-categories",
      "POST /api/admin/exam-categories",
      "PUT /api/admin/exam-categories/:id",
      "DELETE /api/admin/exam-categories/:id",
      "GET /api/admin/exam-categories-list",
    ]) {
      if (graph.get(k) !== 1) wrong.push(`${k} -> ${graph.get(k) || 0}`);
    }
    expect(wrong).toEqual([]);
  });

  it("keeps the core admin surfaces mounted exactly once", () => {
    const missing = [];
    for (const k of [
      "GET /api/admin/users",
      "GET /api/admin/tests",
      "GET /api/admin/questions",
      "GET /api/admin/sections",
      "GET /api/admin/trash",
      "GET /api/admin/audit-logs",
      "GET /api/admin/payments",
      "GET /api/admin/live-tests",
      "GET /api/admin/stages",
      "GET /api/admin/test-categories",
    ]) {
      if (!graph.get(k)) missing.push(k);
    }
    expect(missing).toEqual([]);
  });

  it("runs the canonical guard chain as root-level middleware", () => {
    // These must sit on the root router (not a sub-path) so they apply to every
    // sub-router. Order is asserted in AGENTS.md; see api/routes/admin.js.
    const rootFns = adminRoutes.stack.filter(
      (l) => l.name !== "router" && typeof l.handle === "function",
    );
    expect(rootFns.length).toBeGreaterThanOrEqual(8);
  });
});

describe("public route index", () => {
  const captured = [];
  beforeAll(() => {
    // mountExtractedRoutes(app) only calls app.use(prefix, router).
    const fakeApp = { use: (prefix, _mw) => captured.push(prefix) };
    mountExtractedRoutes(fakeApp);
  });

  it("mounts every public prefix exactly once", () => {
    const dupes = captured.filter((p, i) => captured.indexOf(p) !== i);
    expect([...new Set(dupes)].sort()).toEqual([]);
  });

  it("never mounts an /api/admin prefix (single composition root)", () => {
    expect(captured.filter((p) => String(p).startsWith("/api/admin"))).toEqual(
      [],
    );
  });

  it("mounts the public surface the frontend depends on", () => {
    // NOTE: /api/pyps is mounted directly in app-port5001.js (pypHierarchyRoutes),
    // not here — public-routes-index owns /api/previous-year-papers.
    for (const p of [
      "/api/exams",
      "/api/videos",
      "/api/search",
      "/api/live-tests",
      "/api/previous-year-papers",
      "/api/settings",
      "/api/site-settings",
      "/api/public-stats",
      "/api/test-series",
      "/api/subscription-plans",
    ]) {
      expect(captured).toContain(p);
    }
  });
});

describe("newly wired endpoints", () => {
  it("exposes smart-revision stats exactly once", async () => {
    const r = (await import("../modules/revision/smartRevision.routes.js"))
      .default;
    const keys = r.stack
      .filter((l) => l.route)
      .flatMap((l) =>
        Object.keys(l.route.methods)
          .filter((m) => m !== "_all")
          .map((m) => m.toUpperCase() + " " + l.route.path),
      );
    expect(keys.filter((k) => k === "GET /stats").length).toBe(1);
  });

  it("guards the asset download redirect before the handler", async () => {
    const r = (await import("../api/routes/assets.js")).default;
    const keys = r.stack
      .filter((l) => l.route)
      .flatMap((l) =>
        Object.keys(l.route.methods)
          .filter((m) => m !== "_all")
          .map((m) => m.toUpperCase() + " " + l.route.path),
      );
    expect(keys).toContain("GET /:id/download");
    // A guard must run before any route handler (blocks the ID-enumeration oracle).
    expect(r.stack[0].name).not.toBe("router");
    expect(typeof r.stack[0].handle).toBe("function");
  });
});
