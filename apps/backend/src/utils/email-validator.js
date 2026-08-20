import dns from "node:dns/promises";
import { isDisposableEmail, DISPOSABLE_DOMAINS } from "./disposable-emails.js";
import logger from "../infrastructure/logger/logger.js";

export { isDisposableEmail, DISPOSABLE_DOMAINS };

export const DEFAULT_ALLOWED_DOMAINS = [
  // Major Global Webmail Providers
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "tuta.com",
  "tutanota.com",
  "zoho.com",
  "zohomail.in",
  "rediffmail.com",
  "aol.com",
  "gmx.com",
  "mail.com",

  // Educational & Institutional TLDs (Wildcards)
  "*.edu",
  "*.ac.in",
  "*.edu.in",
  "*.res.in",
  "*.gov.in",
  "*.ac.uk",
  "*.edu.au",
];

/**
 * Normalizes a list or comma-separated string of allowed domains into an array.
 * @param {string|string[]} config
 * @returns {string[]}
 */
export function parseAllowedDomains(config) {
  if (Array.isArray(config)) {
    return config.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof config === "string") {
    return config
      .split(/[\s,;\n]+/)
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_ALLOWED_DOMAINS;
}

/**
 * Checks whether an email's domain matches the allowed domain list or wildcard pattern.
 * Supports exact domain matches (e.g. `gmail.com`) and wildcard suffixes (e.g. `*.ac.in`, `*.edu`).
 *
 * @param {string} email
 * @param {string|string[]} [allowedDomainsConfig]
 * @returns {boolean}
 */
export function isDomainAllowed(
  email,
  allowedDomainsConfig = DEFAULT_ALLOWED_DOMAINS,
) {
  if (!email || typeof email !== "string") return false;
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1].trim();
  if (!domain) return false;

  const allowedList = parseAllowedDomains(allowedDomainsConfig);
  if (allowedList.length === 0 || allowedList.includes("*")) {
    return true;
  }

  for (const pattern of allowedList) {
    if (!pattern) continue;

    // Exact domain match (e.g. `gmail.com` == `gmail.com`)
    if (pattern === domain) {
      return true;
    }

    // Wildcard suffix match (e.g. `*.ac.in` matches `iitb.ac.in` and `dept.du.ac.in`)
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(2); // remove `*.`
      if (domain === suffix || domain.endsWith("." + suffix)) {
        return true;
      }
    }

    // Wildcard prefix match (e.g. `.edu` matches `harvard.edu`)
    if (pattern.startsWith(".")) {
      const suffix = pattern.slice(1);
      if (domain.endsWith("." + suffix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Real-time DNS MX (Mail Exchange) verification.
 * Checks whether the domain exists on DNS and has at least one active MX record
 * capable of receiving incoming email.
 *
 * @param {string} email
 * @param {number} [timeoutMs=2500]
 * @returns {Promise<{ isValid: boolean, reason?: string }>}
 */
export async function verifyDomainHasMx(email, timeoutMs = 2500) {
  if (!email || typeof email !== "string") {
    return { isValid: false, reason: "Invalid email address" };
  }
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) {
    return { isValid: false, reason: "Invalid email format" };
  }
  const domain = parts[1].trim();
  if (!domain) {
    return { isValid: false, reason: "Missing domain" };
  }

  // Fast skip for known localhost / invalid domains
  if (
    domain === "localhost" ||
    domain.endsWith(".local") ||
    domain.endsWith(".invalid")
  ) {
    return { isValid: false, reason: "Invalid top-level domain" };
  }

  try {
    let timer;
    const mxLookup = dns.resolveMx(domain);
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("DNS_LOOKUP_TIMEOUT")),
        timeoutMs,
      );
      if (timer?.unref) timer.unref();
    });

    const records = await Promise.race([mxLookup, timeoutPromise]);
    if (timer) clearTimeout(timer);

    if (Array.isArray(records) && records.length > 0) {
      // Filter out null MX or localhost MX entries
      const validRecords = records.filter(
        (r) =>
          r.exchange &&
          r.exchange !== "." &&
          r.exchange !== "0.0.0.0" &&
          r.exchange !== "127.0.0.1",
      );
      if (validRecords.length > 0) {
        return { isValid: true };
      }
    }

    return {
      isValid: false,
      reason: "Domain has no active mail exchange (MX) servers",
    };
  } catch (err) {
    if (
      err.message === "DNS_LOOKUP_TIMEOUT" ||
      err.code === "ECONNREFUSED" ||
      err.code === "EREFUSED" ||
      err.code === "ETIMEOUT"
    ) {
      logger.warn(
        `[EmailValidator] DNS MX check bypassed for domain: ${domain} (${err.code || err.message})`,
      );
      // Fail-open on DNS server unavailability / timeout so offline environments and network hiccups don't block users
      return { isValid: true };
    }

    if (err.code === "ENODATA" || err.code === "ENOTFOUND") {
      logger.info(
        `[EmailValidator] DNS MX lookup failed for ${domain}: ${err.code}`,
      );
      return {
        isValid: false,
        reason: "Email domain does not exist or cannot receive email",
      };
    }

    logger.info(
      `[EmailValidator] DNS MX lookup error for ${domain}: ${err.code || err.message}`,
    );
    return {
      isValid: false,
      reason: "Email domain does not exist or cannot receive email",
    };
  }
}
