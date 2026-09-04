import logBuffer from "../infrastructure/logger/logBuffer.js";

describe("LogBuffer Engine", () => {
  beforeEach(() => {
    logBuffer.clear();
  });

  test("should push log entries and assign sequential IDs", () => {
    const entry1 = logBuffer.push({
      level: "info",
      source: "test-source",
      message: "First test log message",
    });
    const entry2 = logBuffer.push({
      level: "warn",
      source: "test-source",
      message: "Second test log message",
    });

    expect(entry1.id).toBeDefined();
    expect(entry2.id).toBe(entry1.id + 1);
    expect(entry1.level).toBe("info");
    expect(entry2.level).toBe("warn");
  });

  test("should automatically redact sensitive tokens and credentials", () => {
    const entry = logBuffer.push({
      level: "info",
      message:
        'User logged in with password="MySecretPassword123" and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      details: {
        password: "PlainTextPassword",
        apiKey: "secret-key-12345",
        safeField: "visible-data",
      },
    });

    expect(entry.message).not.toContain("MySecretPassword123");
    expect(entry.message).toContain("••••");
    expect(entry.details.password).toBe("••••••••");
    expect(entry.details.apiKey).toBe("••••••••");
    expect(entry.details.safeField).toBe("visible-data");
  });

  test("should filter logs by level and search term", () => {
    logBuffer.push({ level: "info", message: "User profile accessed" });
    logBuffer.push({
      level: "error",
      message: "Database query connection timeout",
    });
    logBuffer.push({ level: "warn", message: "High CPU load warning" });

    const errorLogs = logBuffer.getLogs({ level: "error" });
    expect(errorLogs.length).toBe(1);
    expect(errorLogs[0].message).toContain("Database query connection timeout");

    const dbLogs = logBuffer.getLogs({ search: "timeout" });
    expect(dbLogs.length).toBe(1);
    expect(dbLogs[0].level).toBe("error");

    const nonExistent = logBuffer.getLogs({ search: "nonexistenttermxyz" });
    expect(nonExistent.length).toBe(0);
  });

  test("should return system stats", () => {
    const stats = logBuffer.getStats();
    expect(stats.totalBufferedLogs).toBeGreaterThanOrEqual(1);
    expect(stats.maxBufferSize).toBe(10000);
    expect(stats.memory).toBeDefined();
    expect(stats.memory.heapUsedMb).toBeGreaterThan(0);
    expect(stats.nodeVersion).toBe(process.version);
  });

  test("should clear the buffer cleanly", () => {
    logBuffer.push({ level: "info", message: "Message 1" });
    logBuffer.push({ level: "info", message: "Message 2" });
    expect(logBuffer.getLogs().length).toBeGreaterThanOrEqual(2);

    logBuffer.clear();
    const current = logBuffer.getLogs();
    expect(current.length).toBe(1);
    expect(current[0].message).toContain("Console buffer cleared");
  });
});
