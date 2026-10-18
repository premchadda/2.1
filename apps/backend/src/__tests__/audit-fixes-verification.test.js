import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  beforeAll,
} from "@jest/globals";
import express from "express";
import http from "http";

// Mock database helpers and pool
const mockQuery = jest.fn();
const mockUpdateById = jest.fn();
const mockFind = jest.fn();
const mockInsertOne = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: (...args) => mockQuery(...args) },
    ensureTestSectionsSchema: jest.fn(),
    dbHelpers: {
      query: (...args) => mockQuery(...args),
      updateById: (...args) => mockUpdateById(...args),
      find: (...args) => mockFind(...args),
      insertOne: (...args) => mockInsertOne(...args),
    },
  }),
);

// Mock auth middleware
const currentMockUser = {
  id: 42,
  email: "student@trstprep.com",
  name: "Student",
  role: "admin",
};

jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  protect: (req, res, next) => {
    req.user = currentMockUser;
    next();
  },
  auth: (req, res, next) => {
    req.user = currentMockUser;
    next();
  },
  admin: (req, res, next) => {
    req.user = currentMockUser;
    next();
  },
  optionalAuth: (req, res, next) => {
    req.user = currentMockUser;
    next();
  },
  isUserAdminRequest: () => false,
}));

// Import routers after mocking
const { default: examInfoRouter } =
  await import("../modules/exams/examInfo.routes.js");
const { default: adminContentRouter } =
  await import("../api/routes/admin-content.js");
const { default: notificationsRouter } =
  await import("../api/routes/notifications.js");
const { default: notificationsPrefRouter } =
  await import("../api/routes/notificationsPref.js");
const { default: videosPublicRouter } =
  await import("../api/routes/videos-public.js");
const { default: adminSectionsRouter } =
  await import("../api/routes/admin-sections.js");

describe("Audit Fixes Verification Suite", () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/exam-info", examInfoRouter);
    app.use("/admin", adminContentRouter);
    app.use("/api/notifications", notificationsRouter);
    app.use("/api/videos", videosPublicRouter);
    app.use("/admin/sections", adminSectionsRouter);
    app.use("/notifications-pref", notificationsPrefRouter);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Fix 1: Exam Error Reporting", () => {
    it("submits exam error report with NULL question_id instead of 0", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await fetch(`${baseUrl}/api/exam-info/report-error`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: 101,
          examTitle: "JEE Advanced 2025",
          year: 2025,
          category: "Typo in syllabus",
          details: "Section 2 description has incorrect date",
        }),
      });

      const body = await res.json();
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
      const firstCallSql = mockQuery.mock.calls[0][0];
      // Must NOT insert question_id = 0
      expect(firstCallSql).not.toContain("VALUES (0,");
      expect(firstCallSql).toContain("VALUES (NULL,");
    });
  });

  describe("Fix 2: Admin Curriculum Topic Test Reordering", () => {
    it("handles PUT /topic-tests/:id/reorder with displayOrder and sortOrder", async () => {
      mockUpdateById.mockResolvedValueOnce({
        id: 5,
        displayOrder: 3,
        sortOrder: 3,
      });

      const res = await fetch(`${baseUrl}/admin/topic-tests/5/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: 3 }),
      });

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockUpdateById).toHaveBeenCalledWith(
        "topicTests",
        "5",
        expect.objectContaining({ displayOrder: 3, sortOrder: 3 }),
      );
    });
  });

  describe("Fix 3: Coming Soon Notification Subscription", () => {
    it("allows authenticated user to subscribe without providing body email", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await fetch(`${baseUrl}/api/notifications/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "coming_soon" }),
      });

      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe("Successfully subscribed to notifications");
    });
  });

  describe("Fix 4: Video Progress Persistence", () => {
    it("persists video progress to database and memory", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const postRes = await fetch(
        `${baseUrl}/api/videos/vid_test_123/progress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastTimestamp: 45.5, totalTimeSpent: 120 }),
        },
      );

      const postBody = await postRes.json();
      expect(postRes.status).toBe(200);
      expect(postBody.success).toBe(true);
      expect(postBody.data.lastTimestamp).toBe(45.5);

      // Verify progress map retrieval
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            video_id: "vid_test_123",
            last_timestamp: 45.5,
            total_time_spent: 120,
            updated_at: 1700000000000,
          },
        ],
      });

      const getRes = await fetch(`${baseUrl}/api/videos/user/progress-map`);
      const getBody = await getRes.json();
      expect(getRes.status).toBe(200);
      expect(getBody.success).toBe(true);
      expect(getBody.data["vid_test_123"]).toBeDefined();
    });
  });

  describe("Fix 5: Admin Section Alias Resolver", () => {
    it("resolves section alias to canonical name via GET /admin/sections/resolve/:name", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ canonical_name: "Mathematics", alias_name: "Maths" }],
      });

      const res = await fetch(`${baseUrl}/admin/sections/resolve/Maths`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.canonicalName).toBe("Mathematics");
    });
  });

  describe("Fix 6: Notification Preferences API", () => {
    it("gets and updates notification preferences", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: 42,
            email_notifications: true,
            push_notifications: false,
            sms_notifications: false,
            marketing: false,
            test_reminders: true,
          },
        ],
      });

      const getRes = await fetch(`${baseUrl}/notifications-pref/preferences`);
      const getBody = await getRes.json();
      expect(getRes.status).toBe(200);
      expect(getBody.data.email_notifications).toBe(true);

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            user_id: 42,
            email_notifications: true,
            push_notifications: true,
            sms_notifications: false,
            marketing: false,
            test_reminders: true,
          },
        ],
      });

      const putRes = await fetch(`${baseUrl}/notifications-pref/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push_notifications: true }),
      });

      const putBody = await putRes.json();
      expect(putRes.status).toBe(200);
      expect(putBody.success).toBe(true);
    });
  });
});
