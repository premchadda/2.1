import {
  ERROR_CATEGORIES,
  classifyErrorCategory,
  sanitizeTraceAndMessage,
  generateFingerprint,
  ingestErrorLog,
  getErrorClusters,
  resolveCluster,
  getErrorSummary,
  _clearErrorClusters,
} from "../services/core/errorFingerprintService.js";

describe("Automated Error Log Fingerprinting & Sentry Alert Grouping (Wave 17)", () => {
  beforeEach(() => {
    _clearErrorClusters();
  });

  it("should categorize error types accurately", () => {
    expect(
      classifyErrorCategory(
        "FetchError: request to http://api timed out",
        "",
        "NetworkError",
      ),
    ).toBe(ERROR_CATEGORIES.NETWORK_TIMEOUT);
    expect(classifyErrorCategory("jwt expired", "", "TokenExpiredError")).toBe(
      ERROR_CATEGORIES.AUTH_EXPIRED,
    );
    expect(
      classifyErrorCategory(
        "Cannot read properties of undefined (reading 'length')",
        "",
        "TypeError",
      ),
    ).toBe(ERROR_CATEGORIES.DOM_RENDER_EXCEPTION);
    expect(
      classifyErrorCategory(
        "Proctoring incident: fullscreen_exit detected",
        "",
        "ViolationError",
      ),
    ).toBe(ERROR_CATEGORIES.PROCTORING_VIOLATION);
    expect(
      classifyErrorCategory(
        "deadlock detected on attempts table",
        "",
        "DatabaseError",
      ),
    ).toBe(ERROR_CATEGORIES.DATABASE_UNAVAILABLE);
    expect(
      classifyErrorCategory("Validation failed for schema", "", "ZodError"),
    ).toBe(ERROR_CATEGORIES.VALIDATION_ERROR);
    expect(
      classifyErrorCategory(
        "Something unexpected happened",
        "",
        "UnknownError",
      ),
    ).toBe(ERROR_CATEGORIES.GENERAL_RUNTIME_ERROR);
  });

  it("should sanitize variable data (UUIDs, memory addresses, timestamps, line numbers)", () => {
    const rawMsg =
      "Failed to load user 123e4567-e89b-12d3-a456-426614174000 at 2026-09-05T12:34:56.789Z";
    const rawStack =
      "Error at render (bundle.js:1042:25)\n    at Object.0x7ffeefbff568";

    const { normalizedMsg, normalizedStack } = sanitizeTraceAndMessage(
      rawMsg,
      rawStack,
    );

    expect(normalizedMsg).not.toContain("123e4567-e89b-12d3-a456-426614174000");
    expect(normalizedMsg).toContain("<UUID>");
    expect(normalizedMsg).toContain("<TS>");
    expect(normalizedStack).toContain(":<LINE>:<COL>");
    expect(normalizedStack).toContain("0x...");
  });

  it("should generate identical fingerprints for same root cause with different dynamic data", () => {
    const err1 = {
      name: "TypeError",
      message:
        "Cannot read properties of null for user 11111111-1111-1111-1111-111111111111 at 2026-09-05T01:00:00Z",
      stack: "TypeError: Cannot read properties\n  at ExamRoom.js:45:12",
    };
    const err2 = {
      name: "TypeError",
      message:
        "Cannot read properties of null for user 22222222-2222-2222-2222-222222222222 at 2026-09-05T02:00:00Z",
      stack: "TypeError: Cannot read properties\n  at ExamRoom.js:45:12",
    };

    const fp1 = generateFingerprint(err1);
    const fp2 = generateFingerprint(err2);

    expect(fp1.fingerprint).toBe(fp2.fingerprint);
    expect(fp1.category).toBe(ERROR_CATEGORIES.DOM_RENDER_EXCEPTION);
  });

  it("should cluster errors and track frequency and impacted users", () => {
    ingestErrorLog({
      name: "NetworkTimeout",
      message: "connect ETIMEDOUT 10.0.0.1:443",
      userId: "usr-1",
    });
    ingestErrorLog({
      name: "NetworkTimeout",
      message: "connect ETIMEDOUT 10.0.0.2:443",
      userId: "usr-2",
    });

    const clusters = getErrorClusters();
    expect(clusters).toHaveLength(1);
    expect(clusters[0].occurrenceCount).toBe(2);
    expect(clusters[0].impactedUsersCount).toBe(2);
    expect(clusters[0].impactedUsers).toEqual(
      expect.arrayContaining(["usr-1", "usr-2"]),
    );
    expect(clusters[0].category).toBe(ERROR_CATEGORIES.NETWORK_TIMEOUT);
  });

  it("should trigger alert when error spike threshold is reached", () => {
    let lastResult;
    for (let i = 0; i < 11; i++) {
      lastResult = ingestErrorLog({
        name: "DatabaseCrash",
        message: "postgres connection pool exhausted",
        userId: `user-${i}`,
      });
    }

    expect(lastResult.alertTriggered).toBe(true);

    const summary = getErrorSummary();
    expect(summary.totalErrors).toBe(11);
    expect(summary.activeAlerts).toBe(1);
    expect(
      summary.categoryBreakdown[ERROR_CATEGORIES.DATABASE_UNAVAILABLE],
    ).toBe(11);
  });

  it("should allow resolving an error cluster", () => {
    const { fingerprint } = ingestErrorLog({
      name: "ProctoringViolation",
      message: "tab_switch detected",
    });

    const resolved = resolveCluster(fingerprint);
    expect(resolved).toBe(true);

    const activeClusters = getErrorClusters({ resolved: false });
    expect(activeClusters).toHaveLength(0);

    const resolvedClusters = getErrorClusters({ resolved: true });
    expect(resolvedClusters).toHaveLength(1);
    expect(resolvedClusters[0].resolved).toBe(true);
  });
});
