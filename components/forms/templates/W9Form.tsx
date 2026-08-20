'use client';

import { downloadBlob } from '@/lib/utils';
import { useState } from 'react';
import { fillPdfForm } from '@/lib/pdf-generation';
import { w9Template, formDefinitions } from '@/lib/form-templates-data';
import { Loader2, ArrowRight, ArrowLeft, Building2, MapPin, Hash, PenTool, CheckCircle2, Download, FileCheck } from 'lucide-react';
import { SignaturePad } from '../SignaturePad';
import { useFormPersist } from '@/hooks/useFormPersist';
import { PDFLivePreview } from '@/components/PDFLivePreview';

const STEPS = [
    { id: 1, title: 'Entity Info', icon: Building2 },
    { id: 2, title: 'Address & Exemptions', icon: MapPin },
    { id: 3, title: 'TIN', icon: Hash },
    { id: 4, title: 'Certification', icon: PenTool },
    { id: 5, title: 'Review', icon: FileCheck },
];

export function W9Form() {
    const { formData, setFormData, isLoaded, clearPersistedData, hasDraft } = useFormPersist('w9_form', {
        fullName: '',
        businessName: '',
        taxClassification: '',
        llcClassification: '',
        exemptions: '',
        address: '',
        cityStateZip: '',
        accountNumbers: '',
        ssn: '',
        ein: '',
        signature: '',
        date: new Date().toISOString().split('T')[0]
    }, {
        // Never persist sensitive data to localStorage
        excludeKeys: ['ssn', 'ein', 'signature']
    });

    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    const def = formDefinitions.w9;
    const isLLC = formData.taxClassification === 'Limited liability company';

    if (!isLoaded) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Mutual exclusivity for SSN and EIN
        if (name === 'ssn' && value) {
            setFormData(prev => ({ ...prev, ein: '' }));
            setErrors(prev => ({ ...prev, ein: '' }));
        }
        if (name === 'ein' && value) {
            setFormData(prev => ({ ...prev, ssn: '' }));
            setErrors(prev => ({ ...prev, ssn: '' }));
        }
    };

    const validateStep = (step: number) => {
        const newErrors: Record<string, string> = {};

        if (step === 1) {
            if (!formData.fullName) newErrors.fullName = 'Name is required';
            if (!formData.taxClassification) newErrors.taxClassification = 'Tax classification is required';
            if (isLLC && !formData.llcClassification) newErrors.llcClassification = 'LLC classification is required';
        }

        if (step === 2) {
            if (!formData.address) newErrors.address = 'Address is required';
            if (!formData.cityStateZip) newErrors.cityStateZip = 'City, state, and ZIP are required';
        }

        if (step === 3) {
            if (!formData.ssn && !formData.ein) {
                newErrors.ssn = 'Either SSN or EIN is required';
                newErrors.ein = 'Either SSN or EIN is required';
            }
        }

        if (step === 4) {
            if (!formData.signature) newErrors.signature = 'Signature Required';
            if (!formData.date) newErrors.date = 'Date Required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = async () => {
        if (validateStep(currentStep)) {
            if (currentStep === 4) {
                // Generate preview before moving to step 5
                await generatePreview();
            } else {
                setCurrentStep(c => Math.min(STEPS.length, c + 1));
            }
        }
    };

    const handlePrev = () => {
        setCurrentStep(c => Math.max(1, c - 1));
    };

    const generatePreview = async () => {
        setIsGenerating(true);
        try {
            const pdfBytes = await fillPdfForm(w9Template, formData, def.fields);
            const file = new File([pdfBytes as any], 'W-9_Preview.pdf', { type: 'application/pdf' });
            setPreviewFile(file);
            setCurrentStep(5);
        } catch (err) {
            console.error(err);
            alert('Failed to generate preview');
        } finally {
            setIsGenerating(false);
        }
    }

    const downloadPdf = () => {
        if (!previewFile) return;
        downloadBlob(previewFile, 'W-9_Completed.pdf');
        clearPersistedData();
        setCurrentStep(1); // Reset
        setPreviewFile(null);
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Wizard Progress Header */}
            <div className="mb-10">
                <div className="flex justify-between items-center relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full z-0"></div>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 rounded-full z-0 transition-all duration-500 ease-in-out" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}></div>

                {STEPS.map((step) => {
                    const Icon = step.icon;
                    const isCompleted = currentStep > step.id;
                    const isCurrent = currentStep === step.id;

                    return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors duration-300
                                    ${isCompleted ? 'bg-indigo-600 border-indigo-100 text-white' :
                                        isCurrent ? 'bg-white border-indigo-600 text-indigo-600 shadow-md' :
                                            'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                    {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                                </div>
                                <span className={`text-xs font-bold pt-1 uppercase tracking-wider hidden sm:block whitespace-nowrap
                ${isCurrent ? 'text-indigo-800' : isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                {step.title}
            </span>
        </div>
    );
})}
                </div >
            </div >

    {hasDraft && (
        <div className="flex items-center justify-end gap-2 mb-4 text-xs text-gray-500">
            <span>Draft saved on this device (sensitive fields like SSN, EIN, and signatures are not stored).</span>
            <button type="button" onClick={clearPersistedData} className="underline font-medium hover:text-gray-800">
                Clear draft
            </button>
        </div>
    )}

    {/* Form Content */ }
    < div className = "bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden" >
        <div className="px-8 py-10 sm:px-12 sm:py-12 min-h-[400px]">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-8 border-b border-gray-100 pb-6 flex items-center gap-3">
                {STEPS[currentStep - 1].title}
            </h2>

            {currentStep === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">1. Name (as shown on your income tax return) *</label>
                            <p className="text-sm text-gray-500 mb-3">Name is required on this line; do not leave this line blank. The name should match the name on your tax return.</p>
                            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.fullName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-indigo-500 outline-none transition bg-gray-50/50`} />
                            {errors.fullName && <p className="text-red-500 text-sm mt-1 font-bold">{errors.fullName}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">2. Business name/disregarded entity name</label>
                            <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition bg-gray-50/50" placeholder="If different from above" />
                        </div>

                        <div className="bg-indigo-50/50 p-6 md:p-8 rounded-2xl border border-indigo-100">
                            <label className="block text-base font-bold text-indigo-900 mb-4">3. Federal tax classification *</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {def.fields.find(f => f.name === 'taxClassification')?.options?.map((opt: string) => (
                                    <label key={opt} className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition select-none
                                ${formData.taxClassification === opt ? 'border-indigo-500 bg-white ring-2 ring-indigo-500/20 shadow-sm' : 'border-gray-200 bg-white/50 hover:border-gray-300'}`}>
                                <input type="radio" name="taxClassification" value={opt} checked={formData.taxClassification === opt} onChange={handleChange} className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                                <span className={`text-sm font-medium ${formData.taxClassification === opt ? 'text-indigo-900' : 'text-gray-700'}`}>{opt}</span>
                        </label>
                                        ))}
                    </div>
                    {errors.taxClassification && <p className="text-red-500 text-sm mt-3 font-bold">{errors.taxClassification}</p>}
                </div>

                                {isLLC && (
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 animate-in fade-in slide-in-from-top-4">
                    <label className="block text-sm font-bold text-blue-900 mb-2">LLC Tax Classification *</label>
                    <p className="text-sm text-blue-700 mb-4">Enter C for C corporation, S for S corporation, or P for Partnership.</p>
                    <input type="text" name="llcClassification" value={formData.llcClassification} onChange={handleChange} maxLength={1} className={`w-24 text-center p-4 text-xl font-bold uppercase border rounded-xl ${errors.llcClassification ? 'border-red-500 ring-2 ring-red-200' : 'border-blue-300'} focus:ring-2 focus:ring-blue-500 outline-none transition bg-white shadow-inner`} placeholder="C, S, or P" />
                    {errors.llcClassification && <p className="text-red-500 text-sm mt-2 font-bold">{errors.llcClassification}</p>}
                </div>
            )}
        </div>
                        </div >
                    )}

{
    currentStep === 2 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">5. Address (number, street, and apt. or suite no.) *</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.address ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-indigo-500 outline-none transition bg-gray-50/50`} />
                    {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">6. City, state, and ZIP code *</label>
                    <input type="text" name="cityStateZip" value={formData.cityStateZip} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.cityStateZip ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-indigo-500 outline-none transition bg-gray-50/50`} />
                    {errors.cityStateZip && <p className="text-red-500 text-sm mt-1">{errors.cityStateZip}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2">4. Exemptions (optional)</label>
                    <p className="text-xs text-gray-500 mb-3 block">Exempt payee code (if any) or Exemption from FATCA reporting code (if any).</p>
                    <input type="text" name="exemptions" value={formData.exemptions} onChange={handleChange} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white" />
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2">7. List account number(s) here (optional)</label>
                    <p className="text-xs text-gray-500 mb-3 block">For your own internal tracking or reference.</p>
                    <input type="text" name="accountNumbers" value={formData.accountNumbers} onChange={handleChange} className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white" />
                </div>
            </div>
        </div>
    )
}

{
    currentStep === 3 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 shadow-inner">
                <h3 className="font-bold text-xl text-slate-800 mb-2 flex items-center gap-3">
                    <Hash className="text-slate-400" /> Part I: Taxpayer Identification Number (TIN)
                </h3>
                <p className="text-slate-600 mb-8 border-b border-slate-200 pb-6">Enter your TIN in the appropriate box. The TIN provided must match the name given on line 1 to avoid backup withholding. For individuals, this is generally your social security number (SSN). However, for a resident alien, sole proprietor, or disregarded entity, see the Form W-9 instructions.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className={`p-6 rounded-xl border-2 transition ${formData.ssn ? 'border-indigo-500 bg-white ring-4 ring-indigo-50' : 'border-slate-200 bg-white/50'}`}>
                    <label className="block text-base font-bold text-slate-800 mb-3">Social Security Number (SSN)</label>
                    <input type="text" name="ssn" value={formData.ssn} onChange={handleChange} placeholder="XXX-XX-XXXX" className={`w-full p-4 text-center font-mono text-xl tracking-widest rounded-xl border ${errors.ssn ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-300'} focus:ring-2 focus:ring-indigo-500 outline-none transition bg-slate-50`} />
                    {errors.ssn && <p className="text-red-500 text-sm mt-2 text-center font-bold">{errors.ssn}</p>}
                </div>

                <div className="flex items-center justify-center font-bold text-slate-400 uppercase tracking-widest md:-mx-4">
                    — OR —
                </div>

                <div className={`p-6 rounded-xl border-2 transition ${formData.ein ? 'border-indigo-500 bg-white ring-4 ring-indigo-50' : 'border-slate-200 bg-white/50'}`}>
                <label className="block text-base font-bold text-slate-800 mb-3">Employer Identification Number (EIN)</label>
                <input type="text" name="ein" value={formData.ein} onChange={handleChange} placeholder="XX-XXXXXXX" className={`w-full p-4 text-center font-mono text-xl tracking-widest rounded-xl border ${errors.ein ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-300'} focus:ring-2 focus:ring-indigo-500 outline-none transition bg-slate-50`} />
                {errors.ein && <p className="text-red-500 text-sm mt-2 text-center font-bold">{errors.ein}</p>}
            </div>
        </div>
                            </div >
                        </div >
                    )
}

            {currentStep === 4 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-gray-50/80 p-8 rounded-2xl border border-gray-200">
                        <h3 className="font-bold text-xl text-gray-900 border-b pb-4 mb-6">Part II: Certification</h3>

                        <div className="text-sm text-gray-600 space-y-4 mb-8">
                            <p>Under penalties of perjury, I certify that:</p>
                            <ol className="list-decimal pl-5 space-y-2">
                                <li>The number shown on this form is my correct taxpayer identification number (or I am waiting for a number to be issued to me); and</li>
                                <li>I am not subject to backup withholding because: (a) I am exempt from backup withholding, or (b) I have not been notified by the Internal Revenue Service (IRS) that I am subject to backup withholding as a result of a failure to report all interest or dividends, or (c) the IRS has notified me that I am no longer subject to backup withholding; and</li>
                                <li>I am a U.S. citizen or other U.S. person; and</li>
                                <li>The FATCA code(s) entered on this form (if any) indicating that I am exempt from FATCA reporting is correct.</li>
                            </ol>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                            <div className="space-y-4">
                                <SignaturePad
                                    title="Signature of U.S. person *"
                                    height={150}
                                    initialValue={formData.signature}
                                    onSave={(val) => {
                                        setFormData(prev => ({ ...prev, signature: val }));
                                        setErrors(prev => ({ ...prev, signature: '' }));
                                    }}
                                />
                                {errors.signature && <p className="text-red-500 text-sm font-bold">{errors.signature}</p>}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Date *</label>
                                    <input type="date" name="date" value={formData.date} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.date ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white`} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === 5 && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-green-50 p-6 rounded-2xl border border-green-200 flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-green-900">Form Ready for Review</h3>
                            <p className="text-green-700 text-sm">Please review the details below. If anything is incorrect, you can go back and edit.</p>
                        </div>
                    </div>

                    <div className="border rounded-2xl overflow-hidden shadow-inner bg-gray-100">
                        {previewFile ? (
                            <PDFLivePreview file={previewFile} className="max-h-[600px]" />
                        ) : (
                            <div className="h-[400px] flex items-center justify-center">
                                <Loader2 className="animate-spin text-indigo-600" size={32} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Form Navigation */}
        <div className="bg-gray-50 px-8 py-6 border-t border-gray-200 flex items-center justify-between">
            <button
                type="button"
                onClick={handlePrev}
                className={`flex items-center gap-2 font-bold px-6 py-3 rounded-xl transition
                    ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'}`}
            >
                <ArrowLeft size={20} /> Back
            </button>

            {currentStep < STEPS.length ? (
                <button
                    type="button"
                    onClick={handleNext}
                    disabled={isGenerating}
                    className="flex items-center gap-2 font-bold px-8 py-4 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 transition active:scale-95 disabled:opacity-70"
                >
                    {isGenerating ? (
                        <><Loader2 className="animate-spin" size={20} /> Preparing Preview...</>
                    ) : (
                        <>{currentStep === 4 ? 'Review PDF' : 'Next Step'} <ArrowRight size={20} /></>
                    )}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={downloadPdf}
                    className="flex items-center gap-2 font-bold px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition active:scale-95"
                >
                    <Download size={20} /> Download Final PDF
                </button>
            )}
        </div>
    </div>
</div>
);
}
