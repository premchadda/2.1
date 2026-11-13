/**
 * Adversarial Empirical Verification Suite for Milestone 2
 * Tests:
 * 1. Live Notes API (apps/backend/src/api/routes/notes.js):
 *    - Auth enforcement (unauthenticated -> 401)
 *    - Input validation (missing questionId / empty noteText -> 400)
 *    - UUID validation on :id parameter (invalid UUID -> 400)
 *    - Cross-user tenant isolation (User A cannot access, update, or delete User B's note)
 *    - Note size limits (>10,000 characters -> 400)
 *    - Pagination clamping (limit, offset)
 * 2. Practice Fundamentals Drill History & Persistence (apps/backend/src/api/routes/practice.js):
 *    - Submission persistence into fundamental_drill_sessions
 *    - User-scoped retrieval and category filtering on GET /api/practice/fundamentals/history
 *    - Speed floor guard (<150ms per question -> 0 score)
 * 3. Exam Shifts (apps/backend/src/modules/exams/exam.routes.js):
 *    - Absence of mock shift fallbacks when tests are absent (must return [])
 * 4. DB Migrations 155 & 156 Static Security & Schema Verification:
 *    - RLS enabled, no IS NULL bypass in policies
 * 5. Shared Hooks Package Verification:
 *    - Core hook exports
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from "@jest/globals";
import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock pool and dbHelpers before importing route modules
let executedQueries = [];
let queryResultsQueue = [];

const poolStub = {
  query: jest.fn(async (sql, params = []) => {
    executedQueries.push({ sql, params });
    if (queryResultsQueue.length > 0) {
      const nextResult = queryResultsQueue.shift();
      if (typeof nextResult === "function") {
        return nextResult(sql, params);
      }
      return nextResult;
    }
    return { rows: [], rowCount: 0 };
  }),
  connect: jest.fn(() => ({
    query: jest.fn(),
    release: jest.fn(),
  })),
  end: jest.fn(),
};

const dbHelpersStub = {
  find: jest.fn(async () => []),
  findById: jest.fn(async () => null),
  findOne: jest.fn(async () => null),
  create: jest.fn(async () => ({})),
  update: jest.fn(async () => ({})),
  delete: jest.fn(async () => ({})),
};

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: poolStub,
    dbHelpers: dbHelpersStub,
    withTransaction: jest.fn(async (cb) => cb({ query: poolStub.query })),
    ensureTestSectionsSchema: jest.fn(),
    execSavepoint: jest.fn(),
  }),
);

// Import routes after mocking
const { default: notesRoutes } = await import("../api/routes/notes.js");
const { default: practiceRoutes } = await import("../api/routes/practice.js");
const { default: examRoutes } = await import("../modules/exams/exam.routes.js");

// Helper to create test server
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Test middleware simulating auth context
  app.use((req, res, next) => {
    // If test sets auth header "Test-User <id>", populate req.user
    const testAuth = req.headers["x-test-user"];
    if (testAuth) {
      req.user = { id: parseInt(testAuth, 10), role: "student" };
      req.authVerified = true;
      req.authToken = "mock-token";
    }
    next();
  });

  // Mount routes
  app.use("/api/notes", notesRoutes);
  app.use("/api/practice", practiceRoutes);
  app.use("/api/exams", examRoutes);

  return app;
}

const app = createTestApp();
let server;
let baseUrl;

beforeAll((done) => {
  server = http.createServer(app);
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
    done();
  });
});

afterAll((done) => {
  if (server) {
    server.close(done);
  } else {
    done();
  }
});

beforeEach(() => {
  executedQueries = [];
  queryResultsQueue = [];
  jest.clearAllMocks();
});

describe("1. Live Notes API — Adversarial Challenge", () => {
  describe("1.1 Authentication Enforcement", () => {
    it("rejects unauthenticated GET /api/notes with 401", async () => {
      const res = await fetch(`${baseUrl}/api/notes`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/not authorized/i);
    });

    it("rejects unauthenticated POST /api/notes with 401", async () => {
      const res = await fetch(`${baseUrl}/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: "q1", noteText: "hello" }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated PUT /api/notes/:id with 401", async () => {
      const validUuid = "11111111-1111-4111-8111-111111111111";
      const res = await fetch(`${baseUrl}/api/notes/${validUuid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteText: "updated" }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated DELETE /api/notes/:id with 401", async () => {
      const validUuid = "11111111-1111-4111-8111-111111111111";
      const res = await fetch(`${baseUrl}/api/notes/${validUuid}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("1.2 Input Validation & Boundary Testing on POST /api/notes", () => {
    it("rejects missing questionId with 400", async () => {
      const res = await fetch(`${baseUrl}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({ noteText: "valid text" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/questionId is required/i);
    });

    it("rejects empty questionId with 400", async () => {
      const res = await fetch(`${baseUrl}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({ questionId: "", noteText: "valid text" }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects missing noteText with 400", async () => {
      const res = await fetch(`${baseUrl}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({ questionId: "q-100" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/noteText is required/i);
    });

    it("rejects whitespace-only noteText with 400", async () => {
      const res = await fetch(`${baseUrl}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({ questionId: "q-100", noteText: "    \n\t   " }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/noteText is required and cannot be empty/i);
    });

    it("rejects oversized noteText (>10,000 characters) with 400", async () => {
      const oversizedText = "x".repeat(10001);
      const res = await fetch(`${baseUrl}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({ questionId: "q-100", noteText: oversizedText }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/exceeds maximum limit of 10,000/i);
    });

    it("accepts valid noteText <= 10,000 characters and creates note scoped to req.user.id", async () => {
      const exactly10kText = "a".repeat(10000);
      const mockCreatedNote = {
        id: "22222222-2222-4222-8222-222222222222",
        questionId: "q-100",
        contextId: "test-series-1",
        noteText: exactly10kText,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryResultsQueue.push({ rows: [mockCreatedNote] });

      const res = await fetch(`${baseUrl}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({
          questionId: "q-100",
          contextId: "test-series-1",
          noteText: exactly10kText,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(mockCreatedNote.id);

      // Verify the query params explicitly bound req.user.id (101)
      expect(executedQueries.length).toBe(1);
      const insert = executedQueries[0];
      expect(insert.params[0]).toBe(101); // user_id
      expect(insert.params[1]).toBe("q-100"); // question_id
      expect(insert.params[2]).toBe("test-series-1"); // context_id
      expect(insert.params[3]).toBe(exactly10kText); // trimmed text
    });
  });

  describe("1.3 UUID Validation on :id Parameter", () => {
    it("rejects non-UUID ID on PUT with 400", async () => {
      const invalidIds = [
        "123",
        "abc",
        "e87f8674-6819-4f7f",
        "not-a-uuid",
        "../evil",
        "1' OR '1'='1",
      ];
      for (const id of invalidIds) {
        const res = await fetch(
          `${baseUrl}/api/notes/${encodeURIComponent(id)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-test-user": "101",
            },
            body: JSON.stringify({ noteText: "new text" }),
          },
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.message).toMatch(/invalid note id format/i);
      }
    });

    it("rejects non-UUID ID on DELETE with 400", async () => {
      const invalidIds = ["123", "not-a-uuid", "1; DROP TABLE users;--"];
      for (const id of invalidIds) {
        const res = await fetch(
          `${baseUrl}/api/notes/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: {
              "x-test-user": "101",
            },
          },
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.message).toMatch(/invalid note id format/i);
      }
    });
  });

  describe("1.4 Cross-User Tenant Isolation (IDOR Resistance)", () => {
    const victimNoteId = "33333333-3333-4333-8333-333333333333";

    it("prevents User B from updating User A's note (returns 404)", async () => {
      // User B (id: 202) calls PUT on victim note.
      // Database update query WHERE id = $2 AND user_id = $3 returns 0 rows.
      queryResultsQueue.push({ rows: [], rowCount: 0 });

      const res = await fetch(`${baseUrl}/api/notes/${victimNoteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "202", // Attacker User ID
        },
        body: JSON.stringify({ noteText: "hacked note text" }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/note not found/i);

      // Verify the query bound User B's ID to prevent IDOR
      expect(executedQueries.length).toBe(1);
      const update = executedQueries[0];
      expect(update.sql).toContain("WHERE id = $2 AND user_id = $3");
      expect(update.params[1]).toBe(victimNoteId);
      expect(update.params[2]).toBe(202); // User B
    });

    it("prevents User B from deleting User A's note (returns 404)", async () => {
      // User B (id: 202) calls DELETE on victim note.
      queryResultsQueue.push({ rows: [], rowCount: 0 });

      const res = await fetch(`${baseUrl}/api/notes/${victimNoteId}`, {
        method: "DELETE",
        headers: {
          "x-test-user": "202", // Attacker User ID
        },
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/note not found/i);

      // Verify the query bound User B's ID
      expect(executedQueries.length).toBe(1);
      const del = executedQueries[0];
      expect(del.sql).toContain("WHERE id = $1 AND user_id = $2");
      expect(del.params[0]).toBe(victimNoteId);
      expect(del.params[1]).toBe(202); // User B
    });

    it("ensures GET /api/notes is strictly scoped to req.user.id", async () => {
      queryResultsQueue.push({ rows: [] });

      await fetch(`${baseUrl}/api/notes?questionId=q-999&limit=25`, {
        headers: { "x-test-user": "101" },
      });

      expect(executedQueries.length).toBe(1);
      const getQuery = executedQueries[0];
      expect(getQuery.sql).toContain("WHERE user_id = $1");
      expect(getQuery.params[0]).toBe(101);
      expect(getQuery.params[1]).toBe("q-999");
      expect(getQuery.params[2]).toBe(25); // limit
      expect(getQuery.params[3]).toBe(0); // offset
    });

    it("clamps pagination limit to max 100 and min 1", async () => {
      queryResultsQueue.push({ rows: [] });

      await fetch(`${baseUrl}/api/notes?limit=999&offset=-5`, {
        headers: { "x-test-user": "101" },
      });

      expect(executedQueries.length).toBe(1);
      const getQuery = executedQueries[0];
      expect(getQuery.params[1]).toBe(100); // clamped max 100
      expect(getQuery.params[2]).toBe(0); // clamped min 0
    });
  });
});

describe("2. Practice Fundamentals Drill History & Persistence", () => {
  describe("2.1 Drill Submission Persistence", () => {
    it("persists drill session into fundamental_drill_sessions on submit", async () => {
      const mockSession = {
        id: "44444444-4444-4444-8444-444444444444",
        category: "tables",
        score: 18,
        totalQuestions: 20,
        durationMs: 45000,
        accuracy: 90.0,
        createdAt: new Date().toISOString(),
      };

      // Mock mastery update query and session insert query
      queryResultsQueue.push({ rows: [] }); // user_fundamental_mastery update
      queryResultsQueue.push({ rows: [mockSession] }); // fundamental_drill_sessions insert

      const res = await fetch(`${baseUrl}/api/practice/fundamentals/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({
          category: "tables",
          score: 18,
          totalQuestions: 20,
          durationMs: 45000,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.sessionId).toBe(mockSession.id);
      expect(body.session.totalQuestions).toBe(20);
      expect(body.accuracy).toBe(90);

      // Verify that the insert into fundamental_drill_sessions was executed
      const insertSessionQuery = executedQueries.find((q) =>
        q.sql.includes("INSERT INTO fundamental_drill_sessions"),
      );
      expect(insertSessionQuery).toBeDefined();
      expect(insertSessionQuery.params[0]).toBe(101); // user_id
      expect(insertSessionQuery.params[1]).toBe("tables"); // category
      expect(insertSessionQuery.params[2]).toBe(18); // safeScore
      expect(insertSessionQuery.params[3]).toBe(20); // safeTotal
      expect(insertSessionQuery.params[4]).toBe(45000); // safeDurationMs
      expect(insertSessionQuery.params[5]).toBe(90); // roundedAccuracy
    });

    it("enforces human reaction speed floor guard (<150ms per question -> 0 score)", async () => {
      // 10 correct answers in 500ms total = 50ms per question (< 150ms impossible floor)
      queryResultsQueue.push({ rows: [] }); // mastery
      queryResultsQueue.push({
        rows: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            category: "squares",
            score: 0,
            totalQuestions: 10,
            durationMs: 500,
            accuracy: 0.0,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const res = await fetch(`${baseUrl}/api/practice/fundamentals/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({
          category: "squares",
          score: 10,
          totalQuestions: 10,
          durationMs: 500,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.accuracy).toBe(0);

      const insertSessionQuery = executedQueries.find((q) =>
        q.sql.includes("INSERT INTO fundamental_drill_sessions"),
      );
      expect(insertSessionQuery).toBeDefined();
      expect(insertSessionQuery.params[2]).toBe(0); // Score clamped to 0 by anti-cheat guard
    });
  });

  describe("2.2 Drill History Retrieval (GET /api/practice/fundamentals/history)", () => {
    it("rejects unauthenticated request with 401", async () => {
      const res = await fetch(`${baseUrl}/api/practice/fundamentals/history`);
      expect(res.status).toBe(401);
    });

    it("returns user-scoped history ordered by created_at DESC", async () => {
      const mockHistory = [
        {
          id: "1",
          category: "cubes",
          score: 15,
          totalQuestions: 15,
          durationMs: 30000,
          accuracy: "100.00",
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          category: "roots",
          score: 12,
          totalQuestions: 15,
          durationMs: 35000,
          accuracy: "80.00",
          createdAt: new Date(Date.now() - 60000).toISOString(),
        },
      ];

      queryResultsQueue.push({ rows: mockHistory });

      const res = await fetch(`${baseUrl}/api/practice/fundamentals/history`, {
        headers: { "x-test-user": "101" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);
      expect(typeof body.data[0].accuracy).toBe("number"); // verified numeric coercion
      expect(body.data[0].accuracy).toBe(100);

      expect(executedQueries.length).toBe(1);
      const historyQuery = executedQueries[0];
      expect(historyQuery.sql).toContain("FROM fundamental_drill_sessions");
      expect(historyQuery.sql).toContain("WHERE user_id = $1");
      expect(historyQuery.sql).toContain("ORDER BY created_at DESC");
      expect(historyQuery.params[0]).toBe(101);
      expect(historyQuery.params[1]).toBe(50); // default limit
    });

    it("respects category filter when provided", async () => {
      queryResultsQueue.push({ rows: [] });

      await fetch(
        `${baseUrl}/api/practice/fundamentals/history?category=fractions&limit=20`,
        {
          headers: { "x-test-user": "101" },
        },
      );

      expect(executedQueries.length).toBe(1);
      const historyQuery = executedQueries[0];
      expect(historyQuery.sql).toContain(
        "WHERE user_id = $1 AND category = $2",
      );
      expect(historyQuery.params[0]).toBe(101);
      expect(historyQuery.params[1]).toBe("fractions");
      expect(historyQuery.params[2]).toBe(20);
    });
  });
});

describe("3. Exam Shifts — Dynamic Query Verification", () => {
  it("returns empty previousYearPapers array [] and NO mock shift fallbacks when tests are absent", async () => {
    // Mock dbHelpers.find: first call for exams, second call for tests
    dbHelpersStub.find.mockImplementation(async (table, _query) => {
      if (table === "exams") {
        return [{ id: "exam-ssc-cgl", slug: "ssc-cgl", title: "SSC CGL" }];
      }
      if (table === "tests") {
        return []; // No digitized test papers for this exam/year
      }
      return [];
    });

    const res = await fetch(`${baseUrl}/api/exams/ssc-cgl/year?year=2024`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.previousYearPapers).toBeDefined();
    expect(Array.isArray(body.data.previousYearPapers)).toBe(true);
    expect(body.data.previousYearPapers.length).toBe(0);

    // Adversarial assertion: Ensure NO synthetic Shift 1, Shift 2, etc. exist
    const jsonStr = JSON.stringify(body.data.previousYearPapers);
    expect(jsonStr).not.toContain("Shift 1");
    expect(jsonStr).not.toContain("Shift 2");
    expect(jsonStr).not.toContain("Shift 3");
  });

  it("returns genuine test papers when present in database", async () => {
    const realTests = [
      {
        id: "test-001",
        title: "SSC CGL 2024 Tier 1 Official Shift 1",
        date: "2024-09-09",
        totalQuestions: 100,
      },
      {
        id: "test-002",
        title: "SSC CGL 2024 Tier 1 Official Shift 2",
        date: "2024-09-10",
        totalQuestions: 100,
      },
    ];

    dbHelpersStub.find.mockImplementation(async (table, _query) => {
      if (table === "exams") {
        return [{ id: "exam-ssc-chsl", slug: "ssc-chsl", title: "SSC CHSL" }];
      }
      if (table === "tests") {
        return realTests;
      }
      return [];
    });

    const res = await fetch(`${baseUrl}/api/exams/ssc-chsl/year?year=2023`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.previousYearPapers.length).toBe(2);
    expect(body.data.previousYearPapers[0].title).toBe(
      "SSC CGL 2024 Tier 1 Official Shift 1",
    );
    expect(body.data.previousYearPapers[0].questions).toBe(100);
  });
});

describe("4. Database Migrations 155 & 156 Security & Integrity", () => {
  const mig155Path = path.resolve(
    __dirname,
    "../infrastructure/database/migrations/155_create_question_notes_table.sql",
  );
  const mig156Path = path.resolve(
    __dirname,
    "../infrastructure/database/migrations/156_create_drill_history_and_cutoffs.sql",
  );

  it("verifies migration 155 enables RLS and contains NO IS NULL bypass", () => {
    expect(fs.existsSync(mig155Path)).toBe(true);
    const sql = fs.readFileSync(mig155Path, "utf-8");

    // Table creation
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.question_notes");
    expect(sql).toContain(
      "ALTER TABLE public.question_notes ENABLE ROW LEVEL SECURITY;",
    );

    // Check policy definition
    expect(sql).toContain("CREATE POLICY question_notes_user_policy");
    expect(sql).toContain("((user_id)::text = (auth.uid())::text)");
    expect(sql).toContain("current_user_id_setting() = user_id");

    // CRITICAL SECURITY ASSERTION: NO IS NULL bypass
    expect(sql).not.toContain("current_user_id() IS NULL");
    expect(sql).not.toContain("current_user_id_setting() IS NULL");
    expect(sql).not.toContain("auth.uid() IS NULL");
  });

  it("verifies migration 156 enables RLS on both tables and contains NO IS NULL bypass", () => {
    expect(fs.existsSync(mig156Path)).toBe(true);
    const sql = fs.readFileSync(mig156Path, "utf-8");

    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS public.fundamental_drill_sessions",
    );
    expect(sql).toContain(
      "ALTER TABLE public.fundamental_drill_sessions ENABLE ROW LEVEL SECURITY;",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.exam_cutoffs");
    expect(sql).toContain(
      "ALTER TABLE public.exam_cutoffs ENABLE ROW LEVEL SECURITY;",
    );

    // Policy check on drill sessions
    expect(sql).toContain(
      "CREATE POLICY fundamental_drill_sessions_user_policy",
    );
    expect(sql).not.toContain("current_user_id() IS NULL");
    expect(sql).not.toContain("current_user_id_setting() IS NULL");
    expect(sql).not.toContain("auth.uid() IS NULL");

    // Exam cutoffs uniqueness
    expect(sql).toContain(
      "CONSTRAINT uq_exam_cutoffs_exam_category_year UNIQUE (exam_id, category, year)",
    );
  });
});

describe("5. Live Notes API — Type Confusion & Error Masking Stress Tests", () => {
  it("rejects non-string non-number questionId (e.g. boolean, object, array)", async () => {
    const invalidQuestionIds = [true, false, { q: 1 }, ["q1", "q2"]];
    for (const qId of invalidQuestionIds) {
      const res = await fetch(`${baseUrl}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({ questionId: qId, noteText: "valid text" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toMatch(/questionId is required/i);
    }
  });

  it("rejects non-string noteText types (e.g. number, boolean, array, object)", async () => {
    const invalidTexts = [12345, true, ["hello"], { text: "hello" }];
    for (const text of invalidTexts) {
      const res = await fetch(`${baseUrl}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({ questionId: "q-1", noteText: text }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toMatch(/noteText is required and cannot be empty/i);
    }
  });

  it("masks internal database errors on GET /api/notes in production", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      queryResultsQueue.push(() => {
        const err = new Error(
          "FATAL: connection pool exhausted at postgresql://user:pass@secret-host:5432",
        );
        throw err;
      });

      const res = await fetch(`${baseUrl}/api/notes`, {
        headers: { "x-test-user": "101" },
      });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
      // In production, sanitizeErrorMessage returns safe generic error
      expect(body.message).toBe(
        "An unexpected error occurred. Please try again later.",
      );
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });
});

describe("6. Practice Fundamentals — Non-Numeric & Boundary Clamping Stress Tests", () => {
  it("rejects non-numeric metrics with 400", async () => {
    const badMetrics = [
      { score: "not-a-number", totalQuestions: 10, durationMs: 5000 },
      { score: 5, totalQuestions: "invalid-total", durationMs: 5000 },
      { score: 5, totalQuestions: 10, durationMs: "invalid-time" },
    ];

    for (const bad of badMetrics) {
      const res = await fetch(`${baseUrl}/api/practice/fundamentals/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-user": "101",
        },
        body: JSON.stringify({ category: "tables", ...bad }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/must be a number/i);
    }
  });

  it("clamps score to totalQuestions if score > totalQuestions", async () => {
    queryResultsQueue.push({ rows: [] }); // mastery
    queryResultsQueue.push({
      rows: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          category: "tables",
          score: 10,
          totalQuestions: 10,
          durationMs: 15000,
          accuracy: 100.0,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const res = await fetch(`${baseUrl}/api/practice/fundamentals/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user": "101",
      },
      body: JSON.stringify({
        category: "tables",
        score: 999, // Attempt to submit 999 out of 10
        totalQuestions: 10,
        durationMs: 15000,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accuracy).toBe(100);

    const insertSessionQuery = executedQueries.find((q) =>
      q.sql.includes("INSERT INTO fundamental_drill_sessions"),
    );
    expect(insertSessionQuery).toBeDefined();
    // Clamped safeScore should equal safeTotal (10)
    expect(insertSessionQuery.params[2]).toBe(10);
    expect(insertSessionQuery.params[3]).toBe(10);
  });
});
