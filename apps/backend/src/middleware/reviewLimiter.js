import { createRateLimiter } from "./rateLimiterFactory.js";

// Shared review-submission limiter (single "moderate" bucket).
// Lives here (not in admin-questions.js) so both the canonical admin routes
// and the managed question.controller share one instance without a
// route<->controller circular import.
export const reviewSubmissionLimiter = createRateLimiter("moderate");
export default reviewSubmissionLimiter;
