import { setCsrfToken, clearCsrfToken } from "@trstprep/shared-config";

export const applyAuthSession = ({ csrfToken } = {}) => {
  try {
    // httpOnly cookies only - do NOT store JWT in localStorage (CRIT-03)
    // Clean legacy tokens if present (migration from old localStorage flow)
    try {
      localStorage.removeItem("trstprep_auth_token");
      localStorage.removeItem("trstprep_token");
      localStorage.removeItem("trstprep_refresh_token");
      sessionStorage.removeItem("trstprep_auth_token");
      sessionStorage.removeItem("trstprep_token");
      sessionStorage.removeItem("trstprep_refresh_token");
    } catch (_e) {
      void _e;
    }
    if (csrfToken) {
      setCsrfToken(csrfToken);
    }
  } catch (error) {
    void error;
  }
};

export const saveAuthTokens = applyAuthSession;

export const clearAuthTokens = () => {
  try {
    // httpOnly cookies cleared server-side; only clear CSRF and legacy storage
    try {
      localStorage.removeItem("trstprep_auth_token");
      localStorage.removeItem("trstprep_token");
      localStorage.removeItem("trstprep_refresh_token");
      sessionStorage.removeItem("trstprep_auth_token");
      sessionStorage.removeItem("trstprep_token");
      sessionStorage.removeItem("trstprep_refresh_token");
    } catch (_e) {
      void _e;
    }
    clearCsrfToken();
  } catch (error) {
    void error;
  }
};
