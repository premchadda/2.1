import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import express from "express";
import http from "http";

const mockPoolQuery = jest.fn();
const mockFind = jest.fn();
const mockFindById = jest.fn();
const mockInsertOne = jest.fn();
const mockUpdateById = jest.fn();
const mockSoftDelete = jest.fn();
const mockInvalidateCache = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
    dbHelpers: {
      find: (...args) => mockFind(...args),
      findById: (...args) => mockFindById(...args),
      insertOne: (...args) => mockInsertOne(...args),
      updateById: (...args) => mockUpdateById(...args),
      softDelete: (...args) => mockSoftDelete(...args),
      getTableName: () => "test_categories",
    },
  }),
);

jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  protect: (req, res, next) => {
    req.user = { id: 1, role: "admin" };
    next();
  },
  admin: (req, res, next) => next(),
}));

jest.unstable_mockModule("../middleware/responseCache.middleware.js", () => ({
  responseCache: () => (req, res, next) => next(),
  invalidateResponseCache: (...args) => mockInvalidateCache(...args),
}));

const { default: adminCategoriesRouter } =
  await import("../api/routes/admin-categories.js");
const { normalizeFields } = await import("../middleware/normalize-fields.js");

let server;

async function startServer() {
  const app = express();
  app.use(express.json());
  // Apply real admin router middleware
  app.use(normalizeFields({ methods: ["POST", "PUT", "PATCH"] }));
  app.use("/api/admin", adminCategoriesRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  return `http://127.0.0.1:${port}/api/admin`;
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
}

describe("Admin Categories Contract & Normalization Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockResolvedValue({ rows: [] });
    mockFind.mockResolvedValue([]);
    mockFindById.mockResolvedValue(null);
    mockInsertOne.mockImplementation((collection, data) =>
      Promise.resolve({ id: 99, ...data }),
    );
    mockUpdateById.mockImplementation((collection, id, data) =>
      Promise.resolve({ id, ...data }),
    );
    mockSoftDelete.mockResolvedValue(true);
    mockInvalidateCache.mockResolvedValue(true);
  });

  afterEach(async () => {
    await stopServer();
  });

  it("POST /test-categories preserves all camelCase fields through normalizeFields", async () => {
    const base = await startServer();

    // Mock parent category so level and parentId are verified
    mockFindById.mockResolvedValue({ id: 12, name: "Parent Mock", level: 1 });
    mockFind.mockResolvedValue([{ id: 12, name: "Parent Mock", level: 1 }]);

    const payload = {
      name: "SSC CGL Tier 1",
      slug: "ssc-cgl-tier-1",
      parentId: 12,
      stageIds: [4, 5],
      displayOrder: 7,
      isActive: false,
      examCategoryId: "3",
      testSeriesId: [10, 11],
    };

    const response = await fetch(`${base}/test-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.success).toBe(true);

    // Verify insertOne received all fields correctly
    expect(mockInsertOne).toHaveBeenCalledWith(
      "testCategories",
      expect.objectContaining({
        name: "SSC CGL Tier 1",
        slug: "ssc-cgl-tier-1",
        parentId: 12,
        level: 2, // (parent.level 1 + 1)
        examCategoryId: "3",
        stageIds: [4, 5],
        displayOrder: 7,
        isActive: false,
      }),
    );

    // Verify junction table insert
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO test_category_series"),
      expect.arrayContaining([99, 10, 11]),
    );

    // Verify cache invalidation
    expect(mockInvalidateCache).toHaveBeenCalledWith("admin-test-categories");
    expect(mockInvalidateCache).toHaveBeenCalledWith("test-categories");
    expect(mockInvalidateCache).toHaveBeenCalledWith("test-categories-tree");
  });

  it("POST /exam-categories populates category_id and auto-generates slug when omitted", async () => {
    const base = await startServer();

    const payload = {
      id: "railways",
      label: "Railway Recruitment Board",
      slug: "",
      displayOrder: 3,
      isActive: true,
    };

    const response = await fetch(`${base}/exam-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.success).toBe(true);

    expect(mockInsertOne).toHaveBeenCalledWith(
      "examCategories",
      expect.objectContaining({
        category_id: "railways",
        label: "Railway Recruitment Board",
        slug: "railways",
        display_order: 3,
        is_active: true,
      }),
    );

    expect(mockInvalidateCache).toHaveBeenCalledWith("exam-categories");
  });

  it("PUT /test-categories/:id prevents circular self-parenting and descendant parenting", async () => {
    const base = await startServer();

    // 1. Cannot set self as parent
    const selfParentRes = await fetch(`${base}/test-categories/5`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: 5 }),
    });
    expect(selfParentRes.status).toBe(400);

    // 2. Cannot set descendant as parent
    mockFind.mockResolvedValue([
      { id: 5, name: "Parent", parent_id: null },
      { id: 6, name: "Child", parent_id: 5 },
      { id: 7, name: "Grandchild", parent_id: 6 },
    ]);

    const descendantParentRes = await fetch(`${base}/test-categories/5`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: 7 }),
    });
    expect(descendantParentRes.status).toBe(400);
  });

  it("DELETE /test-categories/:id cleans junction table and cascades soft deletes", async () => {
    const base = await startServer();

    mockFind.mockResolvedValue([
      { id: 10, parent_id: null },
      { id: 11, parent_id: 10 },
      { id: 12, parent_id: 11 },
    ]);

    const response = await fetch(`${base}/test-categories/10`, {
      method: "DELETE",
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    // Verify junction rows for [10, 11, 12] were deleted
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining(
        "DELETE FROM test_category_series WHERE test_category_id = ANY($1)",
      ),
      [[10, 11, 12]],
    );

    // Verify soft delete called for all
    expect(mockSoftDelete).toHaveBeenCalledWith("testCategories", 11, 1);
    expect(mockSoftDelete).toHaveBeenCalledWith("testCategories", 12, 1);
    expect(mockSoftDelete).toHaveBeenCalledWith("testCategories", 10, 1);

    expect(mockInvalidateCache).toHaveBeenCalledWith("admin-test-categories");
  });

  it("GET /test-categories supports includeInactive=true", async () => {
    const base = await startServer();

    await fetch(`${base}/test-categories?includeInactive=true`);
    expect(mockFind).toHaveBeenCalledWith("testCategories", {
      includeInactive: true,
    });

    await fetch(`${base}/test-categories`);
    expect(mockFind).toHaveBeenCalledWith("testCategories", { isActive: true });
  });

  it("PUT /exam-categories/:id preserves business key category_id and invalidates cache", async () => {
    const base = await startServer();

    const payload = {
      id: 2,
      categoryId: "ssc",
      category_id: "ssc",
      label: "Staff Selection Commission (Updated)",
      slug: "ssc",
      displayOrder: 1,
      isActive: true,
    };

    const response = await fetch(`${base}/exam-categories/2`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(mockUpdateById).toHaveBeenCalledWith(
      "examCategories",
      "2",
      expect.objectContaining({
        category_id: "ssc",
        categoryId: "ssc",
        label: "Staff Selection Commission (Updated)",
        display_order: 1,
      }),
    );
    expect(mockInvalidateCache).toHaveBeenCalledWith("exam-categories");
  });
});
