import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formDefinitions, w9Template, ndaTemplate, i9Template, leaseTemplate, patientIntakeTemplate } from '@/lib/form-templates-data';
import { bilingualFormDefinitions, ndaBilingualTemplate, employmentBilingualTemplate, leaseBilingualTemplate } from '@/lib/form-templates-bilingual-data';
import { BatchFillUploader } from '@/components/forms/BatchFillUploader';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

import { W9Form } from '@/components/forms/templates/W9Form';
import { NDAForm } from '@/components/forms/templates/NDAForm';
import { I9Form } from '@/components/forms/templates/I9Form';
import { LeaseAgreementForm } from '@/components/forms/templates/LeaseAgreementForm';
import { PatientIntakeForm } from '@/components/forms/templates/PatientIntakeForm';
import { NDABilingualForm } from '@/components/forms/templates/NDABilingualForm';
import { EmploymentContractBilingualForm } from '@/components/forms/templates/EmploymentContractBilingualForm';
import { LeaseBilingualForm } from '@/components/forms/templates/LeaseBilingualForm';
import { signatureFontsClassName } from '@/lib/signature-fonts';

const seoContentMap: Record<string, { explanation: string, usage: string, blendpdf: string }> = {
    'w9': {
        explanation: 'The W-9 Form (Request for Taxpayer Identification Number and Certification) is a critical IRS tax document used in the United States. Its primary purpose is to request the name, address, and taxpayer identification information of a payee (such as an independent contractor or freelancer).',
        usage: 'Businesses use it when they need to report income paid to an independent contractor to the IRS. If you are freelancing, setting up a new vendor account, or earning interest from a financial institution, you will likely be asked to fill out a W-9.',
        blendpdf: 'BlendPDF makes completing the W-9 faster than ever. Instead of printing documents, manually writing fields, and scanning them back, you can seamlessly type your information directly in our browser-based tool to generate a clean, ready-to-share PDF instantly.'
    },
    'nda': {
        explanation: 'A Non-Disclosure Agreement (NDA) is a legally binding contract that establishes a confidential relationship. The parties signing the agreement agree that sensitive information they may obtain will not be made available to any others.',
        usage: 'Startups, enterprises, and individual professionals use NDAs when discussing potential partnerships, hiring contractors, or demonstrating private technology. You need an NDA absolutely anytime you are sharing proprietary business secrets you want to protect.',
        blendpdf: 'Rather than downloading templates and struggling with word processors, BlendPDF provides a quick, dynamic NDA generator. Switch seamlessly between mutual and one-way agreements, and download a professional PDF ready for signatures in seconds.'
    },
    'i9': {
        explanation: 'The I-9 Form (Employment Eligibility Verification) is a mandatory document created by the U.S. Citizenship and Immigration Services (USCIS). It is used to verify the identity and legal authorization to work of all paid employees in the United States.',
        usage: 'Every single U.S. employer must properly complete an I-9 for each individual they hire for employment in the country. Employees fill out Section 1 on their first day, and employers must verify physical documents and complete Section 2 within three business days.',
        blendpdf: 'BlendPDF strips away the confusion of the I-9 process. Our organized interface strictly separates employee and employer sections so you can prepare the information step by step. Note: employers are legally required to use the current official USCIS edition of Form I-9 for actual hires — download it from uscis.gov and use this tool to organize and prepare your details.'
    },
    'lease-agreement': {
        explanation: 'A Residential Lease Agreement is a legally binding contract between a landlord and tenant(s) that outlines the terms of renting a property. It establishes the rights and responsibilities of both parties throughout the rental period.',
        usage: 'Landlords and property managers use this whenever renting an apartment, house, or room to new tenants. It details crucial info like monthly rent, security deposits, lease duration, utility breakdown, and pet policies.',
        blendpdf: 'BlendPDF’s dynamic lease builder simplifies property management. Add multiple tenants instantly, toggle included utilities, construct your terms clearly, and export a clean PDF without needing expensive property management software.'
    },
    'patient-intake': {
        explanation: 'A Patient Intake Form is the standard medical document patients complete prior to seeing a healthcare provider. It captures essential demographic information, insurance details, emergency contacts, and comprehensive medical history.',
        usage: 'Medical clinics, dentists, therapists, and specialists use this form to safely onboard new patients. Gathering this structured information is crucial prior to consultation to ensure safe and appropriately billed medical care.',
        blendpdf: 'Manually charting recurring patient data is tedious. BlendPDF lets patients type their comprehensive medical histories directly, or allows clinics to securely batch-generate pre-filled patient records via CSV locally in the browser.'
    },
    'bilingual-nda': {
        explanation: 'A bilingual Non-Disclosure Agreement presents the full confidentiality contract in English and Arabic side by side, so both parties can read every clause in their own language. It covers the parties, the definition of confidential information, obligations, exclusions, term, and governing law.',
        usage: 'Companies and professionals doing business across the Middle East and North Africa use bilingual NDAs when one party works in Arabic and the other in English — partnerships, vendor discussions, hiring, and investor conversations where a single-language contract would leave one side reading a translation.',
        blendpdf: 'BlendPDF generates the bilingual NDA in your browser: type names and terms once (Arabic input is fully supported and rendered correctly in the PDF), sign with a drawn signature, and download a clean two-language PDF. Nothing is uploaded to a server.'
    },
    'bilingual-employment-contract': {
        explanation: 'A bilingual Employment Contract sets out the terms of employment — position, salary, working hours, leave, probation, notice, and governing labour law — in English and Arabic on the same page, a common requirement for employment documents across the Gulf and wider MENA region.',
        usage: 'Employers hiring in Arabic-speaking markets, and employees who want to understand exactly what they are signing, use bilingual contracts. Many MENA labour authorities expect or require Arabic contract text, with English kept for international teams.',
        blendpdf: 'Fill the contract directly in your browser — Arabic names, addresses, and allowances render correctly in the final PDF — add signatures, and download instantly. For HR teams, the batch mode fills a whole roster of contracts from one CSV, entirely on your device.'
    },
    'bilingual-lease-agreement': {
        explanation: 'A bilingual Residential Lease Agreement records the landlord, tenant, property, term, rent, deposit, and house rules in both English and Arabic, so neither party depends on an informal translation of the contract they are signing.',
        usage: 'Landlords, property managers, and tenants in Arabic-speaking markets — or expatriates renting from Arabic-speaking owners — use bilingual leases to make the terms unambiguous for both sides and easier to present to authorities when required.',
        blendpdf: 'BlendPDF builds the bilingual lease in your browser: enter the details once (Arabic input renders correctly in the PDF), have both parties sign, and download the finished two-language agreement. Your data never leaves your device.'
    }
};

// Arabic page copy for the bilingual templates — these slugs are indexed in
// BOTH locales (unlike the US-only forms, which canonicalize to EN).
const bilingualArContent: Record<string, { name: string, tagline: string, explanation: string, usage: string, blendpdf: string }> = {
    'bilingual-nda': {
        name: 'اتفاقية عدم الإفصاح (ثنائية اللغة)',
        tagline: 'املأ اتفاقية عدم إفصاح ثنائية اللغة (عربي/إنجليزي) مباشرة في المتصفح ونزّلها PDF مجاناً.',
        explanation: 'اتفاقية عدم الإفصاح ثنائية اللغة تعرض عقد السرية كاملاً بالعربية والإنجليزية جنباً إلى جنب، ليقرأ كل طرف كل بند بلغته. تغطي الأطراف وتعريف المعلومات السرية والالتزامات والاستثناءات والمدة والقانون الواجب التطبيق.',
        usage: 'تستخدمها الشركات والمهنيون العاملون بين أسواق عربية وأجنبية عند الشراكات ومناقشات الموردين والتوظيف وأحاديث المستثمرين، حيث يكون العقد بلغة واحدة مجحفاً بأحد الطرفين.',
        blendpdf: 'ينشئ BlendPDF الاتفاقية في متصفحك: اكتب الأسماء والشروط مرة واحدة (الإدخال بالعربية مدعوم بالكامل ويظهر بشكل صحيح في ملف PDF)، ووقّع بتوقيع مرسوم، ونزّل ملفاً نظيفاً باللغتين. لا يُرفع أي شيء إلى الخادم.'
    },
    'bilingual-employment-contract': {
        name: 'عقد عمل (ثنائي اللغة)',
        tagline: 'أنشئ عقد عمل ثنائي اللغة (عربي/إنجليزي) واملأه ووقّعه في المتصفح مجاناً.',
        explanation: 'يحدد عقد العمل ثنائي اللغة شروط التوظيف — الوظيفة والراتب وساعات العمل والإجازات وفترة التجربة والإشعار وقانون العمل الواجب التطبيق — بالعربية والإنجليزية في الصفحة نفسها، وهو متطلب شائع لمستندات التوظيف في الخليج ومنطقة الشرق الأوسط وشمال أفريقيا.',
        usage: 'يستخدمه أصحاب العمل الذين يوظفون في الأسواق الناطقة بالعربية، والموظفون الذين يريدون فهم ما يوقعونه بدقة. كثير من جهات العمل في المنطقة تشترط النص العربي للعقود مع إبقاء الإنجليزية للفرق الدولية.',
        blendpdf: 'املأ العقد مباشرة في متصفحك — تظهر الأسماء والعناوين والبدلات العربية بشكل صحيح في الملف النهائي — وأضف التوقيعات ونزّله فوراً. ولفرق الموارد البشرية، يملأ وضع الدفعات مجموعة عقود كاملة من ملف CSV واحد، كلياً على جهازك.'
    },
    'bilingual-lease-agreement': {
        name: 'عقد إيجار سكني (ثنائي اللغة)',
        tagline: 'أنشئ عقد إيجار سكني ثنائي اللغة (عربي/إنجليزي) واملأه ووقّعه في المتصفح مجاناً.',
        explanation: 'يوثّق عقد الإيجار السكني ثنائي اللغة بيانات المؤجر والمستأجر والعقار والمدة والأجرة والتأمين وقواعد السكن بالعربية والإنجليزية معاً، فلا يعتمد أي طرف على ترجمة غير رسمية للعقد الذي يوقعه.',
        usage: 'يستخدمه الملاك ومديرو العقارات والمستأجرون في الأسواق الناطقة بالعربية — أو الوافدون المستأجرون من ملاك ناطقين بالعربية — لجعل الشروط واضحة للطرفين وأسهل تقديماً للجهات الرسمية عند الحاجة.',
        blendpdf: 'ينشئ BlendPDF عقد الإيجار في متصفحك: أدخل التفاصيل مرة واحدة (الإدخال بالعربية يظهر بشكل صحيح في الملف)، ويوقّع الطرفان، ثم نزّل العقد المكتمل باللغتين. بياناتك لا تغادر جهازك.'
    }
};

const slugMap: Record<string, { tpl: string, def: any, name: string, SingleComponent: React.ComponentType<any>, bilingual?: boolean }> = {
    'w9': { tpl: w9Template, def: formDefinitions.w9, name: 'W-9', SingleComponent: W9Form },
    'nda': { tpl: ndaTemplate, def: formDefinitions.nda, name: 'NDA', SingleComponent: NDAForm },
    'i9': { tpl: i9Template, def: formDefinitions.i9, name: 'I-9', SingleComponent: I9Form },
    'lease-agreement': { tpl: leaseTemplate, def: formDefinitions.lease, name: 'Residential Lease Agreement', SingleComponent: LeaseAgreementForm },
    'patient-intake': { tpl: patientIntakeTemplate, def: formDefinitions.patient, name: 'Patient Intake', SingleComponent: PatientIntakeForm },
    'bilingual-nda': { tpl: ndaBilingualTemplate, def: bilingualFormDefinitions.ndaBilingual, name: 'Bilingual NDA (English/Arabic)', SingleComponent: NDABilingualForm, bilingual: true },
    'bilingual-employment-contract': { tpl: employmentBilingualTemplate, def: bilingualFormDefinitions.employmentBilingual, name: 'Bilingual Employment Contract (English/Arabic)', SingleComponent: EmploymentContractBilingualForm, bilingual: true },
    'bilingual-lease-agreement': { tpl: leaseBilingualTemplate, def: bilingualFormDefinitions.leaseBilingual, name: 'Bilingual Lease Agreement (English/Arabic)', SingleComponent: LeaseBilingualForm, bilingual: true }
};

export async function generateMetadata({ params, searchParams }: any): Promise<Metadata> {
    const resolvedParams = await params;
    const { locale, slug } = resolvedParams;
    const config = slugMap[slug];
    if (!config) return {};

    const baseUrl = 'https://blendpdf.com';

    // Bilingual templates carry real Arabic content: index BOTH locales with
    // hreflang alternates (unlike the US-only forms below).
    if (config.bilingual) {
        const ar = bilingualArContent[slug];
        const enUrl = `${baseUrl}/forms/${slug}`;
        const arUrl = `${baseUrl}/ar/forms/${slug}`;
        const isAr = locale === 'ar';
        return {
            title: isAr
                ? `${ar.name} – املأ ونزّل PDF مجاناً | BlendPDF`
                : `Free ${config.name} – Fill & Download PDF | BlendPDF`,
            description: isAr
                ? ar.tagline
                : `Fill out a ${config.name.toLowerCase()} online for free. Arabic and English side by side, Arabic input fully supported. Complete, sign, and download instantly with BlendPDF.`,
            alternates: {
                canonical: isAr ? arUrl : enUrl,
                languages: { en: enUrl, ar: arUrl },
            },
        };
    }

    return {
        title: `Free ${config.name} Form Filler Online – Fill & Download PDF | BlendPDF`,
        description: `Fill out your ${config.name} online for free. No Adobe needed. Complete, download, and batch-fill multiple ${config.name} PDFs instantly with BlendPDF.`,
        alternates: {
            // The forms library is English-only content: canonicalize every locale to the EN URL
            canonical: `https://blendpdf.com/forms/${slug}`
        },
        // English-only content served under /ar would read as thin duplicates to Google: noindex it
        ...(locale === 'ar' ? { robots: { index: false, follow: true } } : {}),
    };
}

export default async function FormDetailPage({ params, searchParams }: any) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const { locale, slug } = resolvedParams;
    const mode = resolvedSearchParams.mode === 'batch' ? 'batch' : 'single';

    const config = slugMap[slug];
    if (!config) notFound();

    const def = config.def;
    const SingleComponent = config.SingleComponent;
    // Bilingual templates show Arabic page copy on the /ar locale.
    const arContent = config.bilingual && locale === 'ar' ? bilingualArContent[slug] : null;
    const seo = arContent ?? seoContentMap[slug];
    const displayName = arContent ? arContent.name : config.name;

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": `BlendPDF ${config.name} Filler`,
        "description": `Online tool to fill and download ${config.name} PDFs quickly. Includes batch CSV filling.`,
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        }
    };

    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": `Do I need Adobe Acrobat to fill this ${config.name}?`,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": `No, you do not need Adobe Acrobat. BlendPDF allows you to fill out your ${config.name} directly in your browser completely for free.`
                }
            },
            {
                "@type": "Question",
                "name": `Can I fill multiple ${config.name} forms at once?`,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": `Yes, with "Batch Fill" you type or paste rows of data directly into an editable table (or import an Excel/CSV file and map its columns), preview any row, and generate up to 50 ${config.name} PDFs at once.`
                }
            },
            {
                "@type": "Question",
                "name": `Is my data secure when filling the ${config.name}?`,
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": `Yes, all PDF generation happens entirely in your web browser. Your data is never sent to or stored on our servers.`
                }
            },
            {
                "@type": "Question",
                "name": "How much does it cost?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Filling forms is completely free. Batch filling via CSV supports up to 50 rows per upload."
                }
            }
        ]
    };

    return (
        <div className={`flex min-h-screen flex-col ${signatureFontsClassName}`}>
            <Navigation />
            <div className="flex-grow max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

                {/* Top Header & Breadcrumbs */}
                <div className="mb-8">
                    <Link href={`/${locale}/forms`} className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-block">
                        &larr; Back to Forms Library
                    </Link>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
                        {arContent ? `${displayName} – املأ ونزّل PDF مجاناً` : `Free ${config.name} Filler – Fill Online & Download PDF`}
                    </h1>
                    <p className="text-lg text-gray-600">
                        {arContent ? arContent.tagline : `Complete your ${config.name} seamlessly without installing any external software.`}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-8">
                    <Link
                        href={`/${locale}/forms/${slug}?mode=single`}
                        replace
                        className={`px-6 py-4 font-semibold text-lg border-b-2 transition-colors ${mode === 'single' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        Single Fill
                    </Link>
                    <Link
                        href={`/${locale}/forms/${slug}?mode=batch`}
                        replace
                        className={`px-6 py-4 font-semibold text-lg border-b-2 transition-colors ${mode === 'batch' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        Batch Fill
                    </Link>
                </div>

                {/* Main Content Area */}
                <div className="mb-16">
                    {mode === 'single' ? (
                        <SingleComponent />
                    ) : (
                        <BatchFillUploader
                            templateBase64={config.tpl}
                            formDef={def}
                            filenamePrefix={slug}
                        />
                    )}
                </div>

                {/* SEO Content Section */}
                <div className="prose prose-blue max-w-none border-t border-gray-200 pt-12 mb-16">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900">{arContent ? `ما هو ${displayName}؟` : `What is the ${config.name}?`}</h2>
                    <p className="text-gray-700 leading-relaxed mb-4">{seo.explanation}</p>

                    <h3 className="text-xl font-semibold mb-3 text-gray-800">{arContent ? 'من يستخدمه ومتى؟' : 'Who uses it and when?'}</h3>
                    <p className="text-gray-700 leading-relaxed mb-4">{seo.usage}</p>

                    <h3 className="text-xl font-semibold mb-3 text-gray-800">{arContent ? 'لماذا BlendPDF؟' : 'Why use BlendPDF?'}</h3>
                    <p className="text-gray-700 leading-relaxed">{seo.blendpdf}</p>

                    <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-5 not-prose">
                        {config.bilingual ? (
                            <p className="text-sm text-gray-600 leading-relaxed">
                                <strong className="text-gray-800">{locale === 'ar' ? 'تنبيه:' : 'Disclaimer:'}</strong>{' '}
                                {locale === 'ar'
                                    ? 'هذا النموذج مُقدَّم للتيسير فقط ولا يُعد استشارة قانونية. تختلف المتطلبات النظامية بين الدول — راجع مختصاً قانونياً قبل الاعتماد على العقد في المعاملات الرسمية.'
                                    : 'This template is provided for convenience only and does not constitute legal advice. Legal requirements differ between countries — consult a qualified lawyer before relying on this contract for formal transactions.'}
                            </p>
                        ) : (
                            <p className="text-sm text-gray-600 leading-relaxed">
                                <strong className="text-gray-800">Disclaimer:</strong> Templates are based on the official forms.
                                BlendPDF is not affiliated with the IRS, USCIS, or any government agency, and these templates
                                are not a substitute for legal advice. For legal filings, verify that you are using the current
                                official version of the form from the issuing agency.
                            </p>
                        )}
                    </div>
                </div>

                {/* FAQ Section */}
                <div className="bg-gray-50 rounded-3xl p-8 mb-16">
                    <h2 className="text-2xl font-bold mb-6 text-gray-900 border-b border-gray-200 pb-4">Frequently Asked Questions</h2>
                    <div className="space-y-6">
                        {faqSchema.mainEntity.map((q, i) => (
                            <div key={i}>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{q.name}</h3>
                                <p className="text-gray-600">{q.acceptedAnswer.text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Internal Linking */}
                <div className="border border-gray-200 rounded-3xl p-8 bg-white shadow-sm">
                    <h2 className="text-xl font-bold mb-4 text-gray-900">You might also need:</h2>
                    <div className="flex flex-wrap gap-4">
                        {Object.entries(slugMap)
                            .filter(([s]) => s !== slug)
                            .slice(0, 3)
                            .map(([s, c]) => (
                                <Link key={s} href={`/${locale}/forms/${s}`} className="text-blue-600 hover:text-blue-800 font-medium">
                                    {c.name} template
                                </Link>
                            ))}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
