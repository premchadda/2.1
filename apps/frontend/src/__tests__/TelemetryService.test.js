import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock apiClient
const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock("../shared/lib/apiClient.js", () => ({
  apiClient: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    defaults: { baseURL: "" },
  },
}));

import TelemetryService from "../shared/lib/telemetry/TelemetryService.js";

import { waitFor } from "@testing-library/react";

describe("TelemetryService - Real-Time Timer Sync & Reconnection Recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Prevent unhandled network errors during flushSync
    navigator.sendBeacon = vi.fn().mockReturnValue(true);
    TelemetryService.stop();
  });

  afterEach(() => {
    TelemetryService.stop();
  });

  it("calculates server clock offset with network latency adjustment via syncServerTime", async () => {
    const fakeClientNow = 1700000000000;
    const fakeServerNow = fakeClientNow + 3500; // server is 3.5s ahead

    vi.spyOn(Date, "now").mockReturnValue(fakeClientNow);

    mockGet.mockResolvedValueOnce({
      data: { timestamp: new Date(fakeServerNow).toISOString() },
    });

    await TelemetryService.syncServerTime();

    expect(mockGet).toHaveBeenCalledWith("/api/health");
    // Offset should be approximately 3500ms
    expect(TelemetryService.serverOffset).toBe(3500);

    vi.restoreAllMocks();
  });

  it("sends heartbeat payload with current timer and question state", async () => {
    const onViolation = vi.fn();
    TelemetryService.start({
      attemptId: "att-5501",
      testId: "test-7701",
      getCurrentQuestion: () => "q-12",
      getTimeLeft: () => 1450,
      onViolation,
    });

    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        attemptStatus: "active",
        serverTime: new Date().toISOString(),
      },
    });

    await TelemetryService.sendHeartbeat();

    expect(mockPost).toHaveBeenCalledWith(
      "/api/attempt/att-5501/heartbeat",
      expect.objectContaining({
        attemptId: "att-5501",
        questionId: "q-12",
        timeLeft: 1450,
        network: "online",
      }),
    );
    expect(onViolation).not.toHaveBeenCalled();
    expect(TelemetryService.isRunning).toBe(true);
  });

  it("stops telemetry and triggers violation when server reports non-active attempt status", async () => {
    const onViolation = vi.fn();
    TelemetryService.start({
      attemptId: "att-5502",
      testId: "test-7702",
      getCurrentQuestion: () => "q-20",
      getTimeLeft: () => 0,
      onViolation,
    });

    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        attemptStatus: "expired",
        serverTime: new Date().toISOString(),
      },
    });

    await TelemetryService.sendHeartbeat();

    expect(onViolation).toHaveBeenCalledWith("attempt_revoked", {
      status: "expired",
    });
    expect(TelemetryService.isRunning).toBe(false);
  });

  it("handles online reconnect event by logging event and flushing offline queue", async () => {
    const onViolation = vi.fn();
    TelemetryService.start({
      attemptId: "att-5503",
      testId: "test-7703",
      getCurrentQuestion: () => "q-1",
      getTimeLeft: () => 1800,
      onViolation,
    });

    // Enqueue an offline item in localStorage
    TelemetryService.offlineQueue.enqueue({
      eventType: "answer_select",
      metadata: { selectedOption: 2 },
      clientTime: new Date().toISOString(),
    });

    expect(TelemetryService.offlineQueue.length()).toBe(1);

    mockPost.mockResolvedValue({ data: { success: true } });

    // Trigger online event
    TelemetryService.handleOnline();

    // Offline queue should have been dequeued and flushed
    await waitFor(() => {
      expect(TelemetryService.offlineQueue.length()).toBe(0);
    });
  });
});
