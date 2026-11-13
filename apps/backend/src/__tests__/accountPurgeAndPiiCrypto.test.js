import crypto from "crypto";
import { jest } from "@jest/globals";
import {
  encryptPii,
  decryptPii,
  encryptPII,
  getKey,
} from "../shared/utils/piiCrypto.js";
import {
  encryptValue,
  decryptValue,
} from "../infrastructure/database/postgres-helpers.js";
import { purgeSingleUser } from "../workers/accountPurgeWorker.js";

describe("PII Dual-Delimiter Auto-Detection & Cross-Cipher Decryption", () => {
  const secretKey = getKey();
  const testPhone = "9876543210";

  test("Canonical encryptPii produces '::' delimiter base64 and roundtrips with decryptPii", () => {
    const enc = encryptPii(testPhone);
    expect(enc).toContain("::");
    const parts = enc.split("::");
    expect(parts.length).toBe(3);

    const decrypted = decryptPii(enc);
    expect(decrypted).toBe(testPhone);
  });

  test("Canonical encryptPii output is successfully decrypted by postgres-helpers decryptValue", () => {
    const enc = encryptPii(testPhone);
    const decrypted = decryptValue(enc);
    expect(decrypted).toBe(testPhone);
  });

  test("postgres-helpers encryptValue delegates to canonical piiCrypto and is decrypted by decryptPii", () => {
    const enc = encryptValue(testPhone);
    expect(enc).toContain("::");
    const decrypted = decryptPii(enc);
    expect(decrypted).toBe(testPhone);
  });

  test("Legacy hex format with single colon ':' is automatically detected and decrypted by decryptPii and decryptValue", () => {
    // Construct legacy hex GCM format: ivHex:authTagHex:ciphertextHex
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", secretKey, iv);
    let ciphertextHex = cipher.update(testPhone, "utf8", "hex");
    ciphertextHex += cipher.final("hex");
    const authTagHex = cipher.getAuthTag().toString("hex");
    const legacyHex = `${iv.toString("hex")}:${authTagHex}:${ciphertextHex}`;

    expect(legacyHex.includes("::")).toBe(false);
    expect(legacyHex.split(":").length).toBe(3);

    // Both decryptPii and decryptValue should successfully auto-detect and decrypt
    expect(decryptPii(legacyHex)).toBe(testPhone);
    expect(decryptValue(legacyHex)).toBe(testPhone);
  });

  test("Legacy CBC 2-part hex format is auto-detected and decrypted", () => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", secretKey, iv);
    let ciphertextHex = cipher.update(testPhone, "utf8", "hex");
    ciphertextHex += cipher.final("hex");
    const legacyCbc = `${iv.toString("hex")}:${ciphertextHex}`;

    expect(decryptPii(legacyCbc)).toBe(testPhone);
    expect(decryptValue(legacyCbc)).toBe(testPhone);
  });

  test("Dev obfuscation 'dev:' format is handled gracefully", () => {
    const devEnc = "dev:" + Buffer.from(testPhone, "utf8").toString("base64");
    expect(decryptPii(devEnc)).toBe(testPhone);
    expect(decryptValue(devEnc)).toBe(testPhone);
  });

  test("Unencrypted strings and falsy inputs are returned as-is without crashing", () => {
    expect(decryptPii("plain-unencrypted-text")).toBe("plain-unencrypted-text");
    expect(decryptValue("plain-unencrypted-text")).toBe(
      "plain-unencrypted-text",
    );
    expect(decryptPii(null)).toBeNull();
    expect(decryptPii(undefined)).toBeUndefined();
    expect(decryptPii(encryptPII("123"))).toBe("123");
  });
});

describe("DPDP Act 2023 Account Purge Worker", () => {
  test("purgeSingleUser cleans up sessions, anonymizes audit logs, clears FKs, and purges user", async () => {
    const executedQueries = [];
    const mockClient = {
      query: jest.fn().mockImplementation(async (sql, params) => {
        executedQueries.push({ sql: sql.trim(), params });
        if (sql.includes("DELETE FROM users WHERE id = $1")) {
          return { rowCount: 1, rows: [{ id: 42 }] };
        }
        return { rowCount: 1, rows: [] };
      }),
    };

    const mockUser = {
      id: 42,
      email: "student@example.com",
      deletion_date: new Date(Date.now() - 1000).toISOString(),
    };

    const purged = await purgeSingleUser(mockClient, mockUser);
    expect(purged).toBe(true);

    // Verify session deletion
    const sessionDelete = executedQueries.find((q) =>
      q.sql.includes("DELETE FROM user_sessions WHERE user_id = $1"),
    );
    expect(sessionDelete).toBeDefined();
    expect(sessionDelete.params).toEqual([42]);

    // Verify audit logs anonymization (user_id = NULL)
    const auditAnonymize = executedQueries.find(
      (q) =>
        q.sql.includes("UPDATE audit_logs") &&
        q.sql.includes("SET user_id = NULL"),
    );
    expect(auditAnonymize).toBeDefined();

    // Verify user permanent erasure
    const userDelete = executedQueries.find((q) =>
      q.sql.includes("DELETE FROM users WHERE id = $1"),
    );
    expect(userDelete).toBeDefined();
    expect(userDelete.params).toEqual([42]);

    // Verify DPDP Act 2023 compliance audit record written
    const complianceRecord = executedQueries.find(
      (q) =>
        q.sql.includes("INSERT INTO audit_logs") &&
        q.params?.includes("DPDP_ACCOUNT_PURGED"),
    );
    expect(complianceRecord).toBeDefined();
  });
});
