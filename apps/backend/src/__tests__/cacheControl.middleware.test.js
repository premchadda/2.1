import { jest } from "@jest/globals";
import cacheControl from "../middleware/cacheControl.js";

describe("CacheControl Middleware", () => {
  let mockReq;
  let mockRes;
  let nextFunction;
  let headers;

  beforeEach(() => {
    headers = {};
    mockReq = {
      path: "/",
    };
    mockRes = {
      set: jest.fn((key, value) => {
        headers[key] = value;
      }),
    };
    nextFunction = jest.fn();
  });

  test("should set immutable caching on hashed assets", () => {
    mockReq.path = "/assets/vendor-123.js";
    cacheControl(mockReq, mockRes, nextFunction);

    expect(headers["Cache-Control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(nextFunction).toHaveBeenCalled();
  });

  test("should set no-store private on user-specific endpoints", () => {
    mockReq.path = "/api/me";
    cacheControl(mockReq, mockRes, nextFunction);

    expect(headers["Cache-Control"]).toBe(
      "no-store, no-cache, must-revalidate, private",
    );
    expect(nextFunction).toHaveBeenCalled();
  });

  test("should set public cache and Vary header on static public endpoints", () => {
    mockReq.path = "/api/test-series/ssc-cgl";
    cacheControl(mockReq, mockRes, nextFunction);

    expect(headers["Cache-Control"]).toBe("public, max-age=300");
    expect(headers["Vary"]).toBe(
      "Accept-Encoding, Cookie, Authorization, Origin",
    );
    expect(nextFunction).toHaveBeenCalled();
  });

  test("should fallback to strict no-store private on unlisted /api/ endpoints (SEC-EDGE-07)", () => {
    mockReq.path = "/api/tests/123/questions";
    cacheControl(mockReq, mockRes, nextFunction);

    expect(headers["Cache-Control"]).toBe(
      "no-store, no-cache, must-revalidate, private",
    );
    expect(nextFunction).toHaveBeenCalled();
  });

  test("should fallback to strict no-store private on /api/health", () => {
    mockReq.path = "/api/health";
    cacheControl(mockReq, mockRes, nextFunction);

    expect(headers["Cache-Control"]).toBe(
      "no-store, no-cache, must-revalidate, private",
    );
    expect(nextFunction).toHaveBeenCalled();
  });
});
