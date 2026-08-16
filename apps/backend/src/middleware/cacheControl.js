// PERF-05: Per-route cache-control headers based on data volatility.
const staticEndpoints = [
  '/api/test-series',
  '/api/videos',
  '/api/subscription-plans',
  '/api/exam-categories',
  '/api/public-stats',
  '/api/testimonials',
];

const noCacheEndpoints = [
  '/api/users/',
  '/api/me',
  '/api/sessions',
  '/api/auth/',
];

const cacheControl = (req, res, next) => {
  const path = req.path;

  // User-specific data — never cache
  if (noCacheEndpoints.some((prefix) => path.startsWith(prefix))) {
    res.set('Cache-Control', 'no-store');
  }
  // Rarely-changing public data — cache for 5 minutes. Match the endpoint or
  // any of its sub-paths (e.g. /api/test-series/123, not just the exact path).
  else if (staticEndpoints.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    res.set('Cache-Control', 'public, max-age=300');
  }

  next();
};

export default cacheControl;
