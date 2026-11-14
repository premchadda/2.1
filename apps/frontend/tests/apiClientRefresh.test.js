import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createApiClient,
  clearCsrfToken,
  getCsrfToken,
  isValidApiEndpoint,
  ValidationError,
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
    // Explicit origin: an empty baseURL is the documented same-origin fallback
    // and logs a one-off warning, which is noise in a unit test.
    baseURL: "http://api.test",
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

  test("rejects protocol-relative URLs to prevent SSRF and token leakage (SEC-API-03)", async () => {
    expect(isValidApiEndpoint("//attacker.com/api")).toBe(false);
    expect(isValidApiEndpoint("/\\attacker.com/api")).toBe(false);
    expect(isValidApiEndpoint("\\\\attacker.com/api")).toBe(false);
    expect(isValidApiEndpoint("/api/protected")).toBe(true);

    const { client } = makeClient(async (config) => response(config));

    await expect(client.get("//attacker.com/api")).rejects.toThrow(
      /Invalid request URL/,
    );
    await expect(client.get("/\\attacker.com/api")).rejects.toThrow(
      /Invalid request URL/,
    );
  });

  test("guards Web Storage token by default and respects allowStorageToken opt-in (SEC-CLIENT-05)", async () => {
    sessionStorage.setItem("trstprep_token", "untrusted-storage-token");

    let capturedHeaders = null;
    const { client: defaultClient } = makeClient(async (config) => {
      capturedHeaders = config.headers;
      return response(config);
    });

    await defaultClient.get("/api/test");
    // Default client must NOT inject untrusted storage token
    expect(capturedHeaders["Authorization"]).toBeUndefined();

    // Opt-in client explicitly allows storage token
    const optInClient = createApiClient({
      baseURL: "http://api.test",
      allowStorageToken: true,
    });
    optInClient.defaults.adapter = async (config) => {
      capturedHeaders = config.headers;
      return response(config);
    };

    await optInClient.get("/api/test");
    expect(capturedHeaders["Authorization"]).toBe(
      "Bearer untrusted-storage-token",
    );

    sessionStorage.removeItem("trstprep_token");
  });

  test("reuses fresh sibling-tab refresh without re-issuing duplicate refresh request (SEC-API-01)", async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;

    const { client } = makeClient(async (config) => {
      if (config.url === "/api/protected") {
        protectedCalls += 1;
        if (protectedCalls === 1) throw axiosError(config, 401);
        return response(config, { success: true, data: { value: 99 } });
      }
      if (config.url === "/api/auth/refresh") {
        refreshCalls += 1;
        return response(config, { success: true });
      }
      throw new Error(`Unexpected request: ${config.url}`);
    });

    // Simulate sibling tab having refreshed concurrently just now
    localStorage.setItem(
      "trstprep_last_refresh_timestamp",
      String(Date.now() + 100),
    );

    const result = await client.get("/api/protected");
    expect(result.data.data.value).toBe(99);
    // Refresh should have been skipped because sibling tab already refreshed
    expect(refreshCalls).toBe(0);
    expect(protectedCalls).toBe(2);

    localStorage.removeItem("trstprep_last_refresh_timestamp");
  });
});
