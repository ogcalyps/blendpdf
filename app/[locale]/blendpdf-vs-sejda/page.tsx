import { ComparisonPage, comparisonMetadata } from '@/components/compare/ComparisonPage';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params) {
  return comparisonMetadata('sejda', (await params).locale);
}

export default async function BlendPDFVsPage({ params }: Params) {
  return <ComparisonPage slug="sejda" locale={(await params).locale} />;
}
