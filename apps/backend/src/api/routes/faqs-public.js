import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

// @route   GET /api/faqs
// @desc    Get active public FAQs
// @access  Public
router.get("/", responseCache("public-faqs", 300), async (req, res) => {
  try {
    const faqs = await dbHelpers.find("faqs", { isActive: true });
    // Sort by order_index or id if available
    faqs.sort(
      (a, b) =>
        (a.orderIndex ?? a.order_index ?? 0) -
        (b.orderIndex ?? b.order_index ?? 0),
    );
    res.json({ success: true, data: faqs, count: faqs.length });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
