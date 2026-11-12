'use client';

import { downloadBlob } from '@/lib/utils';
import { useState } from 'react';
import { fillPdfForm } from '@/lib/pdf-generation';
import { ndaTemplate, formDefinitions } from '@/lib/form-templates-data';
import { Loader2, ArrowRight, ArrowLeft, Shield, Users, Calendar, PenTool, CheckCircle2, Download } from 'lucide-react';
import { SignaturePad } from '../SignaturePad';
import { useFormPersist } from '@/hooks/useFormPersist';
import { useReviewAskAfterSuccess } from '@/hooks/useReviewAskAfterSuccess';
import { PDFLivePreview } from '@/components/PDFLivePreview';

const STEPS = [
    { id: 1, title: 'Agreement Type', icon: Shield },
    { id: 2, title: 'The Parties', icon: Users },
    { id: 3, title: 'Terms & Scope', icon: Calendar },
    { id: 4, title: 'Signatures', icon: PenTool },
    { id: 5, title: 'Review', icon: CheckCircle2 },
];

export function NDAForm() {
    const { markSuccess, reviewAsk } = useReviewAskAfterSuccess();
    const { formData, setFormData, isLoaded, clearPersistedData, hasDraft } = useFormPersist('nda_form', {
        ndaType: 'Mutual',
        disclosingPartyName: '',
        disclosingPartyAddress: '',
        receivingPartyName: '',
        receivingPartyAddress: '',
        effectiveDate: '',
        durationYears: '',
        governingState: '',
        confidentialInformation: '',
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

    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    const def = formDefinitions.nda;

    if (!isLoaded) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const isMutual = formData.ndaType === 'Mutual';

    const validateStep = (step: number) => {
        const newErrors: Record<string, string> = {};
        if (step === 2) {
            if (!formData.disclosingPartyName) newErrors.disclosingPartyName = 'Required';
            if (isMutual && !formData.receivingPartyName) newErrors.receivingPartyName = 'Required';
        }
        if (step === 3) {
            if (!formData.effectiveDate) newErrors.effectiveDate = 'Required';
            if (!formData.durationYears) newErrors.durationYears = 'Required';
        }
        if (step === 4) {
            if (!formData.disclosingSignature) newErrors.disclosingSignature = 'Signature Required';
            if (isMutual && !formData.receivingSignature) newErrors.receivingSignature = 'Signature Required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const generatePreview = async () => {
        setIsGenerating(true);
        try {
            const pdfBytes = await fillPdfForm(ndaTemplate, formData, def.fields);
            const file = new File([pdfBytes as any], 'NDA_Preview.pdf', { type: 'application/pdf' });
            setPreviewFile(file);
            setCurrentStep(5);
        } catch (err) {
            console.error(err);
            alert('Failed to generate preview');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleNext = async () => {
        if (validateStep(currentStep)) {
            if (currentStep === 4) {
                await generatePreview();
            } else {
                setCurrentStep(c => Math.min(STEPS.length, c + 1));
            }
        }
    };

    const handlePrev = () => {
        setCurrentStep(c => Math.max(1, c - 1));
    };

    const downloadPdf = () => {
        if (!previewFile) return;
        downloadBlob(previewFile, 'NDA_Completed.pdf');
        markSuccess();
        clearPersistedData();
        setCurrentStep(1);
        setPreviewFile(null);
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Wizard Progress Header */}
            <div className="mb-10">
                <div className="flex justify-between items-center relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full z-0"></div>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-600 rounded-full z-0 transition-all duration-500 ease-in-out" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}></div>

                    {STEPS.map((step) => {
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
                                <span className={`text-xs font-bold pt-1 uppercase tracking-wider hidden sm:block
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
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-8 border-b border-gray-100 pb-6 flex items-center gap-3">
                        {STEPS[currentStep - 1].title}
                    </h2>

                    {currentStep === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <p className="text-gray-600">Select the type of Non-Disclosure Agreement you wish to create. This fundamentally changes who is protected by the agreement.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, ndaType: 'One-Way' }))}
                                    className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 ${!isMutual ? 'border-blue-500 bg-blue-50/50 shadow-md ring-4 ring-blue-500/10' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                                >
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-gray-100">
                                        <Shield className={`${!isMutual ? 'text-blue-600' : 'text-gray-400'}`} />
                                    </div>
                                    <h3 className={`text-xl font-bold mb-2 ${!isMutual ? 'text-blue-900' : 'text-gray-900'}`}>One-Way NDA</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">Only one party is disclosing confidential information to the other. The receiving party is the only one bound to keep secrets.</p>
                                </button>

                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, ndaType: 'Mutual' }))}
                                    className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 ${isMutual ? 'border-blue-500 bg-blue-50/50 shadow-md ring-4 ring-blue-500/10' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                                >
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-gray-100">
                                        <Users className={`${isMutual ? 'text-blue-600' : 'text-gray-400'}`} />
                                    </div>
                                    <h3 className={`text-xl font-bold mb-2 ${isMutual ? 'text-blue-900' : 'text-gray-900'}`}>Mutual NDA</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">Both parties will be sharing confidential information with each other. Both are bound to keep each other's secrets.</p>
                                </button>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-6 md:p-8 border border-blue-100 rounded-2xl bg-blue-50/30">
                                    <h3 className="font-bold text-lg mb-6 text-blue-900 flex items-center gap-2">
                                        <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm">A</span>
                                        Disclosing Party
                                    </h3>
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Legal Name</label>
                                            <input type="text" name="disclosingPartyName" value={formData.disclosingPartyName} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.disclosingPartyName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white`} placeholder="Acme Corp or Jane Doe" />
                                            {errors.disclosingPartyName && <p className="text-red-500 text-xs mt-1">{errors.disclosingPartyName}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Full Address</label>
                                            <input type="text" name="disclosingPartyAddress" value={formData.disclosingPartyAddress} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white" placeholder="123 Main St, City, ST 12345" />
                                        </div>
                                    </div>
                                </div>

                                <div className={`p-6 md:p-8 border rounded-2xl transition-all duration-300 ${isMutual ? 'border-purple-100 bg-purple-50/30' : 'border-gray-200 bg-gray-50/50'}`}>
                                    <h3 className={`font-bold text-lg mb-6 flex items-center gap-2 ${isMutual ? 'text-purple-900' : 'text-gray-700'}`}>
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${isMutual ? 'bg-purple-100 text-purple-600' : 'bg-gray-200 text-gray-600'}`}>B</span>
                                        Receiving Party {isMutual ? '(Mutual)' : '(One-Way Read-Only)'}
                                    </h3>
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Legal Name {isMutual && '*'}</label>
                                            <input type="text" name="receivingPartyName" value={formData.receivingPartyName} onChange={handleChange} disabled={!isMutual} className={`w-full p-4 rounded-xl border ${errors.receivingPartyName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 outline-none transition ${!isMutual ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`} placeholder={isMutual ? "Globex Inc or John Smith" : "Not applicable for One-Way"} />
                                            {errors.receivingPartyName && <p className="text-red-500 text-xs mt-1">{errors.receivingPartyName}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Full Address</label>
                                            <input type="text" name="receivingPartyAddress" value={formData.receivingPartyAddress} onChange={handleChange} disabled={!isMutual} className={`w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition ${!isMutual ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`} placeholder={isMutual ? "456 Oak Ave, City, ST 67890" : "Not applicable"} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Effective Date *</label>
                                    <input type="date" name="effectiveDate" value={formData.effectiveDate} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.effectiveDate ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50/50`} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Duration (Years) *</label>
                                    <input type="number" min="1" step="0.5" name="durationYears" value={formData.durationYears} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.durationYears ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50/50`} placeholder="e.g. 2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Governing State</label>
                                    <input type="text" name="governingState" value={formData.governingState} onChange={handleChange} placeholder="e.g. Delaware" className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50/50" />
                                </div>
                            </div>

                            <div className="bg-amber-50/50 border border-amber-200 p-6 md:p-8 rounded-2xl">
                                <label className="block text-sm font-bold text-amber-900 mb-2">Definition of Confidential Information</label>
                                <p className="text-sm text-amber-700 mb-4 tracking-wide leading-relaxed">Specify exactly what constitutes confidential information under this agreement (e.g., source code, financial records, client lists, IP). Leave blank for a standard broad definition.</p>
                                <textarea name="confidentialInformation" value={formData.confidentialInformation} rows={4} onChange={handleChange} className="w-full p-4 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition bg-white shadow-inner resize-none" placeholder="Describe the information to be protected..." />
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <p className="text-gray-600 text-lg">Please draw your signatures below. These will be natively embedded into your final generated PDF document.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-200">
                                    <h3 className="font-bold text-lg text-gray-900 border-b pb-2">Disclosing Party</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-gray-600 mb-1">Print Name</label>
                                                <input type="text" name="disclosingName" value={formData.disclosingName} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-600 mb-1">Date</label>
                                                <input type="date" name="disclosingDate" value={formData.disclosingDate} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">Title (Optional)</label>
                                            <input type="text" name="disclosingTitle" value={formData.disclosingTitle} onChange={handleChange} placeholder="e.g. CEO" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <SignaturePad
                                                title="Draw Signature *"
                                                height={150}
                                                initialValue={formData.disclosingSignature}
                                                onSave={(val) => {
                                                    setFormData(prev => ({ ...prev, disclosingSignature: val }));
                                                    setErrors(prev => ({ ...prev, disclosingSignature: '' }));
                                                }}
                                            />
                                            {errors.disclosingSignature && <p className="text-red-500 text-xs mt-1 font-bold">{errors.disclosingSignature}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className={`space-y-6 p-6 rounded-2xl border transition-all ${isMutual ? 'bg-gray-50/50 border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                    <h3 className="font-bold text-lg text-gray-900 border-b pb-2">Receiving Party {isMutual ? '(Required)' : '(Optional)'}</h3>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm text-gray-600 mb-1">Print Name</label>
                                                <input type="text" name="receivingName" value={formData.receivingName} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-600 mb-1">Date</label>
                                                <input type="date" name="receivingDate" value={formData.receivingDate} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-1">Title (Optional)</label>
                                            <input type="text" name="receivingTitle" value={formData.receivingTitle} onChange={handleChange} placeholder="e.g. Consultant" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <SignaturePad
                                                title={isMutual ? "Draw Signature *" : "Draw Signature"}
                                                height={150}
                                                initialValue={formData.receivingSignature}
                                                onSave={(val) => {
                                                    setFormData(prev => ({ ...prev, receivingSignature: val }));
                                                    if (isMutual) setErrors(prev => ({ ...prev, receivingSignature: '' }));
                                                }}
                                            />
                                            {errors.receivingSignature && <p className="text-red-500 text-xs mt-1 font-bold">{errors.receivingSignature}</p>}
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
                                    <h3 className="font-bold text-green-900">NDA Ready for Review</h3>
                                    <p className="text-green-700 text-sm">Please review the generated agreement. You can go back to any step if you need to make changes.</p>
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

                {currentStep < STEPS.length ? (
                    <button
                        type="button"
                        onClick={handleNext}
                        disabled={isGenerating}
                        className="flex items-center gap-2 font-bold px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition active:scale-95 disabled:opacity-70"
                    >
                        {isGenerating ? (
                            <><Loader2 className="animate-spin" size={20} /> Preparing Preview...</>
                        ) : (
                            <>{currentStep === 4 ? 'Review & Sign' : 'Next Step'} <ArrowRight size={20} /></>
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
            {reviewAsk}
        </div>
    );
}
