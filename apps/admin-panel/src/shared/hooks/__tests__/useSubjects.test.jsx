// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { adminAPI } from "../../lib/dataService.js";
import { useSubjects, resetSubjectsCacheForTests } from "../useSubjects.js";

vi.mock("../../lib/dataService.js", () => ({
  adminAPI: { apiClient: { get: vi.fn() } },
}));

const getMock = () => adminAPI.apiClient.get;

const ROWS_A = [{ id: 1, name: "Physics", icon: "⚛️", color: "#111111" }];
const ROWS_B = [{ id: 2, name: "Chemistry" }];

function mockSubjectsResponse(rows) {
  getMock().mockResolvedValue({ data: { success: true, data: rows } });
}

beforeEach(() => {
  resetSubjectsCacheForTests();
  vi.clearAllMocks();
});

describe("useSubjects", () => {
  test("loads and caches subjects on success", async () => {
    mockSubjectsResponse(ROWS_A);
    const { result } = renderHook(() => useSubjects());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subjects).toHaveLength(1);
    expect(result.current.subjects[0]).toMatchObject({
      id: "1",
      label: "Physics",
    });
    expect(result.current.error).toBeNull();
    expect(getMock()).toHaveBeenCalledTimes(1);
  });

  test("failed fetch keeps previous subjects, exposes error, retry refetches", async () => {
    mockSubjectsResponse(ROWS_A);
    const first = renderHook(() => useSubjects());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.subjects).toHaveLength(1);
    first.unmount();

    // Expire the 60s TTL so the next mount refetches instead of serving cache.
    const realNow = Date.now;
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockImplementation(() => realNow() + 61_000);
    try {
      getMock().mockRejectedValueOnce(new Error("boom"));
      const second = renderHook(() => useSubjects());

      await waitFor(() => expect(second.result.current.error).toBeTruthy());
      // Previous subjects preserved — never [] as truth.
      expect(second.result.current.subjects).toHaveLength(1);
      expect(second.result.current.subjects[0]).toMatchObject({
        label: "Physics",
      });
      expect(second.result.current.loading).toBe(false);

      // Retry resets dedup/TTL state and refetches successfully.
      mockSubjectsResponse(ROWS_B);
      await act(async () => {
        second.result.current.retry();
      });
      await waitFor(() =>
        expect(second.result.current.subjects[0]).toMatchObject({
          label: "Chemistry",
        }),
      );
      expect(second.result.current.error).toBeNull();
      expect(second.result.current.loading).toBe(false);
      expect(getMock()).toHaveBeenCalledTimes(3);
      second.unmount();
    } finally {
      nowSpy.mockRestore();
    }
  });

  test("failed first fetch surfaces error with empty subjects", async () => {
    getMock().mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useSubjects());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subjects).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });
});
