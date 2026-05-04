const staticEndpoints = [
  '/api/test-series',
  '/api/videos',
  '/api/subscription-plans',
  '/api/exam-categories',
];

const cacheControl = (req, res, next) => {
  const path = req.path;

  if (path.startsWith('/api/users/')) {
    res.set('Cache-Control', 'no-cache');
  } else if (staticEndpoints.includes(path)) {
    res.set('Cache-Control', 'public, max-age=300');
  }

  next();
};

export default cacheControl;
