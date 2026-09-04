import { jest, describe, it, expect, beforeEach } from "@jest/globals";

describe("Bot Protection Middleware", () => {
  let botProtectionMiddleware;
  let mockIsFeatureEnabled;

  beforeEach(async () => {
    jest.resetModules();
    mockIsFeatureEnabled = jest.fn().mockResolvedValue(true);
    jest.unstable_mockModule("../services/SettingsService.js", () => ({
      isFeatureEnabled: mockIsFeatureEnabled,
    }));

    const module = await import("../middleware/botProtection.middleware.js");
    botProtectionMiddleware = module.botProtectionMiddleware;
  });

  it("should pass through when botProtection feature is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);

    const req = {
      body: { _hp_website_trap: "bot filled this" },
      ip: "127.0.0.1",
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await botProtectionMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should reject request when honeypot trap field is populated and feature is enabled", async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);

    const req = {
      body: { _hp_website_trap: "https://spam-link.com" },
      ip: "192.168.1.100",
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await botProtectionMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: "BOT_DETECTED",
        message: "Automated submission detected. Please try again.",
      }),
    );
  });

  it("should pass through for normal human submission with empty honeypot", async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);

    const req = {
      body: {
        email: "realuser@gmail.com",
        _hp_website_trap: "",
        _form_rendered_at: Date.now() - 3000, // 3 seconds elapsed
      },
      ip: "127.0.0.1",
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await botProtectionMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should reject request when form submission is impossibly fast (< 400ms)", async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);

    const req = {
      body: {
        email: "script@test.com",
        _hp_website_trap: "",
        _form_rendered_at: Date.now() - 100, // 100ms (instant bot)
      },
      ip: "127.0.0.1",
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await botProtectionMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: "BOT_SPEED_DETECTED",
      }),
    );
  });
});
