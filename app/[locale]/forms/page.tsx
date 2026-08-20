import { Metadata } from 'next';
import { FormListingCard } from '@/components/forms/FormListingCard';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

export async function generateMetadata({ params }: any): Promise<Metadata> {
    const resolvedParams = await params;
    const locale = resolvedParams.locale;

    return {
        title: 'Free Online PDF Form Filler – W-9, NDA, I-9 & More | BlendPDF',
        description: 'Fill and download the most popular business forms online for free. W-9, NDA, I-9, lease agreements, patient intake forms and more. No Adobe required.',
        alternates: {
            // The forms library is English-only content: canonicalize every locale to the EN URL
            canonical: 'https://blendpdf.com/forms'
        },
        // English-only content served under /ar would read as thin duplicates to Google: noindex it
        ...(locale === 'ar' ? { robots: { index: false, follow: true } } : {}),
    };
}

const formsList = [
    {
        slug: 'w9',
        title: 'W-9 Form',
        description: 'Request for Taxpayer Identification Number and Certification. Used by businesses to request a contractor\'s tax info.'
    },
    {
        slug: 'nda',
        title: 'Non-Disclosure Agreement',
        description: 'Standard mutual or one-way NDA. Protect your confidential business information before sharing it.'
    },
    {
        slug: 'i9',
        title: 'I-9 Form',
        description: 'Employment Eligibility Verification. Mandatory for all US employers to verify employee identity and work authorization.'
    },
    {
        slug: 'lease-agreement',
        title: 'Residential Lease Agreement',
        description: 'Standard residential lease agreement for landlords and tenants. Outlines terms, rent, and rules.'
    },
    {
        slug: 'patient-intake',
        title: 'Patient Intake Form',
        description: 'Standard medical patient intake form. Collect patient info, insurance, and medical history efficiently.'
    },
    {
        slug: 'bilingual-nda',
        title: 'Bilingual NDA — عربي/English',
        description: 'Non-disclosure agreement with English and Arabic side by side. Arabic input fully supported in the PDF.'
    },
    {
        slug: 'bilingual-employment-contract',
        title: 'Bilingual Employment Contract — عربي/English',
        description: 'Employment contract in English and Arabic on the same page — position, salary, hours, leave, and notice.'
    },
    {
        slug: 'bilingual-lease-agreement',
        title: 'Bilingual Lease Agreement — عربي/English',
        description: 'Residential lease in English and Arabic — landlord, tenant, rent, deposit, and terms, unambiguous for both sides.'
    }
];

export default async function FormsDirectoryPage({ params }: any) {
    // Await the params before accessing its properties (Next.js 15 recommendation)
    const resolvedParams = await params;
    const locale = resolvedParams.locale;

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "BlendPDF Form Filler",
        "description": "Library of ready-made business forms like W-9, NDA, I-9. Batch fill multiple forms instantly with CSV.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        }
    };

    return (
        <div className="flex min-h-screen flex-col">
            <Navigation />
            <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
                        Free Business Form <span className="text-blue-600">Templates</span>
                    </h1>
                    <p className="text-xl text-gray-600 leading-relaxed">
                        Fill out popular business forms directly in your browser or batch-fill them via CSV. No Adobe required. Always free for single use.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {formsList.map((form) => (
                        <FormListingCard
                            key={form.slug}
                            slug={form.slug}
                            title={form.title}
                            description={form.description}
                            locale={locale}
                        />
                    ))}
                </div>
            </div>
            <Footer />
        </div>
    );
}
