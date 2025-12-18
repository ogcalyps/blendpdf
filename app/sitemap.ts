import { MetadataRoute } from 'next';
import { locales } from '@/i18n';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://your-domain.amplifyapp.com';
  
  // Generate sitemap entries for each locale
  const routes = ['']; // Add more routes as needed (e.g., '/about', '/features')
  
  const sitemapEntries: MetadataRoute.Sitemap = [];
  
  // Add entries for each locale
  locales.forEach((locale) => {
    routes.forEach((route) => {
      const url = locale === 'en' 
        ? `${baseUrl}${route}` 
        : `${baseUrl}/${locale}${route}`;
      
      sitemapEntries.push({
        url,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: route === '' ? 1.0 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            locales.map((loc) => [
              loc,
              loc === 'en' ? `${baseUrl}${route}` : `${baseUrl}/${loc}${route}`,
            ])
          ),
        },
      });
    });
  });
  
  return sitemapEntries;
}

