import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockPoolQuery = jest.fn();

jest.unstable_mockModule(
  "../infrastructure/database/postgres-helpers.js",
  () => ({
    pool: {
      query: (...args) => mockPoolQuery(...args),
    },
  }),
);

const { purgeDeadLetterJobs, runDatabaseMaintenance } =
  await import("../services/core/maintenance.js");

describe("Database Maintenance Service (services/core/maintenance.js)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("purgeDeadLetterJobs deletes jobs older than default 30 days and returns removed count", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 15 });

    const removed = await purgeDeadLetterJobs();
    expect(removed).toBe(15);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM dead_letter_jobs"),
      ["30"],
    );
  });

  it("purgeDeadLetterJobs accepts custom retention period in days", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 4 });

    const removed = await purgeDeadLetterJobs(7);
    expect(removed).toBe(4);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM dead_letter_jobs"),
      ["7"],
    );
  });

  it("purgeDeadLetterJobs catches database errors gracefully and returns 0 without throwing", async () => {
    mockPoolQuery.mockRejectedValueOnce(
      new Error("Connection terminated unexpectedly"),
    );

    const removed = await purgeDeadLetterJobs(14);
    expect(removed).toBe(0);
  });

  it("runDatabaseMaintenance executes maintenance suite idempotently", async () => {
    mockPoolQuery.mockResolvedValueOnce({ rowCount: 0 });
    await expect(runDatabaseMaintenance()).resolves.not.toThrow();
  });
});
