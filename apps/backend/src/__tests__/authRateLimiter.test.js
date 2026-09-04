import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

const mockIncr = jest.fn();
const mockExpire = jest.fn();
const mockGetRedisClient = jest.fn();

jest.unstable_mockModule("../infrastructure/cache/redisClient.js", () => ({
  getRedisClient: () => mockGetRedisClient(),
}));

jest.unstable_mockModule("../infrastructure/logger/logger.js", () => ({
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const { aiRateLimiter } = await import("../middleware/aiRateLimiter.js");

function makeReq(overrides = {}) {
  return {
    user: { id: 1, isProUser: false },
    ...overrides,
  };
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    locals: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
    set(k, v) {
      res.headers[k] = v;
      return res;
    },
  };
  return res;
}

describe("aiRateLimiter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure we're NOT in test mode so the limiter actually runs
    process.env.NODE_ENV = "development";
    mockGetRedisClient.mockReturnValue({
      incr: mockIncr,
      expire: mockExpire,
    });
    mockIncr.mockResolvedValue(1);
    mockExpire.mockResolvedValue(1);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.AI_FREE_HOURLY_LIMIT = originalEnv.AI_FREE_HOURLY_LIMIT;
    process.env.AI_PRO_HOURLY_LIMIT = originalEnv.AI_PRO_HOURLY_LIMIT;
  });

  it("returns 429 when free user exceeds hourly limit", async () => {
    process.env.AI_FREE_HOURLY_LIMIT = "5";
    mockIncr.mockResolvedValue(6); // one over the limit

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await aiRateLimiter(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe("AI_RATE_LIMIT_EXCEEDED");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 429 when pro user exceeds hourly limit", async () => {
    process.env.AI_PRO_HOURLY_LIMIT = "10";
    mockIncr.mockResolvedValue(11);

    const req = makeReq({ user: { id: 2, isProUser: true } });
    const res = makeRes();
    const next = jest.fn();

    await aiRateLimiter(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(res.body.message).toContain("Pro");
    expect(next).not.toHaveBeenCalled();
  });

  it("passes through when under the limit", async () => {
    process.env.AI_FREE_HOURLY_LIMIT = "50";
    mockIncr.mockResolvedValue(3);

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await aiRateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
    expect(res.locals.aiRateLimit.remaining).toBe(47);
  });

  it("fails open when Redis is unavailable", async () => {
    mockGetRedisClient.mockReturnValue(null);

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await aiRateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it("fails open when Redis throws an error", async () => {
    mockIncr.mockRejectedValue(new Error("Redis connection lost"));

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await aiRateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it("sets Retry-After header when rate limited", async () => {
    process.env.AI_FREE_HOURLY_LIMIT = "5";
    mockIncr.mockResolvedValue(6);

    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await aiRateLimiter(req, res, next);

    expect(res.headers["Retry-After"]).toBeDefined();
  });
});
