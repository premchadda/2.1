import { describe, expect, it } from "@jest/globals";
import {
  applyPaymentTax,
  normalizePaymentSettings,
} from "../shared/utils/payment-settings.js";

describe("payment settings runtime behavior", () => {
  it("normalizes snake_case and string values from persisted settings", () => {
    expect(
      normalizePaymentSettings({
        tax_enabled: "true",
        tax_rate: "18",
        razorpay_key_id: "key_from_db",
      }),
    ).toEqual({
      razorpayKeyId: "key_from_db",
      razorpayKeySecret: null,
      currency: "INR",
      taxEnabled: true,
      taxRate: 18,
    });
  });

  it("applies tax to the discounted amount only when enabled", () => {
    expect(applyPaymentTax(99, { taxEnabled: true, taxRate: 18 })).toEqual({
      baseAmount: 99,
      taxAmount: 18,
      finalAmount: 117,
      taxRate: 18,
    });
    expect(applyPaymentTax(99, { taxEnabled: false, taxRate: 18 })).toEqual({
      baseAmount: 99,
      taxAmount: 0,
      finalAmount: 99,
      taxRate: 0,
    });
  });
});
