/**
 * Route Index — mounts all extracted public routes.
 * These routes were formerly inline in app-port5001.js (MAINT-03).
 */
import searchPublicRoutes from './search-public.js';
import examsPublicRoutes from './exams-public.js';
import videosPublicRoutes from './videos-public.js';
import subscriptionPlansPublicRoutes from './subscription-plans-public.js';
import leaderboardsPublicRoutes from './leaderboards-public.js';
import testSeriesPublicRoutes from './test-series-public.js';
import liveTestsPublicRoutes from './live-tests-public.js';
import currentAffairsPublicRoutes from './current-affairs-public.js';
import pypPublicRoutes from './pyp-public.js';
import publicStatsRoutes from './public-stats.js';
import testimonialsPublicRoutes from './testimonials-public.js';
import practiceQuestionsPublicRoutes from './practice-questions-public.js';

/**
 * Mount all extracted public routes on the Express app.
 * @param {import('express').Express} app
 */
export function mountExtractedRoutes(app) {
  app.use('/api/search', searchPublicRoutes);
  app.use('/api/exams', examsPublicRoutes);
  app.use('/api/videos', videosPublicRoutes);
  app.use('/api/subscription-plans', subscriptionPlansPublicRoutes);
  app.use('/api/leaderboards', leaderboardsPublicRoutes);
  app.use('/api/test-series', testSeriesPublicRoutes);
  app.use('/api/live-tests', liveTestsPublicRoutes);
  app.use('/api/current-affairs', currentAffairsPublicRoutes);
  app.use('/api/previous-year-papers', pypPublicRoutes);
  app.use('/api/public-stats', publicStatsRoutes);
  app.use('/api/testimonials', testimonialsPublicRoutes);
  app.use('/api/practice-questions', practiceQuestionsPublicRoutes);
}
