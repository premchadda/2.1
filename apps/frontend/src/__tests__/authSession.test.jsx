import { describe, it, expect, beforeEach } from "vitest";
import {
  applyAuthSession,
  clearAuthTokens,
  saveUserCache,
  getInitialUser,
  USER_CACHE_KEY,
} from "../shared/providers/AuthContext";

describe("applyAuthSession & auth storage (dual-storage with rememberMe)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("stores fallback tokens in localStorage when rememberMe is true", () => {
    applyAuthSession({
      token: "access-token-123",
      refreshToken: "refresh-token-456",
      csrfToken: "csrf-789",
      rememberMe: true,
    });

    expect(localStorage.getItem("trstprep_token")).toBe("access-token-123");
    expect(localStorage.getItem("trstprep_refresh_token")).toBe(
      "refresh-token-456",
    );
    expect(sessionStorage.getItem("trstprep_token")).toBeNull();
    expect(sessionStorage.getItem("trstprep_refresh_token")).toBeNull();
  });

  it("stores fallback tokens in sessionStorage when rememberMe is false", () => {
    applyAuthSession({
      token: "access-token-123",
      refreshToken: "refresh-token-456",
      csrfToken: "csrf-789",
      rememberMe: false,
    });

    expect(sessionStorage.getItem("trstprep_token")).toBe("access-token-123");
    expect(sessionStorage.getItem("trstprep_refresh_token")).toBe(
      "refresh-token-456",
    );
    expect(localStorage.getItem("trstprep_token")).toBeNull();
    expect(localStorage.getItem("trstprep_refresh_token")).toBeNull();
  });

  it("stores and retrieves user profile according to rememberMe setting", () => {
    const user = { id: "1", name: "Test Student", email: "student@test.com" };

    // With rememberMe=true
    saveUserCache(user, true);
    expect(localStorage.getItem(USER_CACHE_KEY)).toBe(JSON.stringify(user));
    expect(sessionStorage.getItem(USER_CACHE_KEY)).toBeNull();
    expect(getInitialUser()).toEqual(user);

    // With rememberMe=false
    saveUserCache(user, false);
    expect(sessionStorage.getItem(USER_CACHE_KEY)).toBe(JSON.stringify(user));
    expect(localStorage.getItem(USER_CACHE_KEY)).toBeNull();
    expect(getInitialUser()).toEqual(user);
  });

  it("clears both storages and offline buffers on clearAuthTokens", () => {
    sessionStorage.setItem("trstprep_auth_token", "s-token");
    sessionStorage.setItem("trstprep_refresh_token", "s-refresh");
    localStorage.setItem("trstprep_token", "l-token");
    localStorage.setItem("trstprep_refresh_token", "l-refresh");
    localStorage.setItem(
      "trstprep_answers_123",
      JSON.stringify({ answers: { 0: 1 } }),
    );
    localStorage.setItem(
      "trstprep_user_profile",
      JSON.stringify({ name: "Test" }),
    );

    clearAuthTokens();

    expect(sessionStorage.getItem("trstprep_auth_token")).toBeNull();
    expect(sessionStorage.getItem("trstprep_refresh_token")).toBeNull();
    expect(localStorage.getItem("trstprep_token")).toBeNull();
    expect(localStorage.getItem("trstprep_refresh_token")).toBeNull();
    expect(localStorage.getItem("trstprep_answers_123")).toBeNull();
    expect(localStorage.getItem("trstprep_user_profile")).toBeNull();
  });
});
