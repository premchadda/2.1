import { Helmet } from "react-helmet-async";
import { usePublicSettings } from "../hooks/usePublicSettings";

/**
 * Reusable SEO component for standard meta, Open Graph, Twitter Cards,
 * Canonical URL, and structured data (JSON-LD) generation.
 *
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {string} props.description - Meta description
 * @param {string} [props.keywords] - Comma separated keywords
 * @param {string} [props.ogType='website'] - Open Graph type
 * @param {string} [props.ogImage] - Open Graph image URL
 * @param {string} [props.path=''] - Current URL path (e.g. '/about')
 * @param {Array<{name: string, path: string}>} [props.breadcrumbs] - Breadcrumbs array for JSON-LD schema
 * @param {Object} [props.structuredData] - Optional custom JSON-LD schema object (e.g. CollectionPage / ItemList for paginated listings)
 * @param {string} [props.canonicalUrl] - Explicit canonical URL override (e.g. for paginated pages pointing to ?page=N or page 1)
 */
export default function SEO({
  title,
  description,
  keywords,
  ogType = "website",
  ogImage,
  path = "",
  breadcrumbs = [],
  structuredData,
  canonicalUrl: canonicalUrlProp,
}) {
  const { isFeatureEnabled } = usePublicSettings();
  // M32: siteUrl must be environment-driven, not hardcoded (was 'https://trstprep.com').
  const siteUrl = import.meta.env.VITE_SITE_URL || "https://trstprep.com";
  const ogImageResolved = ogImage || `${siteUrl}/icons/icon-512.png`;
  const computedCanonical = `${siteUrl}${path.startsWith("/") ? path : "/" + path}`;
  const canonicalUrl = canonicalUrlProp || computedCanonical;

  // Format page title
  const displayTitle = title
    ? `${title} | Trstprep`
    : "Trstprep | Exam Preparation";

  // Construct breadcrumb structured data (JSON-LD)
  const breadcrumbListSchema =
    breadcrumbs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbs.map((crumb, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            name: crumb.name,
            item: `${siteUrl}${crumb.path.startsWith("/") ? crumb.path : "/" + crumb.path}`,
          })),
        }
      : null;

  try {
    if (!isFeatureEnabled("seoEnabled")) {
      return (
        <Helmet>
          <title>{displayTitle}</title>
        </Helmet>
      );
    }
    return (
      <Helmet>
        {/* Basic HTML Meta Tags */}
        <title>{displayTitle}</title>
        <meta name="description" content={description} />
        {keywords && <meta name="keywords" content={keywords} />}
        <link rel="canonical" href={canonicalUrl} />

        {/* Facebook / Open Graph Meta Tags */}
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content={ogType} />
        <meta property="og:title" content={displayTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImageResolved} />

        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:domain"
          content={siteUrl.replace(/^https?:\/\//, "")}
        />
        <meta name="twitter:url" content={canonicalUrl} />
        <meta name="twitter:title" content={displayTitle} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImageResolved} />

        {/* Structured Data (JSON-LD) */}
        {breadcrumbListSchema && (
          <script type="application/ld+json">
            {JSON.stringify(breadcrumbListSchema)}
          </script>
        )}

        {structuredData && (
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        )}
      </Helmet>
    );
  } catch (err) {
    console.warn("[SEO] Helmet error (fail-open):", err);
    return null;
  }
}
