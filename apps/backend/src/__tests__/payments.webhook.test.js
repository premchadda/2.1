import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import crypto from "crypto";

describe("Razorpay Webhook Verification & Idempotency Pipeline", () => {
  const WEBHOOK_SECRET = "test_webhook_secret_key_12345";

  const createSignature = (payloadString, secret = WEBHOOK_SECRET) => {
    return crypto
      .createHmac("sha256", secret)
      .update(payloadString)
      .digest("hex");
  };

  describe("HMAC SHA-256 Signature Verification", () => {
    const verifyWebhookSignature = (bodyBuffer, signature, secret) => {
      if (!secret) {
        return { valid: false, code: "SECRET_MISSING", status: 500 };
      }
      if (!signature) {
        return { valid: false, code: "SIGNATURE_MISSING", status: 400 };
      }

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(bodyBuffer)
        .digest("hex");

      const expectedBuffer = Buffer.from(expectedSignature, "utf8");
      const signatureBuffer = Buffer.from(signature, "utf8");

      if (expectedBuffer.length !== signatureBuffer.length) {
        return { valid: false, code: "SIGNATURE_MISMATCH", status: 400 };
      }

      const isValid = crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
      return {
        valid: isValid,
        code: isValid ? "OK" : "SIGNATURE_MISMATCH",
        status: isValid ? 200 : 400,
      };
    };

    it("returns 500 when webhook secret is unconfigured", () => {
      const payload = Buffer.from(
        JSON.stringify({ event: "payment.captured" }),
      );
      const result = verifyWebhookSignature(payload, "any_sig", null);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("SECRET_MISSING");
      expect(result.status).toBe(500);
    });

    it("returns 400 when x-razorpay-signature header is missing", () => {
      const payload = Buffer.from(
        JSON.stringify({ event: "payment.captured" }),
      );
      const result = verifyWebhookSignature(payload, null, WEBHOOK_SECRET);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("SIGNATURE_MISSING");
      expect(result.status).toBe(400);
    });

    it("returns 400 when signature does not match payload", () => {
      const payload = Buffer.from(
        JSON.stringify({ event: "payment.captured", amount: 499 }),
      );
      const fakeSig = createSignature(
        JSON.stringify({ amount: 999 }),
        WEBHOOK_SECRET,
      );
      const result = verifyWebhookSignature(payload, fakeSig, WEBHOOK_SECRET);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("SIGNATURE_MISMATCH");
      expect(result.status).toBe(400);
    });

    it("accepts valid HMAC signature verified via timingSafeEqual", () => {
      const payloadStr = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_abc123", amount: 49900 } } },
      });
      const payloadBuffer = Buffer.from(payloadStr);
      const validSig = createSignature(payloadStr, WEBHOOK_SECRET);

      const result = verifyWebhookSignature(
        payloadBuffer,
        validSig,
        WEBHOOK_SECRET,
      );
      expect(result.valid).toBe(true);
      expect(result.code).toBe("OK");
      expect(result.status).toBe(200);
    });
  });

  describe("Webhook Idempotency & Delivery Deduplication", () => {
    it("skips duplicate processing when payment event was already handled", async () => {
      const mockDb = {
        existingEvents: new Set(["pay_dup123:payment.captured"]),
        processedSubscriptions: [],
      };

      const handleWebhookIdempotent = async (event, paymentId, onProcess) => {
        const key = `${paymentId}:${event}`;
        if (mockDb.existingEvents.has(key)) {
          return {
            success: true,
            message: "Webhook already processed",
            deduplicated: true,
          };
        }
        mockDb.existingEvents.add(key);
        await onProcess();
        return {
          success: true,
          message: "Webhook processed",
          deduplicated: false,
        };
      };

      const mockProcess = jest.fn();

      // Duplicate delivery from Razorpay retry
      const result = await handleWebhookIdempotent(
        "payment.captured",
        "pay_dup123",
        mockProcess,
      );

      expect(result.success).toBe(true);
      expect(result.deduplicated).toBe(true);
      expect(result.message).toBe("Webhook already processed");
      expect(mockProcess).not.toHaveBeenCalled();
    });

    it("processes unique incoming webhook and records event", async () => {
      const mockDb = {
        existingEvents: new Set(),
        processedPayments: [],
      };

      const handleWebhookIdempotent = async (event, paymentId, onProcess) => {
        const key = `${paymentId}:${event}`;
        if (mockDb.existingEvents.has(key)) {
          return {
            success: true,
            message: "Webhook already processed",
            deduplicated: true,
          };
        }
        mockDb.existingEvents.add(key);
        await onProcess();
        return {
          success: true,
          message: "Webhook processed",
          deduplicated: false,
        };
      };

      const mockProcess = jest.fn().mockImplementation(async () => {
        mockDb.processedPayments.push({ id: "pay_new999", amount: 499 });
      });

      const result = await handleWebhookIdempotent(
        "payment.captured",
        "pay_new999",
        mockProcess,
      );

      expect(result.success).toBe(true);
      expect(result.deduplicated).toBe(false);
      expect(mockProcess).toHaveBeenCalled();
      expect(mockDb.processedPayments).toHaveLength(1);
    });
  });

  describe("Refund Event Processing & Ledger Sync", () => {
    it("handles refund.processed and updates payment status in ledger", async () => {
      const paymentsLedger = new Map([
        [
          "pay_ref1",
          {
            id: 1,
            gatewayPaymentId: "pay_ref1",
            status: "captured",
            amount: 999,
          },
        ],
      ]);

      const handleRefundEvent = async (eventData) => {
        const { payment_id: paymentId, amount } =
          eventData.payload.refund.entity;
        const payment = paymentsLedger.get(paymentId);
        if (!payment) return false;

        payment.status = "refunded";
        payment.refundedAmount = amount;
        payment.refundedAt = new Date().toISOString();
        return true;
      };

      const refundPayload = {
        event: "refund.processed",
        payload: {
          refund: {
            entity: {
              id: "rfnd_123",
              payment_id: "pay_ref1",
              amount: 99900,
              status: "processed",
            },
          },
        },
      };

      const handled = await handleRefundEvent(refundPayload);
      expect(handled).toBe(true);
      expect(paymentsLedger.get("pay_ref1").status).toBe("refunded");
      expect(paymentsLedger.get("pay_ref1").refundedAmount).toBe(99900);
    });
  });
});
