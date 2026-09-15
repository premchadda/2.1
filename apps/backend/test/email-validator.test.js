import { jest, describe, it, expect } from "@jest/globals";
import dns from "node:dns/promises";
import {
  isDomainAllowed,
  parseAllowedDomains,
  verifyDomainHasMx,
  DEFAULT_ALLOWED_DOMAINS,
} from "../src/utils/email-validator.js";

describe("Email Domain Allowlist Validator", () => {
  it("should allow standard public webmail providers by default", () => {
    expect(isDomainAllowed("student@gmail.com")).toBe(true);
    expect(isDomainAllowed("user@outlook.com")).toBe(true);
    expect(isDomainAllowed("test@yahoo.co.in")).toBe(true);
    expect(isDomainAllowed("person@proton.me")).toBe(true);
    expect(isDomainAllowed("user@icloud.com")).toBe(true);
  });

  it("should allow academic and institutional domains matching wildcard patterns (*.ac.in, *.edu)", () => {
    expect(isDomainAllowed("scholar@iitb.ac.in")).toBe(true);
    expect(isDomainAllowed("student@cs.du.ac.in")).toBe(true);
    expect(isDomainAllowed("researcher@mit.edu")).toBe(true);
    expect(isDomainAllowed("candidate@ox.ac.uk")).toBe(true);
  });

  it("should reject unlisted domains when allowlist is provided", () => {
    const customList = "gmail.com, yahoo.com, *.ac.in";
    expect(isDomainAllowed("user@gmail.com", customList)).toBe(true);
    expect(isDomainAllowed("user@iitd.ac.in", customList)).toBe(true);
    expect(isDomainAllowed("user@unlisted-corp.com", customList)).toBe(false);
    expect(isDomainAllowed("user@spammer.xyz", customList)).toBe(false);
  });

  it("should support asterisk wildcard to allow all domains", () => {
    expect(isDomainAllowed("user@anydomain.com", "*")).toBe(true);
    expect(isDomainAllowed("user@anydomain.com", ["*"])).toBe(true);
  });

  it("should parse comma, space, and newline-separated domain lists", () => {
    const config = "gmail.com, outlook.com\nyahoo.com; *.edu";
    const parsed = parseAllowedDomains(config);
    expect(parsed).toContain("gmail.com");
    expect(parsed).toContain("outlook.com");
    expect(parsed).toContain("yahoo.com");
    expect(parsed).toContain("*.edu");
  });
});

describe("DNS MX Record Verification", () => {
  it("should verify domains with active MX records", async () => {
    const spy = jest
      .spyOn(dns, "resolveMx")
      .mockResolvedValueOnce([
        { exchange: "gmail-smtp-in.l.google.com", priority: 5 },
      ]);

    const result = await verifyDomainHasMx("test@gmail.com");
    expect(result.isValid).toBe(true);
    spy.mockRestore();
  });

  it("should reject domains when DNS returns empty MX list or ENOTFOUND", async () => {
    const err = new Error("getaddrinfo ENOTFOUND");
    err.code = "ENOTFOUND";
    const spy = jest.spyOn(dns, "resolveMx").mockRejectedValueOnce(err);

    const result = await verifyDomainHasMx(
      "user@thisdomaindoesnotexist99118822.xyz",
    );
    expect(result.isValid).toBe(false);
    expect(result.reason).toBeDefined();
    spy.mockRestore();
  });

  it("should fail-open gracefully when DNS server times out or is unreachable", async () => {
    const err = new Error("connect ECONNREFUSED");
    err.code = "ECONNREFUSED";
    const spy = jest.spyOn(dns, "resolveMx").mockRejectedValueOnce(err);

    const result = await verifyDomainHasMx("user@gmail.com");
    expect(result.isValid).toBe(true);
    spy.mockRestore();
  });

  it("should handle malformed email addresses gracefully", async () => {
    const result1 = await verifyDomainHasMx("notanemail");
    expect(result1.isValid).toBe(false);

    const result2 = await verifyDomainHasMx("");
    expect(result2.isValid).toBe(false);
  });
});
