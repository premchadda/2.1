import { jest, describe, expect, it, beforeEach } from "@jest/globals";

const mockIsFeatureEnabled = jest.fn();
jest.unstable_mockModule("../services/SettingsService.js", () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

const { default: SmsService } = await import("../services/SmsService.js");

describe("SmsService feature gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not dispatch when SMS notifications are disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);
    const dispatch = jest.spyOn(SmsService, "sendViaTwilio");

    const result = await SmsService.send("+919876543210", "test");

    expect(result).toMatchObject({
      success: false,
      code: "SMS_NOTIFICATIONS_DISABLED",
    });
    expect(dispatch).not.toHaveBeenCalled();
    dispatch.mockRestore();
  });

  it("dispatches only after the SMS feature is enabled", async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);
    const dispatch = jest.spyOn(SmsService, "sendViaTwilio").mockResolvedValue({
      success: true,
      messageId: "sms-1",
    });
    SmsService.provider = "twilio";

    await expect(SmsService.send("+919876543210", "test")).resolves.toEqual({
      success: true,
      messageId: "sms-1",
    });
    expect(dispatch).toHaveBeenCalledWith("+919876543210", "test");
    dispatch.mockRestore();
  });
});
