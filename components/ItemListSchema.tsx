'use client';

interface Tool {
  name: string;
  url: string;
  description: string;
}

interface ItemListSchemaProps {
  tools: Tool[];
}

export function ItemListSchema({ tools }: ItemListSchemaProps) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com';
  
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Free PDF Tools - BlendPDF',
    description: 'Complete list of free online PDF tools including merge, compress, split, convert, and more.',
    numberOfItems: tools.length,
    itemListElement: tools.map((tool, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'WebApplication',
        name: tool.name,
        url: tool.url.startsWith('http') ? tool.url : `${baseUrl}${tool.url}`,
        description: tool.description,
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
