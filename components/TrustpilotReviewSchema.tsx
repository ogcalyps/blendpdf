'use client';

interface TrustpilotReviewSchemaProps {
  /**
   * Overall rating (e.g., 4.5)
   */
  ratingValue: number;
  /**
   * Total number of reviews
   */
  reviewCount: number;
  /**
   * Business name
   */
  name?: string;
  /**
   * Business URL
   */
  url?: string;
}

/**
 * Adds Review/AggregateRating schema for SEO
 * This enables star ratings in Google search results
 */
export function TrustpilotReviewSchema({
  ratingValue,
  reviewCount,
  name = 'BlendPDF',
  url = 'https://blendpdf.com',
}: TrustpilotReviewSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: ratingValue.toString(),
      reviewCount: reviewCount.toString(),
      bestRating: '5',
      worstRating: '1',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
