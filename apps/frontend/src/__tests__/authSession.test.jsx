import { describe, it, expect, beforeEach } from "vitest";
import {
  applyAuthSession,
  clearAuthTokens,
} from "../shared/providers/AuthProvider";

describe("applyAuthSession storage isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores tokens in sessionStorage and purges localStorage when rememberMe is false", () => {
    // Populate stale tokens in localStorage
    localStorage.setItem("trstprep_token", "old-access-token");
    localStorage.setItem("trstprep_refresh_token", "old-refresh-token");

    applyAuthSession({
      token: "session-access-token",
      refreshToken: "session-refresh-token",
      csrfToken: "csrf-123",
      rememberMe: false,
    });

    // Should write to sessionStorage
    expect(sessionStorage.getItem("trstprep_auth_token")).toBe(
      "session-access-token",
    );
    expect(sessionStorage.getItem("trstprep_refresh_token")).toBe(
      "session-refresh-token",
    );

    // Should purge localStorage
    expect(localStorage.getItem("trstprep_token")).toBeNull();
    expect(localStorage.getItem("trstprep_refresh_token")).toBeNull();
  });

  it("stores tokens in localStorage and purges sessionStorage when rememberMe is true", () => {
    // Populate stale tokens in sessionStorage
    sessionStorage.setItem("trstprep_auth_token", "old-session-access");
    sessionStorage.setItem("trstprep_refresh_token", "old-session-refresh");

    applyAuthSession({
      token: "persisted-access-token",
      refreshToken: "persisted-refresh-token",
      csrfToken: "csrf-456",
      rememberMe: true,
    });

    // Should write to localStorage
    expect(localStorage.getItem("trstprep_token")).toBe(
      "persisted-access-token",
    );
    expect(localStorage.getItem("trstprep_refresh_token")).toBe(
      "persisted-refresh-token",
    );

    // Should purge sessionStorage
    expect(sessionStorage.getItem("trstprep_auth_token")).toBeNull();
    expect(sessionStorage.getItem("trstprep_refresh_token")).toBeNull();
  });

  it("clears both storages on clearAuthTokens", () => {
    sessionStorage.setItem("trstprep_auth_token", "s-token");
    sessionStorage.setItem("trstprep_refresh_token", "s-refresh");
    localStorage.setItem("trstprep_token", "l-token");
    localStorage.setItem("trstprep_refresh_token", "l-refresh");

    clearAuthTokens();

    expect(sessionStorage.getItem("trstprep_auth_token")).toBeNull();
    expect(sessionStorage.getItem("trstprep_refresh_token")).toBeNull();
    expect(localStorage.getItem("trstprep_token")).toBeNull();
    expect(localStorage.getItem("trstprep_refresh_token")).toBeNull();
  });
});
