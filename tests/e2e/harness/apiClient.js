/**
 * tests/e2e/harness/apiClient.js
 * Opaque-box HTTP client agent supporting role-based identities, JWT headers, and CSRF protection.
 */

import {
  studentToken,
  proUserToken,
  adminToken,
  superAdminToken,
  mintStudentToken,
  mintAdminToken,
  mintSuperAdminToken,
} from "../fixtures/authTokens.js";

export let DEFAULT_API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:5001";

export class ApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_API_BASE;
    this.token = options.token || null;
    this.csrfToken = options.csrfToken || "test-csrf-token-12345";
    this.customHeaders = options.headers || {};
  }

  setBaseUrl(url) {
    this.baseUrl = url;
    DEFAULT_API_BASE = url;
  }

  withToken(token) {
    return new ApiClient({
      baseUrl: this.baseUrl,
      token,
      csrfToken: this.csrfToken,
      headers: { ...this.customHeaders },
    });
  }

  withHeaders(headers) {
    return new ApiClient({
      baseUrl: this.baseUrl,
      token: this.token,
      csrfToken: this.csrfToken,
      headers: { ...this.customHeaders, ...headers },
    });
  }

  asAnonymous() {
    return new ApiClient({
      baseUrl: this.baseUrl,
      token: null,
      csrfToken: null,
      headers: { ...this.customHeaders },
    });
  }

  asStudent(overrides = null) {
    const t = overrides ? mintStudentToken(overrides) : studentToken;
    return this.withToken(t);
  }

  asProUser(overrides = null) {
    const t = overrides ? mintStudentToken({ is_pro: true, ...overrides }) : proUserToken;
    return this.withToken(t);
  }

  asAdmin(overrides = null) {
    const t = overrides ? mintAdminToken(overrides) : adminToken;
    return this.withToken(t);
  }

  asSuperAdmin(overrides = null) {
    const t = overrides ? mintSuperAdminToken(overrides) : superAdminToken;
    return this.withToken(t);
  }

  async request(method, path, options = {}) {
    const url = new URL(path.startsWith("http") ? path : `${this.baseUrl}${path}`);
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...this.customHeaders,
      ...options.headers,
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    if (this.csrfToken && ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
      headers["x-csrf-token"] = this.csrfToken;
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers,
    };

    if (options.body && ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
      fetchOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url.toString(), fetchOptions);
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }

      return {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        body,
        data: body?.data !== undefined ? body.data : body,
      };
    } catch (networkError) {
      throw new Error(`[apiClient] Network request failed (${method} ${path}): ${networkError.message}`);
    }
  }

  get(path, options = {}) {
    return this.request("GET", path, options);
  }

  post(path, body = null, options = {}) {
    return this.request("POST", path, { ...options, body });
  }

  put(path, body = null, options = {}) {
    return this.request("PUT", path, { ...options, body });
  }

  delete(path, options = {}) {
    return this.request("DELETE", path, options);
  }
}

export const apiClient = new ApiClient();
