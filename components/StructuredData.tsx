'use client';

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
    description: locale === 'ar' 
      ? 'أدوات PDF مجانية على الإنترنت. دمج، ضغط، تقسيم ملفات PDF.'
      : 'Free online PDF tools. Merge, compress, split PDFs.',
    sameAs: [
      // Add your social media links
      // 'https://twitter.com/blendpdf',
      // 'https://facebook.com/blendpdf',
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
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: locale === 'ar'
      ? 'أدوات PDF مجانية على الإنترنت. دمج، ضغط، تقسيم ملفات PDF بدون تسجيل.'
      : 'Free online PDF tools. Merge, compress, split PDFs without sign-up.',
    featureList: [
      locale === 'ar' ? 'دمج ملفات PDF' : 'Merge PDFs',
      locale === 'ar' ? 'ضغط PDF' : 'Compress PDF',
      locale === 'ar' ? 'تقسيم PDF' : 'Split PDF',
    ],
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



