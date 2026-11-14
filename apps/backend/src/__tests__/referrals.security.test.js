import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import express from "express";
import http from "http";

const mockReferrer = { id: 10, referralCode: "TRSTPREP10" };
const mockFindOne = jest.fn();
const mockFindById = jest.fn();
const mockInsertOne = jest.fn();
const mockQuery = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    dbHelpers: {
      findOne: (...args) => mockFindOne(...args),
      findById: (...args) => mockFindById(...args),
      insertOne: (...args) => mockInsertOne(...args),
      find: jest.fn(),
    },
    pool: {
      query: (...args) => mockQuery(...args),
    },
  }),
);

let mockUser = { id: 20, isAdmin: false };
jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  protect: (req, res, next) => {
    if (!mockUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.user = mockUser;
    next();
  },
  admin: (req, res, next) => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  },
}));

jest.unstable_mockModule("../middleware/rateLimiterFactory.js", () => ({
  createRateLimiter: () => (req, res, next) => next(),
}));

const { default: referralsRoute } = await import("../api/routes/referrals.js");

let server;
let baseUrl;

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/referrals", referralsRoute);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  return `http://127.0.0.1:${port}/api/referrals`;
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
}

describe("Referrals Security & Business Logic (VULN-BIZ-01)", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockUser = { id: 20, isAdmin: false };
    baseUrl = await startServer();
  });

  afterEach(async () => {
    await stopServer();
  });

  it("should require authentication on POST /api/referrals", async () => {
    mockUser = null;
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode: "TRSTPREP10", newUserId: 20 }),
    });

    expect(res.status).toBe(401);
  });

  it("should reject self-referral where authenticated user is the referrer", async () => {
    mockUser = { id: 10, isAdmin: false };
    mockFindOne.mockResolvedValue(mockReferrer);

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode: "TRSTPREP10", newUserId: 10 }),
    });

    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.message).toMatch(/Self-referrals are not allowed/i);
  });

  it("should reject referral if existing referral record found", async () => {
    mockFindOne.mockResolvedValue(mockReferrer);
    mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode: "TRSTPREP10", newUserId: 20 }),
    });

    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.message).toMatch(/Referral already exists/i);
  });

  it("should reject non-admin registering referral for a different user ID", async () => {
    mockUser = { id: 20, isAdmin: false };

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode: "TRSTPREP10", newUserId: 999 }),
    });

    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.message).toMatch(/Cannot register referral for another user/i);
  });

  it("should successfully register valid referral", async () => {
    mockFindOne.mockResolvedValue(mockReferrer);
    mockQuery.mockResolvedValue({ rows: [] });
    mockInsertOne.mockResolvedValue({
      id: 55,
      referrerId: 10,
      referredUserId: 20,
      status: "pending",
    });

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralCode: "TRSTPREP10", newUserId: 20 }),
    });

    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockInsertOne).toHaveBeenCalledWith(
      "referrals",
      expect.objectContaining({
        referrerId: 10,
        referredUserId: 20,
        status: "pending",
      }),
    );
  });
});
