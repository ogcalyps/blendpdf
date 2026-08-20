'use client';

import { downloadBlob } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { fillPdfForm } from '@/lib/pdf-generation';
import { Loader2, ArrowRight, ArrowLeft, Shield, Users, Calendar, PenTool, CheckCircle2, Download, Languages } from 'lucide-react';
import { SignaturePad } from '../SignaturePad';
import { useFormPersist } from '@/hooks/useFormPersist';
import { PDFLivePreview } from '@/components/PDFLivePreview';

// NOTE: the bilingual template module (lib/form-templates-bilingual-data.ts)
// embeds three large base64 PDFs (~770KB). To keep it out of the first-load
// chunk it is ONLY loaded via dynamic import(): once on mount (for the field
// definitions) and again — served from the module cache — when generating.

interface BilingualOptionLabel {
    value: string;
    en: string;
    ar: string;
}

interface BilingualField {
    type: string;
    name?: string;
    label: string;
    labelAr: string;
    multiline?: boolean;
    options?: string[];
    optionLabels?: BilingualOptionLabel[];
}

interface WizardSection {
    label: string;
    labelAr: string;
    fields: BilingualField[];
}

const SECTION_ICONS = [Users, Shield, Calendar, PenTool, PenTool, Languages];

const AR_FONT: React.CSSProperties = { fontFamily: 'var(--font-cairo), sans-serif' };

/** Bilingual label: English on the left, Arabic (RTL) on the right. */
function FieldLabel({ field, required }: { field: BilingualField; required?: boolean }) {
    return (
        <label className="flex items-baseline justify-between gap-3 text-sm font-bold text-gray-700 mb-2">
            <span>{field.label}{required && ' *'}</span>
            <span dir="rtl" className="text-gray-500 font-semibold" style={AR_FONT}>{field.labelAr}</span>
        </label>
    );
}

export function NDABilingualForm() {
    const { formData, setFormData, isLoaded, clearPersistedData, hasDraft } = useFormPersist('nda-bilingual', {
        disclosingPartyName: '',
        disclosingPartyAddress: '',
        receivingPartyName: '',
        receivingPartyAddress: '',
        effectiveDate: '',
        ndaType: 'Mutual',
        confidentialInformation: '',
        durationYears: '',
        governingLaw: '',
        disclosingName: '',
        disclosingTitle: '',
        disclosingSignature: '',
        disclosingDate: '',
        receivingName: '',
        receivingTitle: '',
        receivingSignature: '',
        receivingDate: ''
    }, {
        // Never persist signature data to localStorage
        excludeKeys: ['disclosingSignature', 'receivingSignature']
    });

    const [sections, setSections] = useState<WizardSection[] | null>(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    // Load the field definitions without pulling the base64 templates into
    // the initial bundle.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { bilingualFormDefinitions } = await import('@/lib/form-templates-bilingual-data');
            if (cancelled) return;
            const fields = bilingualFormDefinitions.ndaBilingual.fields as unknown as BilingualField[];
            const grouped: WizardSection[] = [];
            for (const field of fields) {
                if (field.type === 'section') {
                    grouped.push({ label: field.label, labelAr: field.labelAr, fields: [] });
                } else if (grouped.length > 0) {
                    grouped[grouped.length - 1].fields.push(field);
                }
            }
            setSections(grouped);
        })();
        return () => { cancelled = true; };
    }, []);

    if (!isLoaded || !sections) {
        return (
            <div className="max-w-4xl mx-auto h-[400px] flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    // Wizard steps = one per section + a final Review step.
    const totalSteps = sections.length + 1;
    const reviewStep = totalSteps;
    const signatureStep = sections.length; // last section step (used for preview trigger)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateStep = (step: number) => {
        const newErrors: Record<string, string> = {};
        const section = sections[step - 1];
        if (section) {
            for (const field of section.fields) {
                if (!field.name) continue;
                const required =
                    field.name === 'disclosingPartyName' ||
                    field.name === 'receivingPartyName' ||
                    field.name === 'effectiveDate' ||
                    field.name === 'durationYears';
                if (required && !formData[field.name as keyof typeof formData]) {
                    newErrors[field.name] = 'Required';
                }
                if (field.type === 'signature' && !formData[field.name as keyof typeof formData]) {
                    newErrors[field.name] = 'Signature Required';
                }
            }
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const generatePreview = async () => {
        setIsGenerating(true);
        try {
            // Same module as the useEffect import — resolved from cache, so the
            // heavy base64 template is fetched at most once.
            const { ndaBilingualTemplate, bilingualFormDefinitions } = await import('@/lib/form-templates-bilingual-data');
            const pdfBytes = await fillPdfForm(ndaBilingualTemplate, formData, bilingualFormDefinitions.ndaBilingual.fields as any[]);
            const file = new File([pdfBytes as any], 'Bilingual_NDA_Preview.pdf', { type: 'application/pdf' });
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
            if (currentStep === signatureStep) {
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
        downloadBlob(previewFile, 'Bilingual_NDA_Completed.pdf');
        clearPersistedData();
        setCurrentStep(1);
        setPreviewFile(null);
    };

    const shortTitle = (label: string) => label.replace(/^\d+\.\s*/, '');

    const stepMeta = [
        ...sections.map((s, i) => ({
            id: i + 1,
            title: shortTitle(s.label),
            titleAr: s.labelAr,
            icon: SECTION_ICONS[i % SECTION_ICONS.length],
        })),
        { id: reviewStep, title: 'Review', titleAr: 'مراجعة', icon: CheckCircle2 },
    ];

    const renderField = (field: BilingualField) => {
        if (!field.name) return null;
        const name = field.name;
        const value = (formData[name as keyof typeof formData] as string) ?? '';
        const error = errors[name];

        if (field.type === 'signature') {
            return (
                <div key={name}>
                    <FieldLabel field={field} required />
                    <SignaturePad
                        title={`${field.label} — ${field.labelAr}`}
                        height={150}
                        initialValue={value}
                        onSave={(val) => {
                            setFormData(prev => ({ ...prev, [name]: val }));
                            setErrors(prev => ({ ...prev, [name]: '' }));
                        }}
                    />
                    {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
                </div>
            );
        }

        if (field.type === 'radioGroup' && field.options) {
            return (
                <div key={name}>
                    <FieldLabel field={field} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {field.options.map((option) => {
                            const optLabel = field.optionLabels?.find(o => o.value === option);
                            const selected = value === option;
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => {
                                        setFormData(prev => ({ ...prev, [name]: option }));
                                        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
                                    }}
                                    className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 ${selected ? 'border-blue-500 bg-blue-50/50 shadow-md ring-4 ring-blue-500/10' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                                >
                                    <p className={`font-bold mb-1 ${selected ? 'text-blue-900' : 'text-gray-900'}`}>{optLabel?.en ?? option}</p>
                                    <p dir="rtl" className="text-gray-500 text-sm leading-relaxed" style={AR_FONT}>{optLabel?.ar ?? option}</p>
                                </button>
                            );
                        })}
                    </div>
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
            );
        }

        if (field.type === 'date') {
            return (
                <div key={name}>
                    <FieldLabel field={field} required={!!error || name === 'effectiveDate'} />
                    <input
                        type="date"
                        name={name}
                        value={value}
                        onChange={handleChange}
                        className={`w-full p-4 rounded-xl border ${error ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white`}
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
            );
        }

        if (field.multiline) {
            return (
                <div key={name}>
                    <FieldLabel field={field} />
                    <textarea
                        name={name}
                        value={value}
                        rows={4}
                        dir="auto"
                        onChange={handleChange}
                        className={`w-full p-4 rounded-xl border ${error ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white shadow-inner resize-none`}
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
            );
        }

        // Default: single-line text. dir="auto" lets Arabic input flow RTL.
        return (
            <div key={name}>
                <FieldLabel field={field} required={name === 'disclosingPartyName' || name === 'receivingPartyName' || name === 'durationYears'} />
                <input
                    type="text"
                    name={name}
                    value={value}
                    dir="auto"
                    onChange={handleChange}
                    className={`w-full p-4 rounded-xl border ${error ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white`}
                />
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

                    {stepMeta.map((step) => {
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
                                <span className={`text-xs font-bold pt-1 uppercase tracking-wider hidden sm:block text-center max-w-[120px]
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
                    <div className="flex items-baseline justify-between gap-4 mb-8 border-b border-gray-100 pb-6">
                        <h2 className="text-3xl font-extrabold text-gray-900">
                            {currentSection ? shortTitle(currentSection.label) : 'Review'}
                        </h2>
                        <span dir="rtl" className="text-xl font-bold text-gray-500" style={AR_FONT}>
                            {currentSection ? currentSection.labelAr : 'مراجعة'}
                        </span>
                    </div>

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
                                <div className="flex-1">
                                    <h3 className="font-bold text-green-900">Bilingual NDA Ready for Review</h3>
                                    <p className="text-green-700 text-sm">Please review the generated agreement. You can go back to any step if you need to make changes.</p>
                                    <p dir="rtl" className="text-green-700 text-sm mt-1" style={AR_FONT}>يرجى مراجعة الاتفاقية. يمكنك الرجوع إلى أي خطوة لإجراء التعديلات.</p>
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

                {currentStep < totalSteps ? (
                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={isGenerating}
                        className="flex items-center gap-2 font-bold px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition active:scale-95 disabled:opacity-70"
                    >
                        {isGenerating ? (
                            <><Loader2 className="animate-spin" size={20} /> Preparing Preview...</>
                        ) : (
                            <>{currentStep === signatureStep ? 'Review & Sign' : 'Next Step'} <ArrowRight size={20} /></>
                        )}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={downloadPdf}
                        className="flex items-center gap-2 font-bold px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition active:scale-95"
                    >
                        <Download size={20} /> Download Final NDA
                    </button>
                )}
            </div>
        </div>
    );
}
