'use client';

import { downloadBlob } from '@/lib/utils';
import { useState } from 'react';
import { fillPdfForm } from '@/lib/pdf-generation';
import { Loader2, ArrowRight, ArrowLeft, Users, Briefcase, Wallet, Scale, PenTool, CheckCircle2, Download } from 'lucide-react';
import { SignaturePad } from '../SignaturePad';
import { useFormPersist } from '@/hooks/useFormPersist';
import { PDFLivePreview } from '@/components/PDFLivePreview';

// Wizard steps mirror the `section` entries of
// bilingualFormDefinitions.employmentBilingual.fields (lib/form-templates-bilingual-data.ts),
// plus a final Review step. The heavy data module is imported dynamically in
// generatePreview() so the ~770KB of base64 templates stays out of the initial chunk.
const STEPS = [
    { id: 1, title: '1. Parties', titleAr: '١. الطرفان', icon: Users },
    { id: 2, title: '2. Position & Term', titleAr: '٢. الوظيفة والمدة', icon: Briefcase },
    { id: 3, title: '3. Compensation & Working Hours', titleAr: '٣. الأجر وساعات العمل', icon: Wallet },
    { id: 4, title: '4. Termination & Governing Law', titleAr: '٤. إنهاء العقد والقانون الواجب التطبيق', icon: Scale },
    { id: 5, title: '5. Signatures — Employer', titleAr: '٥. التوقيعات — صاحب العمل', icon: PenTool },
    { id: 6, title: '6. Signatures — Employee', titleAr: '٦. التوقيعات — الموظف', icon: PenTool },
    { id: 7, title: 'Review', titleAr: 'المراجعة', icon: CheckCircle2 },
];

// Short header captions so the progress bar stays readable.
const STEP_CAPTIONS = ['Parties', 'Position', 'Pay & Hours', 'Termination', 'Employer', 'Employee', 'Review'];

function BilingualLabel({ en, ar, required, className }: { en: string; ar: string; required?: boolean; className?: string }) {
    return (
        <label className={className ?? 'flex items-baseline justify-between gap-3 text-sm font-bold text-gray-700 mb-2'}>
            <span>{en}{required && ' *'}</span>
            <span dir="rtl" lang="ar" className="font-semibold text-gray-500">{ar}</span>
        </label>
    );
}

export function EmploymentContractBilingualForm() {
    const { formData, setFormData, isLoaded, clearPersistedData, hasDraft } = useFormPersist('employment-bilingual', {
        employerName: '',
        employerAddress: '',
        employeeName: '',
        employeeId: '',
        employeeAddress: '',
        jobTitle: '',
        workLocation: '',
        startDate: '',
        contractType: 'Fixed-Term',
        contractDuration: '',
        probationMonths: '',
        monthlySalary: '',
        allowances: '',
        weeklyHours: '',
        annualLeaveDays: '',
        noticeDays: '',
        governingLaw: '',
        employerSignatoryName: '',
        employerSignature: '',
        employerSignDate: '',
        employeeSignature: '',
        employeeSignDate: ''
    }, {
        // Never persist signature data to localStorage
        excludeKeys: ['employerSignature', 'employeeSignature']
    });

    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewFile, setPreviewFile] = useState<File | null>(null);

    if (!isLoaded) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const isFixedTerm = formData.contractType === 'Fixed-Term';

    const validateStep = (step: number) => {
        const newErrors: Record<string, string> = {};
        if (step === 1) {
            if (!formData.employerName) newErrors.employerName = 'Required';
            if (!formData.employeeName) newErrors.employeeName = 'Required';
        }
        if (step === 2) {
            if (!formData.jobTitle) newErrors.jobTitle = 'Required';
            if (!formData.startDate) newErrors.startDate = 'Required';
            if (isFixedTerm && !formData.contractDuration) newErrors.contractDuration = 'Required';
        }
        if (step === 3) {
            if (!formData.monthlySalary) newErrors.monthlySalary = 'Required';
        }
        if (step === 5) {
            if (!formData.employerSignature) newErrors.employerSignature = 'Signature Required';
        }
        if (step === 6) {
            if (!formData.employeeSignature) newErrors.employeeSignature = 'Signature Required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const generatePreview = async () => {
        setIsGenerating(true);
        try {
            // Dynamic import keeps the ~770KB base64 template module out of the initial bundle.
            const { employmentBilingualTemplate, bilingualFormDefinitions } = await import('@/lib/form-templates-bilingual-data');
            const pdfBytes = await fillPdfForm(employmentBilingualTemplate, formData, bilingualFormDefinitions.employmentBilingual.fields);
            const file = new File([pdfBytes as any], 'Bilingual_Employment_Contract_Preview.pdf', { type: 'application/pdf' });
            setPreviewFile(file);
            setCurrentStep(7);
        } catch (err) {
            console.error(err);
            alert('Failed to generate preview');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleNext = async () => {
        if (validateStep(currentStep)) {
            if (currentStep === 6) {
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
        downloadBlob(previewFile, 'Bilingual_Employment_Contract_Completed.pdf');
        clearPersistedData();
        setCurrentStep(1);
        setPreviewFile(null);
    };

    const inputClass = (name: string) =>
        `w-full p-4 rounded-xl border ${errors[name] ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white`;

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
                                    {STEP_CAPTIONS[step.id - 1]}
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
                        <span>{STEPS[currentStep - 1].title}</span>
                        <span dir="rtl" lang="ar" className="text-2xl font-bold text-gray-500">{STEPS[currentStep - 1].titleAr}</span>
                    </h2>

                    {currentStep === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-6 md:p-8 border border-blue-100 rounded-2xl bg-blue-50/30">
                                    <h3 className="font-bold text-lg mb-6 text-blue-900 flex items-center gap-2">
                                        <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm">A</span>
                                        Employer <span dir="rtl" lang="ar" className="text-blue-700">صاحب العمل</span>
                                    </h3>
                                    <div className="space-y-5">
                                        <div>
                                            <BilingualLabel en="Employer — Company / Full Name" ar="صاحب العمل — اسم الشركة / الاسم الكامل" required />
                                            <input type="text" dir="auto" name="employerName" value={formData.employerName} onChange={handleChange} className={inputClass('employerName')} placeholder="Acme LLC" />
                                            {errors.employerName && <p className="text-red-500 text-xs mt-1">{errors.employerName}</p>}
                                        </div>
                                        <div>
                                            <BilingualLabel en="Employer — Address" ar="صاحب العمل — العنوان" />
                                            <input type="text" dir="auto" name="employerAddress" value={formData.employerAddress} onChange={handleChange} className={inputClass('employerAddress')} placeholder="123 Main St, City" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 md:p-8 border border-purple-100 rounded-2xl bg-purple-50/30">
                                    <h3 className="font-bold text-lg mb-6 text-purple-900 flex items-center gap-2">
                                        <span className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm">B</span>
                                        Employee <span dir="rtl" lang="ar" className="text-purple-700">الموظف</span>
                                    </h3>
                                    <div className="space-y-5">
                                        <div>
                                            <BilingualLabel en="Employee — Full Name" ar="الموظف — الاسم الكامل" required />
                                            <input type="text" dir="auto" name="employeeName" value={formData.employeeName} onChange={handleChange} className={inputClass('employeeName')} placeholder="Jane Doe" />
                                            {errors.employeeName && <p className="text-red-500 text-xs mt-1">{errors.employeeName}</p>}
                                        </div>
                                        <div>
                                            <BilingualLabel en="Employee — National ID / Passport No." ar="الموظف — رقم الهوية / جواز السفر" />
                                            <input type="text" dir="auto" name="employeeId" value={formData.employeeId} onChange={handleChange} className={inputClass('employeeId')} />
                                        </div>
                                        <div>
                                            <BilingualLabel en="Employee — Address" ar="الموظف — العنوان" />
                                            <input type="text" dir="auto" name="employeeAddress" value={formData.employeeAddress} onChange={handleChange} className={inputClass('employeeAddress')} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <BilingualLabel en="Job Title" ar="المسمى الوظيفي" required />
                                    <input type="text" dir="auto" name="jobTitle" value={formData.jobTitle} onChange={handleChange} className={inputClass('jobTitle')} placeholder="e.g. Software Engineer" />
                                    {errors.jobTitle && <p className="text-red-500 text-xs mt-1">{errors.jobTitle}</p>}
                                </div>
                                <div>
                                    <BilingualLabel en="Place of Work" ar="مكان العمل" />
                                    <input type="text" dir="auto" name="workLocation" value={formData.workLocation} onChange={handleChange} className={inputClass('workLocation')} />
                                </div>
                                <div>
                                    <BilingualLabel en="Start Date" ar="تاريخ المباشرة" required />
                                    <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className={inputClass('startDate')} />
                                    {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
                                </div>
                            </div>

                            <div>
                                <BilingualLabel en="Contract Type" ar="نوع العقد" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, contractType: 'Fixed-Term' }))}
                                        className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 ${isFixedTerm ? 'border-blue-500 bg-blue-50/50 shadow-md ring-4 ring-blue-500/10' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                                    >
                                        <h3 className={`text-lg font-bold flex items-baseline justify-between gap-3 ${isFixedTerm ? 'text-blue-900' : 'text-gray-900'}`}>
                                            <span>Fixed-term</span>
                                            <span dir="rtl" lang="ar" className="font-semibold text-gray-500">محدد المدة</span>
                                        </h3>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, contractType: 'Indefinite' }))}
                                        className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 ${!isFixedTerm ? 'border-blue-500 bg-blue-50/50 shadow-md ring-4 ring-blue-500/10' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
                                    >
                                        <h3 className={`text-lg font-bold flex items-baseline justify-between gap-3 ${!isFixedTerm ? 'text-blue-900' : 'text-gray-900'}`}>
                                            <span>Indefinite</span>
                                            <span dir="rtl" lang="ar" className="font-semibold text-gray-500">غير محدد المدة</span>
                                        </h3>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <BilingualLabel en="Duration (if fixed-term)" ar="مدة العقد (إذا كان محدد المدة)" required={isFixedTerm} />
                                    <input type="text" dir="auto" name="contractDuration" value={formData.contractDuration} onChange={handleChange} disabled={!isFixedTerm} className={`${inputClass('contractDuration')} ${!isFixedTerm ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} placeholder="e.g. 2 years" />
                                    {errors.contractDuration && <p className="text-red-500 text-xs mt-1">{errors.contractDuration}</p>}
                                </div>
                                <div>
                                    <BilingualLabel en="Probation Period (months)" ar="فترة التجربة (بالأشهر)" />
                                    <input type="text" dir="auto" name="probationMonths" value={formData.probationMonths} onChange={handleChange} className={inputClass('probationMonths')} placeholder="e.g. 3" />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <BilingualLabel en="Basic Monthly Salary" ar="الراتب الشهري الأساسي" required />
                                    <input type="text" dir="auto" name="monthlySalary" value={formData.monthlySalary} onChange={handleChange} className={inputClass('monthlySalary')} placeholder="e.g. 15,000 SAR" />
                                    {errors.monthlySalary && <p className="text-red-500 text-xs mt-1">{errors.monthlySalary}</p>}
                                </div>
                                <div>
                                    <BilingualLabel en="Working Hours per Week" ar="ساعات العمل الأسبوعية" />
                                    <input type="text" dir="auto" name="weeklyHours" value={formData.weeklyHours} onChange={handleChange} className={inputClass('weeklyHours')} placeholder="e.g. 40" />
                                </div>
                                <div>
                                    <BilingualLabel en="Annual Leave (days)" ar="الإجازة السنوية (بالأيام)" />
                                    <input type="text" dir="auto" name="annualLeaveDays" value={formData.annualLeaveDays} onChange={handleChange} className={inputClass('annualLeaveDays')} placeholder="e.g. 21" />
                                </div>
                            </div>

                            <div className="bg-amber-50/50 border border-amber-200 p-6 md:p-8 rounded-2xl">
                                <BilingualLabel en="Allowances & Benefits" ar="البدلات والمزايا" className="flex items-baseline justify-between gap-3 text-sm font-bold text-amber-900 mb-2" />
                                <p className="text-sm text-amber-700 mb-4 tracking-wide leading-relaxed">Housing, transport, medical insurance, or any other allowances. Leave blank if none.</p>
                                <textarea dir="auto" name="allowances" value={formData.allowances} rows={4} onChange={handleChange} className="w-full p-4 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition bg-white shadow-inner resize-none" placeholder="Describe allowances and benefits..." />
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <BilingualLabel en="Notice Period (days)" ar="مدة الإشعار (بالأيام)" />
                                    <input type="text" dir="auto" name="noticeDays" value={formData.noticeDays} onChange={handleChange} className={inputClass('noticeDays')} placeholder="e.g. 30" />
                                </div>
                                <div>
                                    <BilingualLabel en="Governing labour law / jurisdiction" ar="قانون العمل الواجب التطبيق / الاختصاص القضائي" />
                                    <input type="text" dir="auto" name="governingLaw" value={formData.governingLaw} onChange={handleChange} className={inputClass('governingLaw')} placeholder="e.g. Saudi Labour Law" />
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 5 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <p className="text-gray-600 text-lg">Please draw the employer&apos;s signature below. It will be natively embedded into your final generated PDF document.</p>
                            <div className="space-y-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <BilingualLabel en="Name & Title" ar="الاسم والصفة" />
                                        <input type="text" dir="auto" name="employerSignatoryName" value={formData.employerSignatoryName} onChange={handleChange} className={inputClass('employerSignatoryName')} placeholder="e.g. John Smith, HR Director" />
                                    </div>
                                    <div>
                                        <BilingualLabel en="Date" ar="التاريخ" />
                                        <input type="date" name="employerSignDate" value={formData.employerSignDate} onChange={handleChange} className={inputClass('employerSignDate')} />
                                    </div>
                                </div>
                                <div>
                                    <BilingualLabel en="Signature" ar="التوقيع" required />
                                    <SignaturePad
                                        title="Draw Signature *"
                                        height={150}
                                        initialValue={formData.employerSignature}
                                        onSave={(val) => {
                                            setFormData(prev => ({ ...prev, employerSignature: val }));
                                            setErrors(prev => ({ ...prev, employerSignature: '' }));
                                        }}
                                    />
                                    {errors.employerSignature && <p className="text-red-500 text-xs mt-1 font-bold">{errors.employerSignature}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 6 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <p className="text-gray-600 text-lg">Please draw the employee&apos;s signature below. It will be natively embedded into your final generated PDF document.</p>
                            <div className="space-y-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-200">
                                <div>
                                    <BilingualLabel en="Date" ar="التاريخ" />
                                    <input type="date" name="employeeSignDate" value={formData.employeeSignDate} onChange={handleChange} className={inputClass('employeeSignDate')} />
                                </div>
                                <div>
                                    <BilingualLabel en="Signature" ar="التوقيع" required />
                                    <SignaturePad
                                        title="Draw Signature *"
                                        height={150}
                                        initialValue={formData.employeeSignature}
                                        onSave={(val) => {
                                            setFormData(prev => ({ ...prev, employeeSignature: val }));
                                            setErrors(prev => ({ ...prev, employeeSignature: '' }));
                                        }}
                                    />
                                    {errors.employeeSignature && <p className="text-red-500 text-xs mt-1 font-bold">{errors.employeeSignature}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 7 && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-green-50 p-6 rounded-2xl border border-green-200 flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-green-900">Employment Contract Ready for Review</h3>
                                    <p className="text-green-700 text-sm">Please review the generated bilingual contract. You can go back to any step if you need to make changes.</p>
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
                            <>{currentStep === 6 ? 'Review & Sign' : 'Next Step'} <ArrowRight size={20} /></>
                        )}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={downloadPdf}
                        className="flex items-center gap-2 font-bold px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition active:scale-95"
                    >
                        <Download size={20} /> Download Final Contract
                    </button>
                )}
            </div>
        </div>
    );
}
