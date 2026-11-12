import { Link } from '@/i18n/routing';

interface FormListingCardProps {
    slug: string;
    title: string;
    description: string;
}

export function FormListingCard({ slug, title, description }: FormListingCardProps) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-lg transition flex flex-col h-full">
            <div className="flex-1">
                <h3 className="text-xl font-bold mb-2 text-gray-900">{title}</h3>
                <p className="text-gray-600 mb-6">{description}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                {/* Plain URL, not /en/... or ?mode=single: crawlers follow the page's canonical address with no redirect */}
                <Link href={`/forms/${slug}`} className="flex-1 text-center bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition">
                    Fill Single Form
                </Link>
                <Link href={`/forms/${slug}?mode=batch`} className="flex-1 text-center bg-blue-50 text-blue-700 py-2.5 rounded-xl font-semibold hover:bg-blue-100 transition">
                    Batch Fill
                </Link>
            </div>
        </div>
    );
}
