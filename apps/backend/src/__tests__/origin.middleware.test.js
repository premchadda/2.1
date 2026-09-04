import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import { validateOrigin } from "../middleware/origin.middleware.js";

describe("Origin Validation Middleware", () => {
  let mockReq;
  let mockRes;
  let nextFunction;

  beforeEach(() => {
    mockReq = {
      method: "POST",
      path: "/api/auth/login",
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
    process.env.NODE_ENV = "development";
  });

  test("should allow GET requests without checks", () => {
    mockReq.method = "GET";
    validateOrigin(mockReq, mockRes, nextFunction);
    expect(nextFunction).toHaveBeenCalled();
  });

  test("should allow requests with no origin header", () => {
    validateOrigin(mockReq, mockRes, nextFunction);
    expect(nextFunction).toHaveBeenCalled();
  });

  test("should allow same-origin requests", () => {
    mockReq.headers.origin = "http://localhost:5001";
    mockReq.headers.host = "localhost:5001";
    validateOrigin(mockReq, mockRes, nextFunction);
    expect(nextFunction).toHaveBeenCalled();
  });

  test("should allow loopback origin with ports in development", () => {
    mockReq.headers.origin = "http://localhost:3000";
    mockReq.headers.host = "localhost:5001";
    validateOrigin(mockReq, mockRes, nextFunction);
    expect(nextFunction).toHaveBeenCalled();
  });

  test("should block loopback origin with ports in production", () => {
    process.env.NODE_ENV = "production";
    mockReq.headers.origin = "http://localhost:3000";
    mockReq.headers.host = "localhost:5001";
    validateOrigin(mockReq, mockRes, nextFunction);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "CSRF_ORIGIN",
      }),
    );
  });

  test("should block non-loopback cross-origin requests", () => {
    mockReq.headers.origin = "http://malicious.com";
    mockReq.headers.host = "localhost:5001";
    validateOrigin(mockReq, mockRes, nextFunction);
    expect(mockRes.status).toHaveBeenCalledWith(403);
  });
});
