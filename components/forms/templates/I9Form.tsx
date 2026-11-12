'use client';

import { downloadBlob } from '@/lib/utils';
import { useState } from 'react';
import { fillPdfForm } from '@/lib/pdf-generation';
import { i9Template, formDefinitions } from '@/lib/form-templates-data';
import { Loader2, ArrowRight, ArrowLeft, UserCircle, Briefcase, FileCheck, PenTool, CheckCircle2, Download } from 'lucide-react';
import { SignaturePad } from '../SignaturePad';
import { useFormPersist } from '@/hooks/useFormPersist';
import { useReviewAskAfterSuccess } from '@/hooks/useReviewAskAfterSuccess';
import { PDFLivePreview } from '@/components/PDFLivePreview';

const STEPS = [
    { id: 1, title: 'Employee Info', icon: UserCircle },
    { id: 2, title: 'Attestation', icon: FileCheck },
    { id: 3, title: 'Employer Review', icon: Briefcase },
    { id: 4, title: 'Signatures', icon: PenTool },
    { id: 5, title: 'Review', icon: CheckCircle2 },
];

export function I9Form() {
    const { markSuccess, reviewAsk } = useReviewAskAfterSuccess();
    const { formData, setFormData, isLoaded, clearPersistedData, hasDraft } = useFormPersist('i9_form', {
        lastName: '',
        firstName: '',
        middleInitial: '',
        otherLastNames: '',
        address: '',
        aptNumber: '',
        cityStateZip: '',
        dob: '',
        ssn: '',
        email: '',
        phone: '',
        attestationStatus: '',
        employeeSignature: '',
        employeeDate: new Date().toISOString().split('T')[0],
        documentTitle: '',
        issuingAuthority: '',
        documentNumber: '',
        expirationDate: '',
        employerName: '',
        employerTitle: '',
        employerAddress: '',
        employerSignature: '',
        employerDate: new Date().toISOString().split('T')[0]
    }, {
        // Never persist sensitive data to localStorage
        excludeKeys: ['ssn', 'dob', 'employeeSignature', 'employerSignature']
    });

    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    const def = formDefinitions.i9;

    if (!isLoaded) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateStep = (step: number) => {
        const newErrors: Record<string, string> = {};

        if (step === 1) {
            if (!formData.lastName) newErrors.lastName = 'Required';
            if (!formData.firstName) newErrors.firstName = 'Required';
            if (!formData.address) newErrors.address = 'Required';
            if (!formData.cityStateZip) newErrors.cityStateZip = 'Required';
            if (!formData.dob) newErrors.dob = 'Required';
            if (!formData.ssn) newErrors.ssn = 'Required';
        }

        if (step === 2) {
            if (!formData.attestationStatus) newErrors.attestationStatus = 'You must select an attestation status';
        }

        if (step === 3) {
            if (!formData.employerName) newErrors.employerName = 'Required';
            if (!formData.employerAddress) newErrors.employerAddress = 'Required';
        }

        if (step === 4) {
            if (!formData.employeeSignature) newErrors.employeeSignature = 'Employee Signature Required';
            if (!formData.employeeDate) newErrors.employeeDate = 'Required';
            if (!formData.employerSignature) newErrors.employerSignature = 'Employer Signature Required';
            if (!formData.employerDate) newErrors.employerDate = 'Required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
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

    const generatePreview = async () => {
        setIsGenerating(true);
        try {
            const pdfBytes = await fillPdfForm(i9Template, formData, def.fields);
            const file = new File([pdfBytes as any], 'I-9_Preview.pdf', { type: 'application/pdf' });
            setPreviewFile(file);
            setCurrentStep(5);
        } catch (err) {
            console.error(err);
            alert('Failed to generate preview');
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadPdf = () => {
        if (!previewFile) return;
        downloadBlob(previewFile, 'I-9_Completed.pdf');
        markSuccess();
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
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-sky-600 rounded-full z-0 transition-all duration-500 ease-in-out" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}></div>

                    {STEPS.map((step) => {
                        const Icon = step.icon;
                        const isCompleted = currentStep > step.id;
                        const isCurrent = currentStep === step.id;

                        return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors duration-300
                                    ${isCompleted ? 'bg-sky-600 border-sky-100 text-white' :
                                        isCurrent ? 'bg-white border-sky-600 text-sky-600 shadow-md' :
                                            'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                    {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                                </div>
                                <span className={`text-xs font-bold pt-1 uppercase tracking-wider hidden sm:block whitespace-nowrap
                                    ${isCurrent ? 'text-sky-800' : isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                    {step.title}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {hasDraft && (
                <div className="flex items-center justify-end gap-2 mb-4 text-xs text-gray-500">
                    <span>Draft saved on this device (sensitive fields like SSN, date of birth, and signatures are not stored).</span>
                    <button type="button" onClick={clearPersistedData} className="underline font-medium hover:text-gray-800">
                        Clear draft
                    </button>
                </div>
            )}

            {/* Form Content */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                <div className="px-8 py-10 sm:px-12 sm:py-12 min-h-[400px]">
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-2 border-b border-gray-100 pb-2 flex flex-col gap-1">
                        Employment Eligibility Verification (I-9)
                        <span className="text-sm font-normal text-gray-500 mt-1">Department of Homeland Security • U.S. Citizenship and Immigration Services</span>
                    </h2>

                    <h3 className="text-xl font-bold text-sky-900 mb-8 pt-4 flex items-center gap-2">
                        {STEPS[currentStep - 1].title}
                    </h3>

                    {currentStep === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-sky-50/50 p-6 rounded-2xl border border-sky-100">
                                <p className="text-sm text-sky-800 mb-6 font-medium">Section 1. Employee Information and Attestation (Employees must complete and sign this section before their first day of work for pay).</p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Last Name (Family Name) *</label>
                                        <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.lastName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-sky-500 outline-none transition bg-white`} />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">First Name (Given Name) *</label>
                                        <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.firstName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-sky-500 outline-none transition bg-white`} />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Middle Initial</label>
                                        <input type="text" name="middleInitial" value={formData.middleInitial} onChange={handleChange} maxLength={1} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-sky-500 outline-none transition bg-white" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Other Last Names Used (if any)</label>
                                        <input type="text" name="otherLastNames" value={formData.otherLastNames} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-sky-500 outline-none transition bg-white" />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Address (Street Number and Name) *</label>
                                        <input type="text" name="address" value={formData.address} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.address ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-sky-500 outline-none transition bg-white`} />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Apt. Number</label>
                                        <input type="text" name="aptNumber" value={formData.aptNumber} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-sky-500 outline-none transition bg-white" />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">City or Town, State, and ZIP Code *</label>
                                        <input type="text" name="cityStateZip" value={formData.cityStateZip} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.cityStateZip ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-sky-500 outline-none transition bg-white`} />
                                    </div>

                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth *</label>
                                        <input type="date" name="dob" value={formData.dob} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.dob ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-sky-500 outline-none transition bg-white`} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">U.S. Social Security Number *</label>
                                        <input type="text" name="ssn" value={formData.ssn} onChange={handleChange} placeholder="XXX-XX-XXXX" className={`w-full p-4 font-mono tracking-widest rounded-xl border ${errors.ssn ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-sky-500 outline-none transition bg-white`} />
                                    </div>

                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Employee's Email Address</label>
                                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-sky-500 outline-none transition bg-white" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Employee's Telephone Number</label>
                                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-sky-500 outline-none transition bg-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
                                <label className="block text-lg font-bold text-slate-900 mb-4">I attest, under penalty of perjury, that I am (check one): *</label>
                                <div className="space-y-3">
                                    {def.fields.find(f => f.name === 'attestationStatus')?.options?.map((opt: string) => (
                                        <label key={opt} className={`flex items-start gap-3 p-5 border rounded-xl cursor-pointer transition select-none
                                            ${formData.attestationStatus === opt ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500 shadow-sm' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                                            <input type="radio" name="attestationStatus" value={opt} checked={formData.attestationStatus === opt} onChange={handleChange} className="mt-1 w-5 h-5 text-sky-600 focus:ring-sky-500" />
                                            <span className={`text-base font-medium ${formData.attestationStatus === opt ? 'text-sky-900' : 'text-gray-700'}`}>{opt}</span>
                                        </label>
                                    ))}
                                </div>
                                {errors.attestationStatus && <p className="text-red-500 text-sm mt-4 font-bold">{errors.attestationStatus}</p>}
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-amber-50/50 p-6 md:p-8 rounded-2xl border border-amber-100">
                                <p className="text-sm text-amber-900 mb-6 font-medium">Section 2. Employer or Authorized Representative Review and Verification (Employers or their authorized representative must complete and sign this section within 3 business days of the employee's first day of employment).</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Employer's Business or Organization Name *</label>
                                        <input type="text" name="employerName" value={formData.employerName} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.employerName ? 'border-red-500 ring-2 ring-red-200' : 'border-amber-200'} focus:ring-2 focus:ring-amber-500 outline-none transition bg-white`} />
                                        {errors.employerName && <p className="text-red-500 text-xs mt-1 font-bold">{errors.employerName}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Title of Employer or Authorized Representative *</label>
                                        <input type="text" name="employerTitle" value={formData.employerTitle} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.employerTitle ? 'border-red-500 ring-2 ring-red-200' : 'border-amber-200'} focus:ring-2 focus:ring-amber-500 outline-none transition bg-white`} />
                                        {errors.employerTitle && <p className="text-red-500 text-xs mt-1 font-bold">{errors.employerTitle}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Employer's Business Address *</label>
                                        <input type="text" name="employerAddress" value={formData.employerAddress} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.employerAddress ? 'border-red-500 ring-2 ring-red-200' : 'border-amber-200'} focus:ring-2 focus:ring-amber-500 outline-none transition bg-white`} />
                                        {errors.employerAddress && <p className="text-red-500 text-xs mt-1 font-bold">{errors.employerAddress}</p>}
                                    </div>

                                    {/* Document Logging */}
                                    <div className="md:col-span-2 pt-6 mt-2 border-t border-amber-200">
                                        <h4 className="font-bold text-amber-900 mb-4">Identity and Employment Authorization Documents Reviewed</h4>
                                    </div>

                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Document Title</label>
                                        <input type="text" name="documentTitle" value={formData.documentTitle} onChange={handleChange} placeholder="e.g. U.S. Passport" className="w-full p-4 rounded-xl border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none transition bg-white" />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Issuing Authority</label>
                                        <input type="text" name="issuingAuthority" value={formData.issuingAuthority} onChange={handleChange} className="w-full p-4 rounded-xl border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none transition bg-white" />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Document Number</label>
                                        <input type="text" name="documentNumber" value={formData.documentNumber} onChange={handleChange} className="w-full p-4 rounded-xl border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none transition bg-white" />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Expiration Date (if any)</label>
                                        <input type="date" name="expirationDate" value={formData.expirationDate} onChange={handleChange} className="w-full p-4 rounded-xl border border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none transition bg-white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                {/* Employee Signature Block */}
                                <div className="space-y-6 bg-sky-50 p-6 rounded-2xl border border-sky-200">
                                    <h3 className="font-bold text-lg text-sky-900 border-b border-sky-200 pb-2">Employee Signature (Section 1)</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-sky-800 mb-1 font-bold">Date *</label>
                                            <input type="date" name="employeeDate" value={formData.employeeDate} onChange={handleChange} className="w-full p-3 border border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <SignaturePad
                                                title="Sign Here *"
                                                height={150}
                                                initialValue={formData.employeeSignature}
                                                onSave={(val) => {
                                                    setFormData(prev => ({ ...prev, employeeSignature: val }));
                                                    setErrors(prev => ({ ...prev, employeeSignature: '' }));
                                                }}
                                            />
                                            {errors.employeeSignature && <p className="text-red-500 text-sm mt-1 font-bold">{errors.employeeSignature}</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Employer Signature Block */}
                                <div className="space-y-6 bg-amber-50 p-6 rounded-2xl border border-amber-200">
                                    <h3 className="font-bold text-lg text-amber-900 border-b border-amber-200 pb-2">Employer Signature (Section 2)</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-amber-800 mb-1 font-bold">Date *</label>
                                            <input type="date" name="employerDate" value={formData.employerDate} onChange={handleChange} className="w-full p-3 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white" />
                                        </div>
                                        <div>
                                            <SignaturePad
                                                title="Sign Here *"
                                                height={150}
                                                initialValue={formData.employerSignature}
                                                onSave={(val) => {
                                                    setFormData(prev => ({ ...prev, employerSignature: val }));
                                                    setErrors(prev => ({ ...prev, employerSignature: '' }));
                                                }}
                                            />
                                            {errors.employerSignature && <p className="text-red-500 text-sm mt-1 font-bold">{errors.employerSignature}</p>}
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
                                    <h3 className="font-bold text-green-900">I-9 Ready for Review</h3>
                                    <p className="text-green-700 text-sm">Please verify the information on your form. You can go back to any step to fix errors.</p>
                                </div>
                            </div>

                            <div className="border rounded-2xl overflow-hidden shadow-inner bg-gray-100">
                                {previewFile ? (
                                    <PDFLivePreview file={previewFile} className="max-h-[600px]" />
                                ) : (
                                    <div className="h-[400px] flex items-center justify-center">
                                        <Loader2 className="animate-spin text-sky-600" size={32} />
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
                            className={`flex items-center gap-2 font-bold px-8 py-4 text-white rounded-xl shadow-lg transition active:scale-95 disabled:opacity-70
                                ${currentStep === 2 ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-sky-600 hover:bg-sky-700 shadow-sky-200'}`}
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
                            <Download size={20} /> Download Final I-9
                        </button>
                    )}
                </div>
                {reviewAsk}
            </div>
        </div>
    );
}
