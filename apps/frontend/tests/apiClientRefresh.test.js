import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createApiClient,
  clearCsrfToken,
  getCsrfToken,
} from "@trstprep/shared-config";

function axiosError(
  config,
  status,
  data = { success: false, message: "Unauthorized" },
) {
  const error = new Error(data.message);
  error.config = config;
  error.response = {
    status,
    statusText: String(status),
    data,
    headers: {},
    config,
  };
  return error;
}

function response(config, data = { success: true }) {
  return {
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    data,
  };
}

function makeClient(adapter, onAuthFailure = vi.fn()) {
  const client = createApiClient({
    authEndpoints: [
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/refresh",
    ],
    refreshUrl: "/api/auth/refresh",
    authUrlMatch: "includes",
    onAuthFailure,
  });
  client.defaults.adapter = adapter;
  return { client, onAuthFailure };
}

describe("createApiClient refresh handling", () => {
  afterEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  test("refreshes once, captures CSRF, and retries the original request", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;

    const { client, onAuthFailure } = makeClient(async (config) => {
      if (config.url === "/api/protected") {
        protectedCalls += 1;
        if (protectedCalls === 1) {
          throw axiosError(config, 401);
        }
        return response(config, { success: true, data: { value: 42 } });
      }

      if (config.url === "/api/auth/refresh") {
        refreshCalls += 1;
        return response(config, {
          success: true,
          data: { csrfToken: "csrf-after-refresh" },
        });
      }

      throw new Error(`Unexpected request: ${config.url}`);
    });

    const result = await client.get("/api/protected");

    expect(result.data.data.value).toBe(42);
    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(getCsrfToken()).toBe("csrf-after-refresh");
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  test("does not repeatedly refresh when the retried request is still unauthorized", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;

    const { client, onAuthFailure } = makeClient(async (config) => {
      if (config.url === "/api/protected") {
        protectedCalls += 1;
        throw axiosError(config, 401);
      }

      if (config.url === "/api/auth/refresh") {
        refreshCalls += 1;
        return response(config, {
          success: true,
          data: { csrfToken: "csrf-after-refresh" },
        });
      }

      throw new Error(`Unexpected request: ${config.url}`);
    });

    await expect(client.get("/api/protected")).rejects.toThrow("Unauthorized");

    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(getCsrfToken()).toBe("csrf-after-refresh");
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });
});
