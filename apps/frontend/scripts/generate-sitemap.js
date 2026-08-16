import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const siteUrl = process.env.VITE_SITE_URL || 'https://trstprep.com';

// Main static routes. Dynamic/listing routes (exams, tests, blog) are
// included as their index pages; paginated/query variants are intentionally
// excluded so crawlers consolidate on the canonical listing URLs.
const routes = [
  '/',
  '/login',
  '/signup',
  '/about',
  '/blog',
  '/contact',
  '/faq',
  '/terms',
  '/privacy',
  '/refund',
  '/exams',
  '/tests',
  '/dashboard',
  '/pricing',
  '/features',
  '/careers',
];

const urlset = routes
  .map(
    (route) =>
      `  <url>\n    <loc>${siteUrl}${route}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${route === '/' ? '1.0' : '0.8'}</priority>\n  </url>`
  )
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset}
</urlset>
`;

const outPath = resolve(__dirname, '..', 'public', 'sitemap.xml');
writeFileSync(outPath, sitemap, 'utf-8');

console.log(`Sitemap written to ${outPath} with ${routes.length} URLs (site: ${siteUrl})`);
