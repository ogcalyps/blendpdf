'use client';

import { CONTENT_UPDATED } from '@/lib/content-updated';

interface StructuredDataProps {
  locale?: string;
}

export function StructuredData({ locale = 'en' }: StructuredDataProps) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com';
  
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'BlendPDF',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: {
      ar: 'أدوات PDF مجانية على الإنترنت. دمج، ضغط، تقسيم ملفات PDF.',
      fr: 'Outils PDF gratuits en ligne. Fusionner, compresser, diviser des PDF.',
      es: 'Herramientas PDF gratuitas en línea. Unir, comprimir y dividir archivos PDF.',
    }[locale] ?? 'Free online PDF tools. Merge, compress, split PDFs.',
    // Profiles that confirm who BlendPDF is, for search engines and AI assistants.
    sameAs: [
      'https://www.trustpilot.com/review/blendpdf.com',
      'https://chromewebstore.google.com/detail/open-in-blendpdf-%E2%80%94-pdf-to/jbbdcpldbfagoegkmjohpemggmbamklb',
    ],
  };
  
  // Note: no SearchAction here — the site has no /search route, and
  // declaring actions for nonexistent URLs erodes structured-data trust.
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'BlendPDF',
    url: baseUrl,
  };
  
  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'BlendPDF',
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'Web',
    dateModified: CONTENT_UPDATED.toISOString().slice(0, 10),
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: {
      ar: 'أدوات PDF مجانية على الإنترنت. دمج، ضغط، تقسيم ملفات PDF بدون تسجيل.',
      fr: 'Outils PDF gratuits en ligne. Fusionner, compresser, diviser des PDF sans inscription.',
      es: 'Herramientas PDF gratuitas en línea. Unir, comprimir y dividir archivos PDF sin registrarse.',
    }[locale] ?? 'Free online PDF tools. Merge, compress, split PDFs without sign-up.',
    featureList: {
      ar: ['دمج ملفات PDF', 'ضغط PDF', 'تقسيم PDF'],
      fr: ['Fusionner des PDF', 'Compresser un PDF', 'Diviser un PDF'],
      es: ['Unir PDF', 'Comprimir PDF', 'Dividir PDF'],
    }[locale] ?? ['Merge PDFs', 'Compress PDF', 'Split PDF'],
  };
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
    </>
  );
}



