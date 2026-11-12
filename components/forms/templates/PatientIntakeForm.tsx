'use client';

import { downloadBlob } from '@/lib/utils';
import { useState } from 'react';
import { fillPdfForm } from '@/lib/pdf-generation';
import { patientIntakeTemplate, formDefinitions } from '@/lib/form-templates-data';
import { Loader2, ArrowRight, ArrowLeft, User, PhoneCall, Stethoscope, Activity, PenTool, CheckCircle2, Download, Shield } from 'lucide-react';
import { SignaturePad } from '../SignaturePad';
import { useFormPersist } from '@/hooks/useFormPersist';
import { useReviewAskAfterSuccess } from '@/hooks/useReviewAskAfterSuccess';
import { PDFLivePreview } from '@/components/PDFLivePreview';

const STEPS = [
    { id: 1, title: 'Personal Info', icon: User },
    { id: 2, title: 'Emergency Contact', icon: PhoneCall },
    { id: 3, title: 'Medical History', icon: Activity },
    { id: 4, title: 'Insurance & Visit', icon: Stethoscope },
    { id: 5, title: 'Sign & Finish', icon: PenTool },
    { id: 6, title: 'Review', icon: CheckCircle2 },
];

export function PatientIntakeForm() {
    const { markSuccess, reviewAsk } = useReviewAskAfterSuccess();
    const { formData, setFormData, isLoaded, clearPersistedData, hasDraft } = useFormPersist('patient_intake_form', {
        fullName: '',
        dob: '',
        gender: '',
        address: '',
        phone: '',
        email: '',
        emergencyName: '',
        emergencyRelationship: '',
        emergencyPhone: '',
        primaryPhysician: '',
        insuranceProvider: '',
        policyNumber: '',
        reasonForVisit: '',
        medications: '',
        allergies: '',
        mhDiabetes: false,
        mhHypertension: false,
        mhHeartDisease: false,
        mhAsthma: false,
        mhCancer: false,
        mhNone: false,
        patientSignature: '',
        date: new Date().toISOString().split('T')[0]
    }, {
        // Never persist sensitive data to localStorage
        excludeKeys: ['dob', 'patientSignature']
    });

    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    const def = formDefinitions.patient;

    if (!isLoaded) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        let finalValue: string | boolean = value;
        if (type === 'checkbox') {
            finalValue = (e.target as HTMLInputElement).checked;
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateStep = (step: number) => {
        const newErrors: Record<string, string> = {};
        if (step === 1) {
            if (!formData.fullName) newErrors.fullName = 'Required';
            if (!formData.dob) newErrors.dob = 'Required';
            if (!formData.phone) newErrors.phone = 'Required';
        }
        if (step === 2) {
            if (!formData.emergencyName) newErrors.emergencyName = 'Required';
            if (!formData.emergencyPhone) newErrors.emergencyPhone = 'Required';
        }
        if (step === 3) {
            // Optional checkboxes and multiline inputs
        }
        if (step === 4) {
            if (!formData.reasonForVisit) newErrors.reasonForVisit = 'Required';
        }
        if (step === 5) {
            if (!formData.patientSignature) newErrors.patientSignature = 'Signature Required';
            if (!formData.date) newErrors.date = 'Required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = async () => {
        if (validateStep(currentStep)) {
            if (currentStep === 5) {
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
            const pdfBytes = await fillPdfForm(patientIntakeTemplate, formData, def.fields);
            const file = new File([pdfBytes as any], 'Patient_Intake_Preview.pdf', { type: 'application/pdf' });
            setPreviewFile(file);
            setCurrentStep(6);
        } catch (err) {
            console.error(err);
            alert('Failed to generate preview');
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadPdf = () => {
        if (!previewFile) return;
        downloadBlob(previewFile, 'Patient_Intake_Completed.pdf');
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
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-600 rounded-full z-0 transition-all duration-500 ease-in-out" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}></div>

                {STEPS.map((step) => {
                    const Icon = step.icon;
                    const isCompleted = currentStep > step.id;
                    const isCurrent = currentStep === step.id;

                    return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors duration-300
                                    ${isCompleted ? 'bg-emerald-600 border-emerald-100 text-white' :
                                        isCurrent ? 'bg-white border-emerald-600 text-emerald-600 shadow-md' :
                                            'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                    {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                                </div>
                                <span className={`text-xs font-bold pt-1 uppercase tracking-wider hidden sm:block whitespace-nowrap
                ${isCurrent ? 'text-emerald-800' : isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                {step.title}
            </span>
        </div>
    );
})}
                </div >
            </div >

    {hasDraft && (
        <div className="flex items-center justify-end gap-2 mb-4 text-xs text-gray-500">
            <span>Draft saved on this device (date of birth and signature are not stored).</span>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Legal Full Name *</label>
                            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.fullName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-emerald-500 outline-none transition bg-gray-50/50`} placeholder="e.g. John Doe" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth *</label>
                            <input type="date" name="dob" value={formData.dob} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.dob ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-emerald-500 outline-none transition bg-gray-50/50`} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Gender</label>
                            <div className="flex gap-4 p-4 border border-gray-300 rounded-xl bg-gray-50/50">
                                {['Male', 'Female', 'Other'].map(opt => (
                                    <label key={opt} className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                                        <input type="radio" name="gender" value={opt} checked={formData.gender === opt} onChange={handleChange} className="text-emerald-600 w-5 h-5 focus:ring-emerald-500" />
                                        <span>{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Full Home Address</label>
                            <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none transition bg-gray-50/50" placeholder="Street, City, State ZIP" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number *</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.phone ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-emerald-500 outline-none transition bg-gray-50/50`} placeholder="(555) 123-4567" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none transition bg-gray-50/50" placeholder="john@example.com" />
                        </div>
                    </div>
                </div>
            )}

            {currentStep === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-orange-50/80 p-8 rounded-2xl border border-orange-200 shadow-inner">
                        <div className="flex items-center gap-4 mb-6 text-orange-900 border-b border-orange-200 pb-4">
                            <div className="bg-orange-100 p-3 rounded-full">
                                <PhoneCall size={24} className="text-orange-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Emergency Contact Information</h3>
                                <p className="text-sm text-orange-700/80">In case of emergency, who should we contact?</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-orange-900 mb-2">Full Name *</label>
                                <input type="text" name="emergencyName" value={formData.emergencyName} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.emergencyName ? 'border-red-500 ring-2 ring-red-200' : 'border-orange-300'} focus:ring-2 focus:ring-orange-500 outline-none transition bg-white shadow-sm`} placeholder="Jane Doe" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-orange-900 mb-2">Relationship</label>
                                <input type="text" name="emergencyRelationship" value={formData.emergencyRelationship} onChange={handleChange} className="w-full p-4 rounded-xl border border-orange-300 focus:ring-2 focus:ring-orange-500 outline-none transition bg-white shadow-sm" placeholder="e.g. Spouse, Parent" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-orange-900 mb-2">Phone Number *</label>
                                <input type="tel" name="emergencyPhone" value={formData.emergencyPhone} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.emergencyPhone ? 'border-red-500 ring-2 ring-red-200' : 'border-orange-300'} focus:ring-2 focus:ring-orange-500 outline-none transition bg-white shadow-sm`} placeholder="(555) 987-6543" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 text-rose-800">Current Medications</label>
                            <textarea name="medications" value={formData.medications} rows={4} onChange={handleChange} className="w-full p-4 rounded-xl border border-rose-200 bg-rose-50/30 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition shadow-inner resize-none" placeholder="List medications and dosages (e.g., Lisinopril 10mg daily)"></textarea>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 text-rose-800">Known Allergies</label>
                            <textarea name="allergies" value={formData.allergies} rows={4} onChange={handleChange} className="w-full p-4 rounded-xl border border-rose-200 bg-rose-50/30 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition shadow-inner resize-none" placeholder="List any drug, food, or environmental allergies"></textarea>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-8 rounded-2xl border border-gray-200">
                        <label className="block text-lg font-bold text-gray-900 mb-2 border-b border-gray-200 pb-3">Past Medical History</label>
                        <p className="text-gray-500 text-sm mb-6">Please check any conditions that you have been diagnosed with.</p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {[
                                { name: 'mhDiabetes', label: 'Diabetes' },
                                { name: 'mhHypertension', label: 'Hypertension' },
                                { name: 'mhHeartDisease', label: 'Heart Disease' },
                                { name: 'mhAsthma', label: 'Asthma' },
                                { name: 'mhCancer', label: 'Cancer' },
                                { name: 'mhNone', label: 'None of the Above' }
                            ].map(opt => (
                                <label key={opt.name} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition select-none
                            ${(formData as any)[opt.name] ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                            <input type="checkbox" name={opt.name} checked={(formData as any)[opt.name] === true} onChange={handleChange} className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500" />
                            <span className={`font-medium ${(formData as any)[opt.name] ? 'text-emerald-900' : 'text-gray-700'}`}>{opt.label}</span>
                    </label>
                                    ))}
                </div>
                            </div>
                        </div >
                    )}

{
    currentStep === 4 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Reason for Today's Visit *</label>
                <input type="text" name="reasonForVisit" value={formData.reasonForVisit} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.reasonForVisit ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50/50`} placeholder="e.g. Annual Checkup, Sick Visit, Follow-up" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 p-6 md:p-8 rounded-2xl border border-blue-100">
                <div className="md:col-span-2">
                    <h3 className="font-bold text-blue-900 mb-2">Insurance Information</h3>
                    <p className="text-sm text-blue-700/80 mb-6">For billing purposes, please provide your primary insurance details.</p>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Insurance Provider / Carrier</label>
                    <input type="text" name="insuranceProvider" value={formData.insuranceProvider} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white" placeholder="e.g. Blue Cross Blue Shield, Aetna" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Policy / Member #</label>
                    <input type="text" name="policyNumber" value={formData.policyNumber} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Primary Care Physician</label>
                    <input type="text" name="primaryPhysician" value={formData.primaryPhysician} onChange={handleChange} className="w-full p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition bg-white" placeholder="Dr. Smith" />
                </div>
            </div>
        </div>
    )
}

                    {currentStep === 5 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-gray-50/80 p-8 rounded-2xl border border-gray-200">
                                <h3 className="font-bold text-xl text-gray-900 border-b pb-4 mb-6 flex items-center gap-3">
                                    <Shield className="text-gray-400" /> Signature & Authorization
                                </h3>

                                <p className="text-gray-600 mb-8 leading-relaxed text-sm">
                                    By signing below, I certify that the information I have provided on this intake form is complete and accurate to the best of my knowledge. I authorize the release of any medical or other information necessary to process claims.
                                </p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                                    <div className="space-y-4">
                                        <SignaturePad
                                            title="Patient / Guardian Signature *"
                                            height={150}
                                            initialValue={formData.patientSignature}
                                            onSave={(val) => {
                                                setFormData(prev => ({ ...prev, patientSignature: val }));
                                                setErrors(prev => ({ ...prev, patientSignature: '' }));
                                            }}
                                        />
                                        {errors.patientSignature && <p className="text-red-500 text-sm font-bold">{errors.patientSignature}</p>}
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Date *</label>
                                            <input type="date" name="date" value={formData.date} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.date ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-emerald-500 outline-none transition bg-white`} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 6 && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-green-50 p-6 rounded-2xl border border-green-200 flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-green-900">Form Ready for Review</h3>
                                    <p className="text-green-700 text-sm">Please verify the details below. If anything is incorrect, you can go back and edit.</p>
                                </div>
                            </div>

                            <div className="border rounded-2xl overflow-hidden shadow-inner bg-gray-100">
                                {previewFile ? (
                                    <PDFLivePreview file={previewFile} className="max-h-[600px]" />
                                ) : (
                                    <div className="h-[400px] flex items-center justify-center">
                                        <Loader2 className="animate-spin text-emerald-600" size={32} />
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
                            className="flex items-center gap-2 font-bold px-8 py-4 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 transition active:scale-95 disabled:opacity-70"
                        >
                            {isGenerating ? (
                                <><Loader2 className="animate-spin" size={20} /> Preparing Preview...</>
                            ) : (
                                <>{currentStep === 5 ? 'Review PDF' : 'Next Step'} <ArrowRight size={20} /></>
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
                {reviewAsk}
            </div>
        </div>
    );
}
