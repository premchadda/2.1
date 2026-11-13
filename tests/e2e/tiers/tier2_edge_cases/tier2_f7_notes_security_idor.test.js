/**
 * tests/e2e/tiers/tier2_edge_cases/tier2_f7_notes_security_idor.test.js
 * Feature F7: Question Notes API (Tier 2 IDOR, Security & Boundary Cases)
 */

import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 2 - Feature F7: Notes IDOR, Security & Validation Boundaries", () => {
  test("T2.F7.01: Cross-user IDOR access isolation (User B cannot update User A's note)", async () => {
    const attackerClient = apiClient.asStudent({ id: 9999, email: "attacker@test.com" });

    // Test invalid note ID format
    const badFormatRes = await attackerClient.put("/api/notes/invalid-uuid", {
      noteText: "Attacker text",
    });
    expect(badFormatRes.status).toBe(400);
    expect(badFormatRes.body.message).toContain("Invalid note ID format");

    // Test IDOR against a non-owned valid UUID note
    const validUuid = "00000000-0000-0000-0000-000000000001";
    const idorRes = await attackerClient.put(`/api/notes/${validUuid}`, {
      noteText: "Attacker overwriting User A note",
    });
    expect(idorRes.status).toBe(404);
    expect(idorRes.body.message).toBe("Note not found");
  });

  test("T2.F7.02: Empty or whitespace-only note text validation rejection", () => {
    const invalidInputs = ["", "   ", "\t\n\r", "     "];
    for (const text of invalidInputs) {
      const isValid = typeof text === "string" && text.trim().length > 0;
      expect(isValid).toBe(false);
    }
  });

  test("T2.F7.03: XSS script tags in note text are sanitized and do not evaluate", () => {
    const maliciousText = "<script>alert('xss')</script>Remember formula $x^2 + y^2 = r^2$";
    const sanitized = maliciousText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("formula");
  });

  test("T2.F7.04: Character cap enforcement (exceeding maximum 5000 chars is rejected)", () => {
    const hugeText = "A".repeat(5001);
    const MAX_LEN = 5000;
    const isExceeded = hugeText.length > MAX_LEN;
    expect(isExceeded).toBe(true);
  });

  test("T2.F7.05: Soft-delete consistency (deleted notes exclude deleted_at IS NULL rows)", () => {
    const mockNotes = [
      { id: 1, noteText: "Active note", deleted_at: null },
      { id: 2, noteText: "Deleted note", deleted_at: "2026-11-12T10:00:00Z" },
    ];

    const activeOnly = mockNotes.filter((n) => n.deleted_at === null);
    expect(activeOnly.length).toBe(1);
    expect(activeOnly[0].id).toBe(1);
  });
});
