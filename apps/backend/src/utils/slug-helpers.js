/**
 * List of all recognized aliases for Previous Year Papers / Questions.
 * This covers short abbreviations, phrasal variations, and SEO-friendly slugs.
 */
const PYP_ALIASES = new Set([
  'pyp', 
  'pyps', 
  'pyq', 
  'pyqs', 
  'prevyear', 
  'prev-year', 
  'prev-years',
  'previousyear', 
  'previousyears',
  'previous-year', 
  'previous-years', 
  'previous-year-papers', 
  'previous-year-questions',
  'previous-year-paper', 
  'previous-year-question',
  'past-papers', 
  'past-paper', 
  'past-year-papers', 
  'solved-papers'
]);

/**
 * Normalizes a slug and checks if it matches any Previous Year Paper (PYP) alias.
 * @param {string} slug - The slug to test
 * @returns {boolean} True if the slug matches a PYP alias
 */
export const isPypSlug = (slug) => {
  if (!slug || typeof slug !== 'string') return false;
  // Convert to lowercase, trim, and normalize underscores to hyphens
  const normalized = slug.toLowerCase().trim().replace(/_/g, '-');
  return PYP_ALIASES.has(normalized);
};
