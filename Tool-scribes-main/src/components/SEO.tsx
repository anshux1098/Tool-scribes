import { Helmet } from "react-helmet-async";

/* ── Base site config ──────────────────────────────────────────────────── */
export const SITE = {
  name: "Tool Scribe",
  domain: "https://tool-scribe.com",
  tagline: "Discover, curate, and share the best developer tools",
} as const;

export interface SEOProps {
  title?: string;
  description?: string;
  /** e.g. /tool/42 or /u/jane */
  path?: string;
  image?: string;
  /** "website" | "article" | "profile"  */
  type?: "website" | "article" | "profile";
  noindex?: boolean;
  /** Additional structured data JSON-LD object */
  structuredData?: Record<string, unknown>;
  /** Twitter-specific overrides */
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
}

const DEFAULT_DESC =
  "Tool Scribe is a curated library of developer tools — discover, save to your vault, build collections, and share recommendations with the community.";

const DEFAULT_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/441269bb-e80c-42b8-a47f-b1a4dc687ee4/id-preview-ab86624c--4c86abac-57b9-45f1-8620-9a93697833da.lovable.app-1773756961775.png";

export function SEO({
  title,
  description = DEFAULT_DESC,
  path = "/",
  image = DEFAULT_IMAGE,
  type = "website",
  noindex = false,
  structuredData,
  twitterCard = "summary_large_image",
}: SEOProps) {
  const pageTitle = title ? `${title} | ${SITE.name}` : SITE.name;
  const canonicalUrl = new URL(path, SITE.domain).toString();

  return (
    <Helmet titleTemplate={`%s | ${SITE.name}`} defaultTitle={SITE.name}>
      <title>{title ? `${title} | ${SITE.name}` : SITE.name}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE.name} />

      {/* Twitter Cards */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}
