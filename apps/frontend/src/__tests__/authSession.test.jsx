import { describe, it, expect, beforeEach } from "vitest";
import {
  applyAuthSession,
  clearAuthTokens,
} from "../shared/providers/AuthProvider";

describe("applyAuthSession storage isolation (httpOnly)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("purges legacy tokens from both storages and does not persist new tokens (httpOnly)", () => {
    // Populate legacy tokens in both storages
    localStorage.setItem("trstprep_token", "old-access-token");
    localStorage.setItem("trstprep_refresh_token", "old-refresh-token");
    localStorage.setItem("trstprep_auth_token", "old-auth-token");
    sessionStorage.setItem("trstprep_auth_token", "old-session-access");
    sessionStorage.setItem("trstprep_refresh_token", "old-session-refresh");
    sessionStorage.setItem("trstprep_token", "old-session-token");

    // applyAuthSession must NOT store tokens — httpOnly cookies handle auth
    // It should only handle csrfToken and purge legacy keys
    applyAuthSession({
      csrfToken: "csrf-123",
    });

    // All legacy token keys must be purged (httpOnly migration)
    expect(sessionStorage.getItem("trstprep_auth_token")).toBeNull();
    expect(sessionStorage.getItem("trstprep_refresh_token")).toBeNull();
    expect(sessionStorage.getItem("trstprep_token")).toBeNull();
    expect(localStorage.getItem("trstprep_token")).toBeNull();
    expect(localStorage.getItem("trstprep_refresh_token")).toBeNull();
    expect(localStorage.getItem("trstprep_auth_token")).toBeNull();
  });

  it("is idempotent when called with no tokens (migration hygiene)", () => {
    localStorage.setItem("trstprep_token", "legacy");
    applyAuthSession({ csrfToken: "csrf-456" });
    expect(localStorage.getItem("trstprep_token")).toBeNull();
    // Second call with only csrfToken should still purge
    applyAuthSession({});
    expect(localStorage.getItem("trstprep_token")).toBeNull();
  });

  it("clears both storages and offline buffers on clearAuthTokens", () => {
    sessionStorage.setItem("trstprep_auth_token", "s-token");
    sessionStorage.setItem("trstprep_refresh_token", "s-refresh");
    localStorage.setItem("trstprep_token", "l-token");
    localStorage.setItem("trstprep_refresh_token", "l-refresh");
    localStorage.setItem("trstprep_answers_123", JSON.stringify({ answers: { 0: 1 } }));
    localStorage.setItem("trstprep_user_profile", JSON.stringify({ name: "Test" }));

    clearAuthTokens();

    expect(sessionStorage.getItem("trstprep_auth_token")).toBeNull();
    expect(sessionStorage.getItem("trstprep_refresh_token")).toBeNull();
    expect(localStorage.getItem("trstprep_token")).toBeNull();
    expect(localStorage.getItem("trstprep_refresh_token")).toBeNull();
    expect(localStorage.getItem("trstprep_answers_123")).toBeNull();
    expect(localStorage.getItem("trstprep_user_profile")).toBeNull();
  });
});
