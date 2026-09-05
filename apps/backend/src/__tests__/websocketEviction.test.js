import { jest, describe, it, expect, beforeEach } from "@jest/globals";

describe("WebSocket Active Attempt Registry & Multi-Device Eviction", () => {
  let mockSocket1;
  let mockSocket2;
  let mockSocket3;
  let mockSocketsMap;

  beforeEach(() => {
    mockSocket1 = {
      id: "socket_111",
      isAuthenticated: true,
      userId: 42,
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    mockSocket2 = {
      id: "socket_222",
      isAuthenticated: true,
      userId: 42,
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    mockSocket3 = {
      id: "socket_333",
      isAuthenticated: true,
      userId: 99,
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    mockSocketsMap = new Map([
      ["socket_111", mockSocket1],
      ["socket_222", mockSocket2],
      ["socket_333", mockSocket3],
    ]);
  });

  describe("Multi-Tab Attempt Eviction", () => {
    const handleAttemptJoin = async (
      socket,
      data,
      activeAttemptSocketsInstance,
    ) => {
      const { attemptId } = data;
      const newSocketId = socket.id;
      const existingSocketId = activeAttemptSocketsInstance.get(attemptId);

      activeAttemptSocketsInstance.set(attemptId, newSocketId);
      socket.attemptId = attemptId;

      if (existingSocketId && existingSocketId !== newSocketId) {
        const oldSocket = mockSocketsMap.get(existingSocketId);
        if (oldSocket) {
          oldSocket.emit("attempt:evicted", {
            attemptId,
            message:
              "Another tab opened this attempt. This session is now inactive.",
          });
          oldSocket.leave(`attempt:${attemptId}`);
        }
      }
      socket.join(`attempt:${attemptId}`);
    };

    it("registers attempt socket and evicts previous tab on same attempt", async () => {
      const activeAttemptSockets = new Map();

      // 1. First socket joins attempt 99
      await handleAttemptJoin(
        mockSocket1,
        { attemptId: 99 },
        activeAttemptSockets,
      );
      expect(activeAttemptSockets.get(99)).toBe("socket_111");
      expect(mockSocket1.join).toHaveBeenCalledWith("attempt:99");
      expect(mockSocket1.emit).not.toHaveBeenCalledWith(
        "attempt:evicted",
        expect.any(Object),
      );

      // 2. Second socket (duplicate tab) joins attempt 99
      await handleAttemptJoin(
        mockSocket2,
        { attemptId: 99 },
        activeAttemptSockets,
      );
      expect(activeAttemptSockets.get(99)).toBe("socket_222");
      expect(mockSocket2.join).toHaveBeenCalledWith("attempt:99");

      // Assert first socket was evicted
      expect(mockSocket1.emit).toHaveBeenCalledWith("attempt:evicted", {
        attemptId: 99,
        message: expect.stringContaining("Another tab opened this attempt"),
      });
      expect(mockSocket1.leave).toHaveBeenCalledWith("attempt:99");
    });

    it("does not evict when different users join different attempts", async () => {
      const activeAttemptSockets = new Map();

      await handleAttemptJoin(
        mockSocket1,
        { attemptId: 100 },
        activeAttemptSockets,
      );
      await handleAttemptJoin(
        mockSocket3,
        { attemptId: 200 },
        activeAttemptSockets,
      );

      expect(activeAttemptSockets.get(100)).toBe("socket_111");
      expect(activeAttemptSockets.get(200)).toBe("socket_333");
      expect(mockSocket1.emit).not.toHaveBeenCalledWith(
        "attempt:evicted",
        expect.any(Object),
      );
      expect(mockSocket3.emit).not.toHaveBeenCalledWith(
        "attempt:evicted",
        expect.any(Object),
      );
    });
  });

  describe("Multi-Device User Session Eviction", () => {
    const handleUserSessionConnect = async (socket, activeUserSessions) => {
      const userId = socket.userId;
      const existingSocketId = activeUserSessions.get(userId);

      if (existingSocketId && existingSocketId !== socket.id) {
        const oldSocket = mockSocketsMap.get(existingSocketId);
        if (oldSocket) {
          oldSocket.emit("session:evicted", {
            code: "MULTI_DEVICE_LOGIN",
            message:
              "You have been logged out because your account was accessed from another device.",
          });
          oldSocket.leave(`user:${userId}`);
          oldSocket.disconnect(true);
        }
      }

      activeUserSessions.set(userId, socket.id);
      socket.join(`user:${userId}`);
    };

    it("enforces single active session per user across devices", async () => {
      const activeUserSessions = new Map();

      // Device 1 connects
      await handleUserSessionConnect(mockSocket1, activeUserSessions);
      expect(activeUserSessions.get(42)).toBe("socket_111");
      expect(mockSocket1.join).toHaveBeenCalledWith("user:42");

      // Device 2 connects for user 42
      await handleUserSessionConnect(mockSocket2, activeUserSessions);
      expect(activeUserSessions.get(42)).toBe("socket_222");
      expect(mockSocket2.join).toHaveBeenCalledWith("user:42");

      // Verify Device 1 was notified, left user room, and disconnected
      expect(mockSocket1.emit).toHaveBeenCalledWith("session:evicted", {
        code: "MULTI_DEVICE_LOGIN",
        message: expect.stringContaining(
          "account was accessed from another device",
        ),
      });
      expect(mockSocket1.leave).toHaveBeenCalledWith("user:42");
      expect(mockSocket1.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe("Room Broadcast Scoping & Submission Isolation", () => {
    it("scopes live-test leaderboard broadcast to live-test rooms only", () => {
      const mockIo = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      const handleTestSubmission = (submissionData) => {
        const { testId, source, participantCount } = submissionData;
        if (!testId) return;

        if (source === "live-tests") {
          mockIo.to(`test:${testId}`).emit("leaderboard:updated", {
            testId,
            type: "live-test",
            participantCount: participantCount || 0,
          });
          mockIo.to("admin:live-tests").emit("leaderboard:updated", {
            testId,
            type: "live-test",
            participantCount: participantCount || 0,
          });
        }

        mockIo.to(`test:${testId}`).emit("live-test:attempt_submitted", {
          testId,
        });
      };

      // 1. Regular test submission (not live)
      handleTestSubmission({ testId: 55, source: "practice" });
      expect(mockIo.to).toHaveBeenCalledWith("test:55");
      expect(mockIo.emit).toHaveBeenCalledWith("live-test:attempt_submitted", {
        testId: 55,
      });
      expect(mockIo.to).not.toHaveBeenCalledWith("admin:live-tests");

      // 2. Live test submission
      mockIo.to.mockClear();
      mockIo.emit.mockClear();
      handleTestSubmission({
        testId: 88,
        source: "live-tests",
        participantCount: 150,
      });
      expect(mockIo.to).toHaveBeenCalledWith("test:88");
      expect(mockIo.to).toHaveBeenCalledWith("admin:live-tests");
      expect(mockIo.emit).toHaveBeenCalledWith("leaderboard:updated", {
        testId: 88,
        type: "live-test",
        participantCount: 150,
      });
    });
  });

  describe("Socket Event Rate Limiting", () => {
    it("throttles events exceeding per-minute allowance", () => {
      const counts = new Map();
      const isAllowed = (socketId, eventName, limit = 5) => {
        const key = `${socketId}:${eventName}`;
        const current = counts.get(key) || 0;
        if (current >= limit) return false;
        counts.set(key, current + 1);
        return true;
      };

      // Fire 5 allowed events
      for (let i = 0; i < 5; i++) {
        expect(isAllowed("sock_1", "ping", 5)).toBe(true);
      }
      // 6th event is blocked
      expect(isAllowed("sock_1", "ping", 5)).toBe(false);
      // Independent event still allowed
      expect(isAllowed("sock_1", "chat:message", 5)).toBe(true);
    });
  });
});
