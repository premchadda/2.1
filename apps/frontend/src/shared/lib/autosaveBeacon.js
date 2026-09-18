import { getCsrfToken } from "@trstprep/shared-config";
import { API_BASE_URL } from "./apiBase.js";

/**
 * keepalive-safe autosave beacon shared by TestInterface and useAnswerPersistence.
 *
 * axios cannot send keepalive requests, so unload/visibility flushes use native
 * fetch. This helper keeps that path on the cookie auth model:
 * httpOnly cookies via `credentials: "include"` plus the CSRF header from the
 * same source aiStreaming.js uses (getCsrfToken from @trstprep/shared-config).
 * It never rejects — failures are swallowed so beforeunload stays best-effort.
 */
export function sendAutosaveBeacon(actualTestId, payload) {
  try {
    let csrfToken = null;
    try {
      csrfToken = getCsrfToken();
    } catch {
      csrfToken = null;
    }
    const headers = { "Content-Type": "application/json" };
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    const endpoint = `${API_BASE_URL || ""}/api/tests/${actualTestId}/autosave`;
    return fetch(endpoint, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

export default sendAutosaveBeacon;
