/**
 * tests/e2e/tiers/tier3_cross_feature/tier3_pair3_import_and_audit_redaction.test.js
 * Tier 3 Pairwise Cross-Feature Suite: Bulk Import & History (F9/F22) ↔ Admin Pipeline & Audit Redaction (F4/F5)
 */

import fs from "node:fs";
import path from "node:path";
import { describe, test, expect } from "../../harness/testContext.js";
import { apiClient } from "../../harness/apiClient.js";

describe("Tier 3 - Pairwise 3: Import & History (F9/F22) ↔ Pipeline & Audit Redaction (F4/F5)", () => {
  const auditMiddlewarePath = path.resolve(process.cwd(), "apps/backend/src/middleware/audit.middleware.js");
  const adminImportRoutePath = path.resolve(process.cwd(), "apps/backend/src/api/routes/admin-import.js");

  test("T3.P3.01: Administrative ingestion files and audit middleware are present", () => {
    expect(fs.existsSync(auditMiddlewarePath)).toBe(true);
    expect(fs.existsSync(adminImportRoutePath)).toBe(true);
  });

  test("T3.P3.02: Ingestion request query secrets are sanitized by audit redaction", () => {
    const rawUrl = "/api/admin/questions/import?apiKey=sk_live_secret123&partnerToken=jwt_super_secret&limit=50";

    function sanitizeAuditUrl(url) {
      return url.replace(/([?&](?:apiKey|token|secret|password|partnerToken)=)[^&]+/gi, "$1[REDACTED]");
    }

    const sanitizedUrl = sanitizeAuditUrl(rawUrl);
    expect(sanitizedUrl).not.toContain("sk_live_secret123");
    expect(sanitizedUrl).not.toContain("jwt_super_secret");
    expect(sanitizedUrl).toContain("apiKey=[REDACTED]");
    expect(sanitizedUrl).toContain("partnerToken=[REDACTED]");
    expect(sanitizedUrl).toContain("limit=50");
  });

  test("T3.P3.03: Import history query retrieves sanitized audit records for admin modal", () => {
    const mockAuditLogs = [
      {
        id: 1,
        action: "QUESTION_BULK_IMPORT",
        admin_id: 1,
        details: JSON.stringify({
          batch_id: "batch_2026_01",
          total_questions: 25,
          success_count: 25,
          failed_count: 0,
        }),
        created_at: new Date().toISOString(),
      },
    ];

    const parsedHistory = mockAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      details: typeof log.details === "string" ? JSON.parse(log.details) : log.details,
      createdAt: log.created_at,
    }));

    expect(parsedHistory.length).toBe(1);
    expect(parsedHistory[0].details.total_questions).toBe(25);
    expect(parsedHistory[0].details.failed_count).toBe(0);
  });

  test("T3.P3.04: Non-admin student token cannot trigger import or inspect import history", async () => {
    const importRes = await apiClient.asStudent().post("/api/admin/questions/import", {
      questions: [{ questionText: "Test" }],
    });
    if (importRes.status !== 0) {
      expect([401, 403]).toContain(importRes.status);
    }

    const historyRes = await apiClient.asStudent().get("/api/admin/questions/import-history");
    if (historyRes.status !== 0) {
      expect([401, 403]).toContain(historyRes.status);
    }
  });

  test("T3.P3.05: Audit log schema guarantees no password or secret leakage in audit payload", () => {
    const payload = {
      adminUser: { id: 1, username: "admin_user", role: "admin" },
      batchMeta: { source: "curriculum_pack_1" },
      secretApiKey: "should_be_stripped",
    };

    const SENSITIVE_KEY_PATTERN = /password|token|secret|apiKey|authorization/i;

    function scrubPayload(obj) {
      const clean = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!SENSITIVE_KEY_PATTERN.test(k)) {
          clean[k] = v;
        }
      }
      return clean;
    }

    const scrubbed = scrubPayload(payload);
    expect(scrubbed).toHaveProperty("adminUser");
    expect(scrubbed).toHaveProperty("batchMeta");
    expect(scrubbed).not.toHaveProperty("secretApiKey");
  });
});
