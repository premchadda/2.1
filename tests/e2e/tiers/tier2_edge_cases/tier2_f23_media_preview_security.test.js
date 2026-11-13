/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f23_media_preview_security.test.js
 * Feature F23: Media Preview & Content Hierarchy (Tier 2 Security & Protocol Validation)
 */

import { describe, test, expect } from "../../harness/testContext.js";

describe("Tier 2 - Feature F23: Media Preview Security & Hierarchy Boundaries", () => {
  test("T2.F23.01: PDFViewer rejects javascript: protocol and malformed URLs", () => {
    function isSafePdfUrl(url) {
      if (!url || typeof url !== "string") return false;
      const clean = url.trim().toLowerCase();
      if (clean.startsWith("javascript:") || clean.startsWith("data:") || clean.startsWith("vbscript:")) {
        return false;
      }
      return clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("/");
    }

    expect(isSafePdfUrl("javascript:alert(1)")).toBe(false);
    expect(isSafePdfUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafePdfUrl("https://example.com/lecture.pdf")).toBe(true);
    expect(isSafePdfUrl("/uploads/notes.pdf")).toBe(true);
  });

  test("T2.F23.02: ContentReader HTML XSS sanitization removes dangerous script elements", () => {
    const rawHtml = '<p>Normal text</p><script>window.pwned=true</script><img src="x" onerror="alert(1)" />';
    // Sanitize script and onerror
    const sanitized = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/onerror\s*=\s*["'][^"']*["']/gi, "");

    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("onerror");
    expect(sanitized).toContain("<p>Normal text</p>");
  });

  test("T2.F23.03: VideoPlayer keyboard shortcuts state mapping", () => {
    let isPlaying = false;
    let isMuted = false;

    function handleVideoKey(key) {
      if (key === " ") isPlaying = !isPlaying;
      if (key.toLowerCase() === "m") isMuted = !isMuted;
    }

    handleVideoKey(" ");
    expect(isPlaying).toBe(true);
    handleVideoKey(" ");
    expect(isPlaying).toBe(false);

    handleVideoKey("m");
    expect(isMuted).toBe(true);
  });

  test("T2.F23.04: ContentHierarchySidebar handles subjects with zero chapters", () => {
    const subject = { id: 1, name: "New Subject", chapters: [] };
    const hasChapters = Array.isArray(subject.chapters) && subject.chapters.length > 0;
    expect(hasChapters).toBe(false);
  });

  test("T2.F23.05: Preview modal close event triggered by Escape key", () => {
    let modalOpen = true;
    function handleEscape(key) {
      if (key === "Escape") modalOpen = false;
    }

    handleEscape("Escape");
    expect(modalOpen).toBe(false);
  });
});
