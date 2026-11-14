// @vitest-environment happy-dom
import { describe, test, expect } from "vitest";
import { isValidApiEndpoint, fetchFromAPI } from "../apiClient.js";
import { isSafeImageUrl } from "../sanitizeHtml.js";
import { DataService } from "../dataService.js";

describe("Admin Panel Security & apiClient Validation", () => {
  describe("isValidApiEndpoint", () => {
    test("allows safe relative paths", () => {
      expect(isValidApiEndpoint("/admin/users")).toBe(true);
      expect(isValidApiEndpoint("/api/tests/123")).toBe(true);
      expect(isValidApiEndpoint("/study-materials?tab=curriculum")).toBe(true);
    });

    test("rejects protocol-relative URLs (SSRF / open-redirect protection)", () => {
      expect(isValidApiEndpoint("//attacker.com/api")).toBe(false);
      expect(isValidApiEndpoint("/\\attacker.com/api")).toBe(false);
      expect(isValidApiEndpoint("\\\\attacker.com/api")).toBe(false);
      expect(isValidApiEndpoint("\\/attacker.com/api")).toBe(false);
    });

    test("rejects non-leading-slash endpoints and invalid inputs", () => {
      expect(isValidApiEndpoint("admin/users")).toBe(false);
      expect(isValidApiEndpoint("https://attacker.com")).toBe(false);
      expect(isValidApiEndpoint(null)).toBe(false);
      expect(isValidApiEndpoint(undefined)).toBe(false);
      expect(isValidApiEndpoint("")).toBe(false);
    });
  });

  describe("isSafeImageUrl", () => {
    test("allows safe relative image paths", () => {
      expect(isSafeImageUrl("/uploads/avatar.png")).toBe(true);
      expect(isSafeImageUrl("./assets/logo.jpg")).toBe(true);
    });

    test("rejects protocol-relative and backslash URLs", () => {
      expect(isSafeImageUrl("//attacker.com/evil.png")).toBe(false);
      expect(isSafeImageUrl("/\\attacker.com/evil.png")).toBe(false);
      expect(isSafeImageUrl("\\\\attacker.com/evil.png")).toBe(false);
    });

    test("allows safe raster data URIs", () => {
      expect(
        isSafeImageUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="),
      ).toBe(true);
      expect(isSafeImageUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(
        true,
      );
      expect(isSafeImageUrl("data:image/webp;base64,UklGR==")).toBe(true);
    });

    test("strictly blocks SVG data URIs (XSS protection)", () => {
      expect(
        isSafeImageUrl("data:image/svg+xml;utf8,<svg onload=alert(1)>"),
      ).toBe(false);
      expect(isSafeImageUrl("data:image/svg;base64,PHN2Zz4=")).toBe(false);
    });

    test("allows safe absolute http/https URLs and blocks javascript:", () => {
      expect(isSafeImageUrl("https://cdn.trstprep.com/images/banner.jpg")).toBe(
        true,
      );
      expect(isSafeImageUrl("http://cdn.trstprep.com/images/banner.jpg")).toBe(
        true,
      );
      expect(isSafeImageUrl("javascript:alert(1)")).toBe(false);
    });
  });

  describe("fetchFromAPI endpoint validation", () => {
    test("throws ValidationError for invalid/protocol-relative endpoint", async () => {
      await expect(fetchFromAPI("//attacker.com/api")).rejects.toThrow(
        "Invalid API endpoint",
      );
      await expect(fetchFromAPI("no-slash-endpoint")).rejects.toThrow(
        "Invalid API endpoint",
      );
    });
  });

  describe("DataService in-flight deduplication", () => {
    test("coalesces concurrent requests to the same key into a single execution", async () => {
      const dataService = new DataService();
      let callCount = 0;
      const slowFetcher = async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { success: true, count: callCount };
      };

      const [res1, res2, res3] = await Promise.all([
        dataService.fetchWithCache("test_key", slowFetcher, {
          useCache: false,
        }),
        dataService.fetchWithCache("test_key", slowFetcher, {
          useCache: false,
        }),
        dataService.fetchWithCache("test_key", slowFetcher, {
          useCache: false,
        }),
      ]);

      expect(callCount).toBe(1);
      expect(res1).toEqual({ success: true, count: 1 });
      expect(res2).toEqual({ success: true, count: 1 });
      expect(res3).toEqual({ success: true, count: 1 });
    });
  });
});
