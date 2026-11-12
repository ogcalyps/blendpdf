import { ComparisonPage, comparisonMetadata } from '@/components/compare/ComparisonPage';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params) {
  return comparisonMetadata('pdf24', (await params).locale);
}

export default async function BlendPDFVsPage({ params }: Params) {
  return <ComparisonPage slug="pdf24" locale={(await params).locale} />;
}
