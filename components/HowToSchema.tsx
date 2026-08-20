'use client';

interface HowToStep {
  title: string;
  description: string;
}

interface HowToSchemaProps {
  name: string;
  description?: string;
  steps: HowToStep[];
}

export function HowToSchema({ name, description, steps }: HowToSchemaProps) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com';
  
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: name,
    description: description || `Learn how to ${name.toLowerCase()}`,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.description,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
