import { describe, it, expect } from "vitest";
import {
  isUserPro,
  getTestAccessType,
  getSeriesAccessType,
  getTestEntitlement,
  getTestBadges,
  resolveTestCtaState,
} from "../shared/utils/entitlement.js";

describe("Central Entitlement Engine", () => {
  const freeUser = { id: "u-1", email: "free@test.com", passType: "free" };
  const proUser = { id: "u-2", email: "pro@test.com", isProUser: true };
  const adminUser = { id: "u-3", email: "admin@test.com", role: "admin" };
  const proPassUser = {
    id: "u-4",
    email: "pass@test.com",
    passType: "pro_monthly",
  };

  const freeTest = { id: "t-1", title: "Free Mock 1", isFree: true };
  const proTest = { id: "t-2", title: "Pro Mock 2", isPro: true };

  const freeSeries = { id: "s-1", title: "Free SSC CGL Series", isFree: true };
  const proSeries = {
    id: "s-2",
    title: "Premium SSC CGL Pro Series",
    isPro: true,
  };

  describe("isUserPro", () => {
    it("returns false for null/undefined user or free user", () => {
      expect(isUserPro(null)).toBe(false);
      expect(isUserPro(freeUser)).toBe(false);
    });

    it("returns true for admin, isProUser, or pro pass users", () => {
      expect(isUserPro(adminUser)).toBe(true);
      expect(isUserPro(proUser)).toBe(true);
      expect(isUserPro(proPassUser)).toBe(true);
    });
  });

  describe("getTestAccessType & getSeriesAccessType", () => {
    it("accurately resolves FREE vs PRO", () => {
      expect(getTestAccessType(freeTest)).toBe("FREE");
      expect(getTestAccessType(proTest)).toBe("PRO");
      expect(getSeriesAccessType(freeSeries)).toBe("FREE");
      expect(getSeriesAccessType(proSeries)).toBe("PRO");
    });
  });

  describe("Series Access ≠ Test Access (Independent Entitlement Matrix)", () => {
    // 1. FREE Series + FREE Test + Free User -> ✅ Can Attempt
    it("Free User can attempt Free Test in Free Series", () => {
      const access = getTestEntitlement({
        test: freeTest,
        user: freeUser,
        series: freeSeries,
      });
      expect(access.canAttempt).toBe(true);
      expect(access.requiresPro).toBe(false);
      expect(access.accessType).toBe("FREE");
    });

    // 2. PRO Series + FREE Test + Free User -> ✅ Can Attempt (CRITICAL: Free test in Pro Series is unlocked)
    it("Free User can attempt Free Test in PRO Series (decoupled entitlement)", () => {
      const access = getTestEntitlement({
        test: freeTest,
        user: freeUser,
        series: proSeries,
      });
      expect(access.canAttempt).toBe(true);
      expect(access.requiresPro).toBe(false);
      expect(access.accessType).toBe("FREE");
    });

    // 3. FREE Series + PRO Test + Free User -> 🔒 Requires Pro
    it("Free User is locked on PRO Test in Free Series", () => {
      const access = getTestEntitlement({
        test: proTest,
        user: freeUser,
        series: freeSeries,
      });
      expect(access.canAttempt).toBe(false);
      expect(access.requiresPro).toBe(true);
      expect(access.accessType).toBe("PRO");
    });

    // 4. PRO Series + PRO Test + Free User -> 🔒 Requires Pro
    it("Free User is locked on PRO Test in Pro Series", () => {
      const access = getTestEntitlement({
        test: proTest,
        user: freeUser,
        series: proSeries,
      });
      expect(access.canAttempt).toBe(false);
      expect(access.requiresPro).toBe(true);
      expect(access.accessType).toBe("PRO");
    });

    // 5. PRO User can attempt both Free & Pro tests in any series
    it("Pro User can attempt all tests in Free or Pro series", () => {
      expect(
        getTestEntitlement({ test: freeTest, user: proUser, series: proSeries })
          .canAttempt,
      ).toBe(true);
      expect(
        getTestEntitlement({ test: proTest, user: proUser, series: proSeries })
          .canAttempt,
      ).toBe(true);
      expect(
        getTestEntitlement({ test: proTest, user: proUser, series: freeSeries })
          .canAttempt,
      ).toBe(true);
    });
  });

  describe("CTA State Resolution", () => {
    it("shows Start Now for Free user on Free test in Pro series", () => {
      const cta = resolveTestCtaState({
        test: freeTest,
        user: freeUser,
        series: proSeries,
        targetTestUrl: "/test/s-2/t-1",
      });
      expect(cta.label).toBe("Start Now");
      expect(cta.requiresPro).toBe(false);
      expect(cta.to).toBe("/test/s-2/t-1");
    });

    it("shows Get Pro Pass for Free user on Pro test in Free series", () => {
      const cta = resolveTestCtaState({
        test: proTest,
        user: freeUser,
        series: freeSeries,
        targetTestUrl: "/test/s-1/t-2",
      });
      expect(cta.label).toBe("👑 Get Pro Pass");
      expect(cta.requiresPro).toBe(true);
      expect(cta.to).toBe("/pass");
    });

    it("shows Login to Unlock for unauthenticated user on Pro test", () => {
      const cta = resolveTestCtaState({
        test: proTest,
        user: null,
        series: freeSeries,
      });
      expect(cta.label).toBe("🔒 Login to Unlock");
      expect(cta.requiresLogin).toBe(true);
      expect(cta.to).toBe("/login");
    });
  });
});
