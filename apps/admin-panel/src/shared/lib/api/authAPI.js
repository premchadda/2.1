import { ValidationError } from "@trstprep/shared-config";
import { apiClient } from "../apiClient.js";

const ALLOWED_LOGIN_CONTEXT_KEYS = new Set([
  "captchaToken",
  "clientNonce",
  "deviceId",
  "rememberMe",
  "botScore",
  "hCaptchaToken",
]);
const sanitizeContext = (ctx) => {
  if (!ctx || typeof ctx !== "object") return {};
  const clean = {};
  for (const k of Object.keys(ctx)) {
    if (ALLOWED_LOGIN_CONTEXT_KEYS.has(k)) clean[k] = ctx[k];
  }
  return clean;
};

export const authAPI = {
  login: (emailOrData, password, rememberMe = false, botContext = {}) => {
    let email, pass, remember, context;
    if (typeof emailOrData === "object" && emailOrData !== null) {
      email = emailOrData.email;
      pass = emailOrData.password;
      remember = emailOrData.rememberMe ?? rememberMe;
      context = sanitizeContext(emailOrData);
    } else {
      email = emailOrData;
      pass = password;
      remember = rememberMe;
      context = sanitizeContext(botContext);
    }

    if (!email || !pass) {
      throw new ValidationError("Email and password are required");
    }
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      throw new ValidationError("Please enter a valid email address");
    }
    if (pass.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }
    return apiClient.post("/auth/login", {
      ...context,
      email: cleanEmail,
      password: pass,
      rememberMe: remember === true || remember === "true",
    });
  },
  register: (data) => {
    const allowed = [
      "name",
      "email",
      "password",
      "mobile",
      "phone",
      "rememberMe",
    ];
    const clean = {};
    for (const k of allowed)
      if (data[k] !== undefined)
        clean[k] = typeof data[k] === "string" ? data[k].trim() : data[k];
    const required = ["name", "email", "password"];
    for (const field of required) {
      if (!clean[field]) {
        throw new ValidationError(`${field} is required`);
      }
    }
    clean.email = String(clean.email).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean.email)) {
      throw new ValidationError("Please enter a valid email address");
    }
    if (String(clean.password).length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }
    if (clean.name && String(clean.name).trim().length < 2) {
      throw new ValidationError("Name must be at least 2 characters");
    }
    return apiClient.post("/auth/register", clean);
  },
  logout: () => apiClient.post("/auth/logout"),
  revokeOtherSessions: () => apiClient.delete("/sessions"),
  getMe: () => apiClient.get("/auth/me"),
  refreshToken: () => apiClient.post("/auth/refresh"),
  // Two-factor authentication (TOTP) management
  twoFactorStatus: () => apiClient.get("/auth/2fa/status"),
  twoFactorEnroll: () => apiClient.post("/auth/2fa/enroll"),
  twoFactorVerify: (token) => {
    const t = String(token ?? "").trim();
    if (!/^\d{6}$/.test(t))
      throw new ValidationError("2FA code must be 6 digits");
    return apiClient.post("/auth/2fa/verify", { token: t });
  },
  twoFactorRegenerateBackupCodes: () =>
    apiClient.post("/auth/2fa/backup-codes/regenerate"),
  twoFactorDisable: () => apiClient.post("/auth/2fa/disable"),
};

export default authAPI;
