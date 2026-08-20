import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Processing endpoints are not pages — keep crawlers out of them.
      disallow: ['/api/'],
    },
    sitemap: 'https://blendpdf.com/sitemap.xml',
  };
}
