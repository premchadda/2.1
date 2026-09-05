import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock postgres helpers
const mockFind = jest.fn();
jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: { query: jest.fn() },
    dbHelpers: {
      find: mockFind,
      findById: jest.fn(),
      insertOne: jest.fn(),
      updateById: jest.fn(),
    },
    withTransaction: jest.fn((cb) => cb({ query: jest.fn() })),
  }),
);

// Mock razorpay
jest.unstable_mockModule("razorpay", () => ({
  default: class MockRazorpay {
    constructor() {
      this.orders = { create: jest.fn() };
    }
  },
}));

// Mock auth middleware
jest.unstable_mockModule("../middleware/auth.middleware.js", () => ({
  optionalAuth: (req, res, next) => next(),
  protect: (req, res, next) => next(),
  admin: (req, res, next) => next(),
}));

// Import the router
const { default: paymentsRouter } = await import("../api/routes/payments.js");

describe("Coupon, Discount & Promotional Code Engine (payments.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getHandler = (path) => {
    const layer = paymentsRouter.stack.find(
      (l) => l.route && l.route.path === path && l.route.methods.post,
    );
    return layer.route.stack.slice(-1)[0].handle;
  };

  const invoke = (handler, req) => {
    return new Promise((resolve, reject) => {
      const res = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          resolve({ status: this.statusCode, body: data });
          return this;
        },
      };
      handler(req, res, (err) => {
        if (err) reject(err);
        else resolve({ status: res.statusCode, body: null });
      });
    });
  };

  it("rejects request with 400 when couponCode, amount, or planId is missing", async () => {
    const handler = getHandler("/validate-coupon");
    const req = { body: { couponCode: "", amount: 500, planId: "plan-1" } };

    const res = await invoke(handler, req);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Coupon code, amount, and plan ID are required",
      }),
    );
  });

  it("rejects with 400 when coupon is not found or inactive", async () => {
    mockFind.mockResolvedValueOnce([]); // no coupon found with code and isActive: true

    const handler = getHandler("/validate-coupon");
    const req = {
      body: { couponCode: "INVALID99", amount: 500, planId: "plan-1" },
    };

    const res = await invoke(handler, req);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Invalid coupon code",
      }),
    );
  });

  it("rejects coupon when validFrom is in the future or validUntil is in the past", async () => {
    const handler = getHandler("/validate-coupon");

    // Future coupon
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    mockFind.mockResolvedValueOnce([
      { code: "FUTURE20", isActive: true, validFrom: futureDate },
    ]);

    const resFuture = await invoke(handler, {
      body: { couponCode: "FUTURE20", amount: 1000, planId: "plan-1" },
    });
    expect(resFuture.status).toBe(400);
    expect(resFuture.body.message).toBe("Coupon is not active yet");

    // Expired coupon
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    mockFind.mockResolvedValueOnce([
      { code: "EXPIRED20", isActive: true, validUntil: pastDate },
    ]);

    const resExpired = await invoke(handler, {
      body: { couponCode: "EXPIRED20", amount: 1000, planId: "plan-1" },
    });
    expect(resExpired.status).toBe(400);
    expect(resExpired.body.message).toBe("Coupon has expired");
  });

  it("enforces total redemption usage limit", async () => {
    mockFind.mockResolvedValueOnce([
      {
        code: "LIMITED50",
        isActive: true,
        usageLimit: 10,
        usedCount: 10, // already reached
      },
    ]);

    const handler = getHandler("/validate-coupon");
    const req = {
      body: { couponCode: "LIMITED50", amount: 800, planId: "plan-1" },
    };

    const res = await invoke(handler, req);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Coupon usage limit reached");
  });

  it("enforces minimum purchase order value", async () => {
    mockFind.mockResolvedValueOnce([
      {
        code: "MIN500",
        isActive: true,
        minPurchase: 500,
      },
    ]);

    const handler = getHandler("/validate-coupon");
    const req = {
      body: { couponCode: "MIN500", amount: 399, planId: "plan-1" },
    };

    const res = await invoke(handler, req);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Minimum purchase amount of 500 required");
  });

  it("enforces applicable plans whitelist", async () => {
    mockFind.mockResolvedValueOnce([
      {
        code: "PROPASSONLY",
        isActive: true,
        applicablePlans: ["plan-pro-yearly", "plan-pro-lifetime"],
      },
    ]);

    const handler = getHandler("/validate-coupon");
    const req = {
      body: { couponCode: "PROPASSONLY", amount: 999, planId: "plan-monthly" },
    };

    const res = await invoke(handler, req);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Coupon is not applicable to this plan");
  });

  it("enforces one-use-per-user constraint for authenticated candidates", async () => {
    mockFind.mockResolvedValueOnce([
      {
        code: "WELCOME100",
        isActive: true,
        onePerUser: true,
        usedByUsers: [4401, 4402],
      },
    ]);

    const handler = getHandler("/validate-coupon");
    const req = {
      body: { couponCode: "WELCOME100", amount: 999, planId: "plan-pro" },
      user: { id: 4401 },
    };

    const res = await invoke(handler, req);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("You have already used this coupon");
  });

  it("calculates percentage discount capped by maxDiscount", async () => {
    mockFind.mockResolvedValueOnce([
      {
        code: "FESTIVE50",
        isActive: true,
        discountType: "percentage",
        discountValue: 50, // 50%
        maxDiscount: 200, // capped at 200 INR
      },
    ]);

    const handler = getHandler("/validate-coupon");
    // 50% of 1000 is 500, but capped at 200 => discount: 200, finalAmount: 800
    const req = {
      body: { couponCode: "FESTIVE50", amount: 1000, planId: "plan-pro" },
    };

    const res = await invoke(handler, req);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        discount: 200,
        finalAmount: 800,
      }),
    );
  });

  it("calculates fixed discount with zero floor via apply-coupon alias", async () => {
    mockFind.mockResolvedValueOnce([
      {
        code: "FLAT300",
        isActive: true,
        discountType: "fixed",
        discountValue: 300,
      },
    ]);

    const handler = getHandler("/apply-coupon");
    // Amount 250 with fixed 300 discount => floor at 0
    const req = {
      body: { couponCode: "FLAT300", amount: 250, planId: "plan-basic" },
    };

    const res = await invoke(handler, req);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        discount: 300,
        finalAmount: 0,
      }),
    );
  });
});
