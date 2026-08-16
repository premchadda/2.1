/**
 * Money helpers — avoid floating-point errors on currency math (M8).
 *
 * Indian Rupee amounts are stored/transmitted as decimal numbers (e.g. 499.00)
 * but all arithmetic here is done in integer paise to dodge binary float
 * rounding (e.g. 0.1 + 0.2 !== 0.3). Razorpay expects amount in paise for
 * order creation and returns paise in webhooks.
 */

const toPaise = (amount) => {
  const n = Math.round(Number(amount) * 100);
  return Number.isFinite(n) ? n : 0;
};

const fromPaise = (paise) => Math.round(Number(paise)) / 100;

/**
 * Apply a percentage discount (with optional max cap) using integer paise math.
 * @param {number} amountRupees - base amount in rupees
 * @param {number} percent - discount percentage (0-100)
 * @param {number} [maxDiscountRupees=0] - optional cap in rupees
 * @returns {{ discountRupees: number, finalRupees: number }}
 */
const applyPercentageDiscount = (amountRupees, percent, maxDiscountRupees = 0) => {
  const base = toPaise(amountRupees);
  const discountPaise = Math.round((base * Number(percent)) / 100);
  const cappedPaise = maxDiscountRupees > 0
    ? Math.min(discountPaise, toPaise(maxDiscountRupees))
    : discountPaise;
  const finalPaise = Math.max(0, base - cappedPaise);
  return {
    discountRupees: fromPaise(cappedPaise),
    finalRupees: fromPaise(finalPaise),
  };
};

export { toPaise, fromPaise, applyPercentageDiscount };
