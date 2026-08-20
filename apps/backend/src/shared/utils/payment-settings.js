const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return Boolean(value);
};

/**
 * Normalize payment settings regardless of whether they came from the JSONB
 * config, an older snake_case save, or environment fallbacks.
 */
export function normalizePaymentSettings(payment = {}) {
  const raw = payment && typeof payment === "object" ? payment : {};
  const taxRate = Number(raw.taxRate ?? raw.tax_rate ?? 0);

  return {
    razorpayKeyId: raw.razorpayKeyId || raw.razorpay_key_id || null,
    razorpayKeySecret: raw.razorpayKeySecret || raw.razorpay_key_secret || null,
    currency: raw.currency || "INR",
    taxEnabled: toBoolean(raw.taxEnabled ?? raw.tax_enabled),
    taxRate: Number.isFinite(taxRate) ? Math.min(100, Math.max(0, taxRate)) : 0,
  };
}

export function applyPaymentTax(amount, paymentSettings = {}) {
  const baseAmount = Math.max(0, Number(amount) || 0);
  const settings = normalizePaymentSettings(paymentSettings);
  const taxAmount =
    settings.taxEnabled && settings.taxRate > 0
      ? Math.round(baseAmount * (settings.taxRate / 100))
      : 0;

  return {
    baseAmount,
    taxAmount,
    finalAmount: baseAmount + taxAmount,
    taxRate: settings.taxEnabled ? settings.taxRate : 0,
  };
}
