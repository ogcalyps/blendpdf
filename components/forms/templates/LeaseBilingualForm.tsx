'use client';

import { downloadBlob } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { fillPdfForm } from '@/lib/pdf-generation';
import { Loader2, ArrowRight, ArrowLeft, Users, Home, Banknote, Scale, PenTool, CheckCircle2, Download } from 'lucide-react';
import { SignaturePad } from '../SignaturePad';
import { useFormPersist } from '@/hooks/useFormPersist';
import { PDFLivePreview } from '@/components/PDFLivePreview';

interface BilingualOptionLabel {
    value: string;
    en: string;
    ar: string;
}

interface BilingualField {
    type: 'section' | 'text' | 'date' | 'radioGroup' | 'checkbox' | 'signature';
    name?: string;
    label: string;
    labelAr: string;
    multiline?: boolean;
    options?: string[];
    optionLabels?: BilingualOptionLabel[];
}

interface WizardSection {
    title: string;
    titleAr: string;
    fields: BilingualField[];
}

// One icon per section entry in bilingualFormDefinitions.leaseBilingual.fields,
// in order: Parties, Property & Term, Rent & Deposit, Governing Law,
// Signatures — Landlord, Signatures — Tenant.
const SECTION_ICONS = [Users, Home, Banknote, Scale, PenTool, PenTool];

const INITIAL_DATA = {
    landlordName: '',
    landlordPhone: '',
    tenantName: '',
    tenantId: '',
    tenantPhone: '',
    propertyAddress: '',
    furnished: 'Unfurnished',
    leaseStart: '',
    leaseEnd: '',
    monthlyRent: '',
    paymentMethod: '',
    securityDeposit: '',
    utilitiesIncluded: '',
    petsAllowed: false,
    governingLaw: '',
    landlordSignature: '',
    landlordSignDate: '',
    tenantSignature: '',
    tenantSignDate: ''
};

const REQUIRED_FIELDS: Record<string, boolean> = {
    landlordName: true,
    tenantName: true,
    propertyAddress: true,
    leaseStart: true,
    leaseEnd: true,
    monthlyRent: true,
    landlordSignature: true,
    tenantSignature: true
};

export function LeaseBilingualForm() {
    const { formData, setFormData, isLoaded, clearPersistedData, hasDraft } = useFormPersist('lease-bilingual', INITIAL_DATA, {
        // Never persist signature data to localStorage
        excludeKeys: ['landlordSignature', 'tenantSignature']
    });

    // Field definitions live in the heavy bilingual data module (contains the
    // base64 PDF templates), so we load them lazily after mount to keep that
    // module out of the initial chunk.
    const [sections, setSections] = useState<WizardSection[] | null>(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    useEffect(() => {
        let cancelled = false;
        import('@/lib/form-templates-bilingual-data').then((mod) => {
            if (cancelled) return;
            const fields = mod.bilingualFormDefinitions.leaseBilingual.fields as unknown as BilingualField[];
            const grouped: WizardSection[] = [];
            for (const field of fields) {
                if (field.type === 'section') {
                    grouped.push({ title: field.label, titleAr: field.labelAr, fields: [] });
                } else if (grouped.length > 0) {
                    grouped[grouped.length - 1].fields.push(field);
                }
            }
            setSections(grouped);
        });
        return () => { cancelled = true; };
    }, []);

    if (!isLoaded || !sections) {
        return (
            <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[300px]">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    const totalSteps = sections.length + 1; // section steps + final Review
    const reviewStep = totalSteps;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const target = e.target;
        const name = target.name;
        const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateStep = (step: number) => {
        const section = sections[step - 1];
        if (!section) return true;
        const newErrors: Record<string, string> = {};
        for (const field of section.fields) {
            if (!field.name || !REQUIRED_FIELDS[field.name]) continue;
            const value = (formData as Record<string, string | boolean>)[field.name];
            if (!value) {
                newErrors[field.name] = field.type === 'signature' ? 'Signature Required' : 'Required';
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const generatePreview = async () => {
        setIsGenerating(true);
        try {
            const mod = await import('@/lib/form-templates-bilingual-data');
            const pdfBytes = await fillPdfForm(
                mod.leaseBilingualTemplate,
                formData,
                mod.bilingualFormDefinitions.leaseBilingual.fields as unknown as BilingualField[]
            );
            const file = new File([pdfBytes as any], 'Bilingual_Lease_Preview.pdf', { type: 'application/pdf' });
            setPreviewFile(file);
            setCurrentStep(reviewStep);
        } catch (err) {
            console.error(err);
            alert('Failed to generate preview');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleNext = async () => {
        if (validateStep(currentStep)) {
            if (currentStep === sections.length) {
                await generatePreview();
            } else {
                setCurrentStep(c => Math.min(totalSteps, c + 1));
            }
        }
    };

    const handlePrev = () => {
        setCurrentStep(c => Math.max(1, c - 1));
    };

    const downloadPdf = () => {
        if (!previewFile) return;
        downloadBlob(previewFile, 'Bilingual_Lease_Agreement_Completed.pdf');
        clearPersistedData();
        setCurrentStep(1);
        setPreviewFile(null);
    };

    const renderField = (field: BilingualField) => {
        const name = field.name as string;
        const value = (formData as Record<string, string | boolean>)[name];
        const error = errors[name];
        const isRequired = !!REQUIRED_FIELDS[name];

        const bilingualLabel = (
            <label className="block text-sm font-bold text-gray-700 mb-2">
                <span>{field.label}{isRequired && ' *'}</span>
                <span dir="rtl" lang="ar" className="block text-gray-500 font-semibold mt-0.5">{field.labelAr}</span>
            </label>
        );

        if (field.type === 'signature') {
            return (
                <div key={name}>
                    <SignaturePad
                        title={`${field.label}${isRequired ? ' *' : ''} — ${field.labelAr}`}
                        height={150}
                        initialValue={typeof value === 'string' ? value : ''}
                        onSave={(val) => {
                            setFormData(prev => ({ ...prev, [name]: val }));
                            setErrors(prev => ({ ...prev, [name]: '' }));
                        }}
                    />
                    {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
                </div>
            );
        }

        if (field.type === 'checkbox') {
            return (
                <div key={name}>
                    <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-300 bg-white cursor-pointer hover:border-blue-300 transition">
                        <input
                            type="checkbox"
                            name={name}
                            checked={value === true}
                            onChange={handleChange}
                            className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-bold text-gray-700">
                            <span className="block">{field.label}</span>
                            <span dir="rtl" lang="ar" className="block text-gray-500 font-semibold mt-0.5">{field.labelAr}</span>
                        </span>
                    </label>
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
            );
        }

        if (field.type === 'radioGroup') {
            return (
                <div key={name}>
                    {bilingualLabel}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {field.options?.map((opt) => {
                            const optionLabel = field.optionLabels?.find(o => o.value === opt);
                            const isSelected = value === opt;
                            return (
                                <button
                                    type="button"
                                    key={opt}
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, [name]: opt }));
                                        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
                                    }}
                                    className={`p-4 rounded-xl border-2 text-left transition-all duration-300 ${isSelected ? 'border-blue-500 bg-blue-50/50 shadow-md ring-4 ring-blue-500/10' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                                >
                                    <span className={`block font-bold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>{optionLabel?.en ?? opt}</span>
                                    <span dir="rtl" lang="ar" className={`block text-sm font-semibold mt-0.5 ${isSelected ? 'text-blue-700' : 'text-gray-500'}`}>{optionLabel?.ar ?? ''}</span>
                                </button>
                            );
                        })}
                    </div>
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
            );
        }

        // text (single-line or multiline) and date fields
        return (
            <div key={name}>
                {bilingualLabel}
                {field.multiline ? (
                    <textarea
                        name={name}
                        dir="auto"
                        rows={3}
                        value={typeof value === 'string' ? value : ''}
                        onChange={handleChange}
                        className={`w-full p-4 rounded-xl border ${error ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white resize-none`}
                    />
                ) : (
                    <input
                        type={field.type === 'date' ? 'date' : 'text'}
                        name={name}
                        dir="auto"
                        value={typeof value === 'string' ? value : ''}
                        onChange={handleChange}
                        className={`w-full p-4 rounded-xl border ${error ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white`}
                    />
                )}
                {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
        );
    };

    const currentSection = currentStep <= sections.length ? sections[currentStep - 1] : null;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Wizard Progress Header */}
            <div className="mb-10">
                <div className="flex justify-between items-center relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full z-0"></div>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 rounded-full z-0 transition-all duration-500 ease-in-out" style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}></div>

                    {[...sections.map((section, i) => ({
                        id: i + 1,
                        title: section.title,
                        icon: SECTION_ICONS[i] ?? PenTool
                    })), { id: reviewStep, title: 'Review', icon: CheckCircle2 }].map((step) => {
                        const Icon = step.icon;
                        const isCompleted = currentStep > step.id;
                        const isCurrent = currentStep === step.id;

                        return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors duration-300
                                    ${isCompleted ? 'bg-blue-600 border-blue-100 text-white' :
                                        isCurrent ? 'bg-white border-blue-600 text-blue-600 shadow-md' :
                                            'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                    {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                                </div>
                                <span className={`text-xs font-bold pt-1 uppercase tracking-wider hidden lg:block
                                    ${isCurrent ? 'text-blue-800' : isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                    {step.title}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {hasDraft && (
                <div className="flex items-center justify-end gap-2 mb-4 text-xs text-gray-500">
                    <span>Draft saved on this device (signatures are not stored).</span>
                    <button type="button" onClick={clearPersistedData} className="underline font-medium hover:text-gray-800">
                        Clear draft
                    </button>
                </div>
            )}

            {/* Form Content */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                <div className="px-8 py-10 sm:px-12 sm:py-12 min-h-[400px]">
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-8 border-b border-gray-100 pb-6 flex flex-wrap items-baseline justify-between gap-3">
                        <span>{currentSection ? currentSection.title : 'Review'}</span>
                        <span dir="rtl" lang="ar" className="text-xl font-bold text-gray-500">
                            {currentSection ? currentSection.titleAr : 'المراجعة'}
                        </span>
                    </h2>

                    {currentSection && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {currentSection.fields.map(renderField)}
                        </div>
                    )}

                    {currentStep === reviewStep && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-green-50 p-6 rounded-2xl border border-green-200 flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-green-900">Lease Agreement Ready for Review</h3>
                                    <p className="text-green-700 text-sm">Please review the generated bilingual agreement. You can go back to any step if you need to make changes.</p>
                                </div>
                            </div>

                            <div className="border rounded-2xl overflow-hidden shadow-inner bg-gray-100">
                                {previewFile ? (
                                    <PDFLivePreview file={previewFile} className="max-h-[600px]" />
                                ) : (
                                    <div className="h-[400px] flex items-center justify-center">
                                        <Loader2 className="animate-spin text-blue-600" size={32} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Form Navigation */}
            <div className="bg-gray-50 px-8 py-6 border-t border-gray-200 flex items-center justify-between mt-6 rounded-2xl">
                <button
                    type="button"
                    onClick={handlePrev}
                    className={`flex items-center gap-2 font-bold px-6 py-3 rounded-xl transition
                        ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}`}
                >
                    <ArrowLeft size={20} /> Back
                </button>

                {currentStep < reviewStep ? (
                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={isGenerating}
                        className="flex items-center gap-2 font-bold px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition active:scale-95 disabled:opacity-70"
                    >
                        {isGenerating ? (
                            <><Loader2 className="animate-spin" size={20} /> Preparing Preview...</>
                        ) : (
                            <>{currentStep === sections.length ? 'Review & Finish' : 'Next Step'} <ArrowRight size={20} /></>
                        )}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={downloadPdf}
                        className="flex items-center gap-2 font-bold px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition active:scale-95"
                    >
                        <Download size={20} /> Download Final Lease
                    </button>
                )}
            </div>
        </div>
    );
}
