import {
  encryptValue,
  decryptValue,
} from "../infrastructure/database/postgres-helpers.js";

describe("PII Encryption & Decryption", () => {
  it("should encrypt and decrypt values correctly", () => {
    const rawValue = "9876543210";
    const encrypted = encryptValue(rawValue);

    expect(encrypted).toContain(":");
    expect(encrypted).not.toBe(rawValue);

    const decrypted = decryptValue(encrypted);
    expect(decrypted).toBe(rawValue);
  });

  it("should return null or undefined as is", () => {
    expect(encryptValue(null)).toBeNull();
    expect(encryptValue(undefined)).toBeUndefined();
    expect(decryptValue(null)).toBeNull();
    expect(decryptValue(undefined)).toBeUndefined();
  });

  it("should handle unencrypted legacy values gracefully by returning them directly", () => {
    const legacy = "unencrypted-value";
    expect(decryptValue(legacy)).toBe(legacy);
  });
});
