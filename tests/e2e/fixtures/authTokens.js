/**
 * tests/e2e/fixtures/authTokens.js
 * Cryptographic JWT generator and pre-baked tokens for Student, Admin, and SuperAdmin testing.
 */

import crypto from "node:crypto";

export const TEST_JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-for-e2e-testing-32chars-min-Trstprep!";

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(typeof input === "string" ? input : JSON.stringify(input));
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signJwt(payload, secret = TEST_JWT_SECRET, options = {}) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iat: now,
    exp: now + (options.expiresInSeconds || 7 * 24 * 60 * 60),
    type: "session",
    ...payload,
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(fullPayload);
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(dataToSign)
    .digest();

  return `${dataToSign}.${base64UrlEncode(signature)}`;
}

export const TEST_STUDENT_USER = {
  id: 1001,
  userId: 1001,
  email: "student.test@trstprep.com",
  role: "student",
  isAdmin: false,
  is_admin: false,
  name: "Priya Sharma",
  is_pro: false,
};

export const TEST_PRO_USER = {
  id: 1002,
  email: "pro.student@trstprep.com",
  role: "student",
  isAdmin: false,
  is_admin: false,
  name: "Amit Patel",
  is_pro: true,
};

export const TEST_ADMIN_USER = {
  id: 2001,
  email: "admin.curriculum@trstprep.com",
  role: "admin",
  isAdmin: true,
  is_admin: true,
  name: "Vikram Malhotra",
  permissions: ["questions:read", "questions:create", "questions:edit", "analytics:read"],
};

export const TEST_SUPER_ADMIN_USER = {
  id: 2002,
  email: "super.admin@trstprep.com",
  role: "admin",
  isAdmin: true,
  is_admin: true,
  isSuperAdmin: true,
  is_super_admin: true,
  name: "Sanjay Singhania",
  permissions: ["*"],
};

export const TEST_ATTACKER_USER = {
  id: 9999,
  email: "attacker@malicious.io",
  role: "student",
  isAdmin: false,
  is_admin: false,
  name: "Mallory",
};

export function mintStudentToken(overrides = {}) {
  return signJwt({ ...TEST_STUDENT_USER, ...overrides });
}

export function mintProUserToken(overrides = {}) {
  return signJwt({ ...TEST_PRO_USER, ...overrides });
}

export function mintAdminToken(overrides = {}) {
  return signJwt({ ...TEST_ADMIN_USER, ...overrides });
}

export function mintSuperAdminToken(overrides = {}) {
  return signJwt({ ...TEST_SUPER_ADMIN_USER, ...overrides });
}

export function mintExpiredToken(payload = TEST_STUDENT_USER) {
  return signJwt(payload, TEST_JWT_SECRET, { expiresInSeconds: -3600 });
}

export function mintTamperedToken(payload = TEST_ADMIN_USER) {
  return signJwt(payload, "completely-wrong-and-invalid-secret-key-12345");
}

export const studentToken = mintStudentToken();
export const proUserToken = mintProUserToken();
export const adminToken = mintAdminToken();
export const superAdminToken = mintSuperAdminToken();
export const expiredToken = mintExpiredToken();
export const tamperedToken = mintTamperedToken();
