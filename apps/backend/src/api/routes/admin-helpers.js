import { pool } from "../../infrastructure/database/postgres-helpers.js";

const MAX_ADMIN_PAGE_SIZE = 200;
export const parsePagination = (query) => {
  const rawLimit = Number(query?.limit);
  const rawOffset = Number(query?.offset);
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 100, 1),
    MAX_ADMIN_PAGE_SIZE,
  );
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
  return { limit, offset };
};
export const paginateResponse = (rows, limit, offset) => ({
  data: rows,
  pagination: {
    limit,
    offset,
    count: rows.length,
    hasMore: rows.length === limit,
  },
});

export const IS_SERVERLESS = !!(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NETLIFY ||
  process.env.SERVERLESS === "1"
);

export const rejectOnServerless = (req, res, next) => {
  if (IS_SERVERLESS) {
    return res.status(501).json({
      success: false,
      message: "Backups are not supported on serverless platforms",
      code: "BACKUPS_UNSUPPORTED"
    });
  }
  next();
};

// Fetch the current Pro Pass price from the subscription_plans table.
// Falls back to 999 only if the table/query fails (e.g. not yet seeded).
export async function getProPassPrice() {
  try {
    const result = await pool.query(
      `SELECT price FROM subscription_plans
       WHERE plan_id LIKE 'pro_pass%' OR plan_id LIKE 'pro-%'
       ORDER BY price ASC LIMIT 1`
    );
    if (result.rows.length > 0) {
      return parseFloat(result.rows[0].price) || 999;
    }
  } catch {
    // Table may not exist yet — non-fatal
  }
  return 999;
}
