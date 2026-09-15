import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createApiClient, clearCsrfToken } from "@trstprep/shared-config";

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

describe("Mobile Auth Persistence & Token Fallback", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearCsrfToken();
  });

  it("attaches Bearer token from localStorage when sessionStorage is empty", async () => {
    localStorage.setItem("trstprep_token", "test-access-token-123");

    let capturedHeaders = null;
    const client = createApiClient({
      authEndpoints: [
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
      ],
      refreshUrl: "/api/auth/refresh",
      authUrlMatch: "includes",
    });

    client.defaults.adapter = async (config) => {
      capturedHeaders = config.headers;
      return response(config, { success: true, data: { ok: true } });
    };

    await client.get("/api/test-endpoint");
    expect(capturedHeaders.Authorization).toBe("Bearer test-access-token-123");
  });

  it("attaches Bearer token from sessionStorage over localStorage when both exist", async () => {
    sessionStorage.setItem("trstprep_auth_token", "session-token-456");
    localStorage.setItem("trstprep_token", "local-token-123");

    let capturedHeaders = null;
    const client = createApiClient({
      authEndpoints: [
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
      ],
      refreshUrl: "/api/auth/refresh",
      authUrlMatch: "includes",
    });

    client.defaults.adapter = async (config) => {
      capturedHeaders = config.headers;
      return response(config, { success: true, data: { ok: true } });
    };

    await client.get("/api/test-endpoint");
    expect(capturedHeaders.Authorization).toBe("Bearer session-token-456");
  });

  it("refreshes token with body payload on 401 when cookies are missing and updates headers", async () => {
    localStorage.setItem("trstprep_token", "expired-token");
    localStorage.setItem("trstprep_refresh_token", "valid-refresh-token");

    let requestCount = 0;
    let refreshData = null;
    let retriedHeaders = null;

    const client = createApiClient({
      authEndpoints: [
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
      ],
      refreshUrl: "/api/auth/refresh",
      authUrlMatch: "includes",
    });

    client.defaults.adapter = async (config) => {
      if (config.url?.includes("/api/auth/refresh")) {
        refreshData =
          typeof config.data === "string"
            ? JSON.parse(config.data)
            : config.data;
        return response(config, {
          success: true,
          data: {
            token: "new-fresh-access-token",
            refreshToken: "new-fresh-refresh-token",
            csrfToken: "new-csrf",
          },
        });
      }

      if (config.url === "/api/protected-data") {
        requestCount++;
        if (requestCount === 1) {
          throw axiosError(config, 401);
        }
        retriedHeaders = config.headers;
        return response(config, {
          success: true,
          data: { message: "Success after refresh" },
        });
      }

      throw new Error(`Unexpected request: ${config.url}`);
    };

    const result = await client.get("/api/protected-data");
    expect(result.data.data.message).toBe("Success after refresh");
    expect(refreshData).toEqual({ refreshToken: "valid-refresh-token" });
    expect(localStorage.getItem("trstprep_token")).toBe(
      "new-fresh-access-token",
    );
    expect(localStorage.getItem("trstprep_refresh_token")).toBe(
      "new-fresh-refresh-token",
    );
    expect(retriedHeaders.Authorization).toBe("Bearer new-fresh-access-token");
  });
});
