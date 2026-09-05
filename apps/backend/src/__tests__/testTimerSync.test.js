import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock postgres helpers
const mockFindEntityByIdentifier = jest.fn();
const mockUpdateById = jest.fn();
jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: jest.fn() },
    dbHelpers: {
      updateById: mockUpdateById,
      findEntityByIdentifier: mockFindEntityByIdentifier,
    },
    withTransaction: jest.fn((cb) => cb({ query: jest.fn() })),
  }),
);

// Mock identifier-utils
jest.unstable_mockModule("../shared/utils/identifier-utils.js", () => ({
  findEntityByIdentifier: mockFindEntityByIdentifier,
  getInternalId: (entity) => entity.id || entity._id,
}));

// Mock websocketManager
const mockEmit = jest.fn();
const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
jest.unstable_mockModule(
  "../infrastructure/websocket/websocketManager.js",
  () => ({
    getIO: () => ({
      to: mockTo,
    }),
  }),
);

// Mock auth middleware to pass through with req.user
jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  protect: (req, res, next) => {
    req.user = req.user || { id: "usr-4401", email: "student@test.com" };
    next();
  },
}));

// Import express and the router
import express from "express";
const { default: attemptRoutes } =
  await import("../modules/attempts/attempt.routes.js");

const app = express();
app.use(express.json());
app.use("/api/attempt", attemptRoutes);

describe("Real-Time Test Timer Sync & Heartbeat Recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies 404 when heartbeat is sent for non-existent attempt", async () => {
    mockFindEntityByIdentifier.mockResolvedValueOnce(null);

    const req = {
      params: { attemptId: "att-non-existent" },
      user: { id: "usr-4401" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Use supertest-like mock invocation
    const routeHandler = attemptRoutes.stack
      .find(
        (layer) => layer.route && layer.route.path === "/:attemptId/heartbeat",
      )
      .route.stack.slice(-1)[0].handle;

    await routeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Attempt not found",
      }),
    );
  });

  it("rejects with 403 when user does not own the attempt", async () => {
    mockFindEntityByIdentifier.mockResolvedValueOnce({
      id: 9910,
      userId: "usr-other-user",
      testId: "test-101",
      status: "active",
    });

    const req = {
      params: { attemptId: "att-9910" },
      user: { id: "usr-4401" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const routeHandler = attemptRoutes.stack
      .find(
        (layer) => layer.route && layer.route.path === "/:attemptId/heartbeat",
      )
      .route.stack.slice(-1)[0].handle;

    await routeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Not authorized",
      }),
    );
  });

  it("processes active heartbeat, returns server timestamp for clock skew adjustment, and emits to live monitor", async () => {
    const mockAttempt = {
      id: 9911,
      userId: "usr-4401",
      testId: "test-ssc-cgl",
      status: "active",
      isCompleted: false,
    };
    mockFindEntityByIdentifier.mockResolvedValueOnce(mockAttempt);
    mockUpdateById.mockResolvedValueOnce(mockAttempt);

    const req = {
      params: { attemptId: "att-9911" },
      user: { id: "usr-4401" },
      body: {
        questionId: "q-5",
        timeLeft: 1800,
        visibility: "visible",
      },
    };
    const res = {
      json: jest.fn(),
    };

    const routeHandler = attemptRoutes.stack
      .find(
        (layer) => layer.route && layer.route.path === "/:attemptId/heartbeat",
      )
      .route.stack.slice(-1)[0].handle;

    await routeHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        attemptStatus: "active",
        serverTime: expect.any(String),
      }),
    );

    // Verify Socket.IO emitted to admin:live-tests
    expect(mockTo).toHaveBeenCalledWith("admin:live-tests");
    expect(mockEmit).toHaveBeenCalledWith(
      "live_test:presence",
      expect.objectContaining({
        attemptId: 9911,
        userId: "usr-4401",
        testId: "test-ssc-cgl",
        status: "active",
      }),
    );
  });

  it("notifies client of expired or revoked status so frontend halts timer and logs violation", async () => {
    const expiredAttempt = {
      id: 9912,
      userId: "usr-4401",
      testId: "test-ssc-cgl",
      status: "expired",
      isCompleted: false,
    };
    mockFindEntityByIdentifier.mockResolvedValueOnce(expiredAttempt);

    const req = {
      params: { attemptId: "att-9912" },
      user: { id: "usr-4401" },
      body: { timeLeft: 0 },
    };
    const res = {
      json: jest.fn(),
    };

    const routeHandler = attemptRoutes.stack
      .find(
        (layer) => layer.route && layer.route.path === "/:attemptId/heartbeat",
      )
      .route.stack.slice(-1)[0].handle;

    await routeHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        attemptStatus: "expired",
      }),
    );
  });
});
