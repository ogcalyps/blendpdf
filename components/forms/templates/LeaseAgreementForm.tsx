'use client';

import { downloadBlob } from '@/lib/utils';
import { useState, useRef } from 'react';
import { Loader2, Plus, Trash2, ArrowRight, ArrowLeft, Building, Users, DollarSign, Settings, FileText, CheckCircle2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SignaturePad } from '../SignaturePad';
import { useFormPersist } from '@/hooks/useFormPersist';
import { useReviewAskAfterSuccess } from '@/hooks/useReviewAskAfterSuccess';
import { PDFLivePreview } from '@/components/PDFLivePreview';

const STEPS = [
    { id: 1, title: 'The Parties', icon: Users },
    { id: 2, title: 'Property & Term', icon: Building },
    { id: 3, title: 'Rent & Deposits', icon: DollarSign },
    { id: 4, title: 'Clauses & Policies', icon: Settings },
    { id: 5, title: 'Preview & Sign', icon: FileText },
    { id: 6, title: 'Final Review', icon: CheckCircle2 },
];

const OPTIONAL_CLAUSES = [
    { id: 'clauseSubletting', title: 'Subletting & Assignment', content: 'Tenant shall not assign this Agreement, or sublet or grant any license to use the Premises or any part thereof without the prior written consent of Landlord.' },
    { id: 'clauseMaintenance', title: 'Maintenance & Repair', content: 'Tenant will, at its sole expense, keep and maintain the Premises and appurtenances in good and sanitary condition and repair during the term of this Agreement and any renewal thereof.' },
    { id: 'clauseQuietEnjoyment', title: 'Quiet Enjoyment', content: 'Tenant, upon payment of all of the sums referred to herein as being payable by Tenant and Tenant\'s performance of all Tenant\'s agreements contained herein and Tenant\'s observance of all rules and regulations, shall and may peacefully and quietly have, hold and enjoy said Premises for the term hereof.' },
    { id: 'clauseEarlyTermination', title: 'Early Termination', content: 'Tenant may, upon 60 days\' written notice to Landlord, terminate this lease provided that the Tenant pays a termination charge equal to two (2) months\' rent or the maximum amount allowed by law, whichever is less.' },
    { id: 'clauseSmokingPolicy', title: 'Smoking Policy', content: 'Smoking of any kind is strictly prohibited within the Premises and all common areas. This includes, but is not limited to, cigarettes, cigars, pipes, e-cigarettes, and vaping devices.' },
    { id: 'clauseJointLiability', title: 'Joint and Several Liability', content: 'If there is more than one Tenant, each one shall be individually and completely responsible for the performance of all obligations of Tenant under this Agreement, jointly with every other Tenant, and individually, whether or not in possession.' },
    { id: 'clauseRentersInsurance', title: 'Renter\'s Insurance', content: 'Tenant is required to obtain and maintain a renter\'s insurance policy providing liability coverage and protection for personal property for the duration of this lease. Tenant must provide proof of such insurance to Landlord upon request.' },
    { id: 'clauseMilitary', title: 'Military Clause', content: 'In the event Tenant is, or hereafter becomes, a member of the United States Armed Forces on extended active duty and receives change of station orders to depart from the area, Tenant may terminate this lease upon giving thirty (30) days written notice to Landlord.' },
    { id: 'clauseDefault', title: 'Default', content: 'If Tenant fails to comply with any of the material provisions of this Agreement, or of any present rules and regulations, Landlord may terminate this Agreement upon providing proper notice to Tenant.' },
    { id: 'clauseSeverability', title: 'Severability', content: 'If any provision of this Agreement or the application thereof shall, for any reason and to any extent, be invalid or unenforceable, neither the remainder of this Agreement nor the application of the provision to other persons, entities or circumstances shall be affected thereby.' }
];

export function LeaseAgreementForm() {
    const { markSuccess, reviewAsk } = useReviewAskAfterSuccess();
    const { formData, setFormData, isLoaded, clearPersistedData, hasDraft } = useFormPersist('lease_agreement_form', {
        landlordName: '',
        landlordAddress: '',
        tenants: [''],
        propertyAddress: '',
        leaseStartDate: '',
        leaseEndDate: '',
        governingState: '',
        monthlyRent: '',
        securityDeposit: '',
        lateFee: '',
        petsAllowed: 'No',
        petDeposit: '',
        utilityWater: false,
        utilityElectricity: false,
        utilityGas: false,
        utilityInternet: false,
        clauseSubletting: true,
        clauseMaintenance: true,
        clauseQuietEnjoyment: true,
        clauseEarlyTermination: false,
        clauseSmokingPolicy: true,
        clauseJointLiability: true,
        clauseRentersInsurance: false,
        clauseMilitary: false,
        clauseDefault: true,
        clauseSeverability: true,
        landlordSignature: '',
        tenantSignatures: [''], // Array corresponding to tenants array
    }, {
        // Never persist signature data to localStorage
        excludeKeys: ['landlordSignature', 'tenantSignatures']
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    if (!isLoaded) return null;

    const tenants = formData.tenants || [''];
    const tenantSignatures = formData.tenantSignatures || [''];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        let finalValue: string | boolean = value;
        if (type === 'checkbox') {
            finalValue = (e.target as HTMLInputElement).checked;
        }

        setFormData(prev => ({ ...prev, [name]: finalValue }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleTenantChange = (index: number, val: string) => {
        const newTenants = [...tenants];
        newTenants[index] = val;
        setFormData(prev => ({ ...prev, tenants: newTenants }));
    };

    const handleTenantSignatureChange = (index: number, val: string) => {
        const newSignatures = [...tenantSignatures];
        newSignatures[index] = val;
        setFormData(prev => ({ ...prev, tenantSignatures: newSignatures }));
        if (errors[`tenantSignature_${index}`]) {
            setErrors(prev => ({ ...prev, [`tenantSignature_${index}`]: '' }));
        }
    };

    const addTenant = () => {
        setFormData(prev => ({
            ...prev,
            tenants: [...tenants, ''],
            tenantSignatures: [...tenantSignatures, '']
        }));
    };

    const removeTenant = (idx: number) => {
        if (tenants.length > 1) {
            setFormData(prev => ({
                ...prev,
                tenants: tenants.filter((_, i) => i !== idx),
                tenantSignatures: tenantSignatures.filter((_, i) => i !== idx)
            }));
        }
    };

    const validateStep = (step: number) => {
        const newErrors: Record<string, string> = {};

        if (step === 1) {
            if (!formData.landlordName) newErrors.landlordName = 'Required';
            if (!formData.landlordAddress) newErrors.landlordAddress = 'Required';
            if (tenants.every(t => t.trim() === '')) {
                newErrors.tenants = 'At least one tenant is required';
            }
        }

        if (step === 2) {
            if (!formData.propertyAddress) newErrors.propertyAddress = 'Required';
            if (!formData.leaseStartDate) newErrors.leaseStartDate = 'Required';
            if (!formData.leaseEndDate) newErrors.leaseEndDate = 'Required';
            if (!formData.governingState) newErrors.governingState = 'Required';
        }

        if (step === 3) {
            if (!formData.monthlyRent) newErrors.monthlyRent = 'Required';
            if (!formData.securityDeposit) newErrors.securityDeposit = 'Required';
        }

        if (step === 5) {
            if (!formData.landlordSignature) newErrors.landlordSignature = 'Landlord Signature Required';

            const vt = tenants.filter(t => t.trim() !== '');
            vt.forEach((t, i) => {
                if (!tenantSignatures[i]) {
                    newErrors[`tenantSignature_${i}`] = 'Signature Required';
                }
            });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const generatePreview = async () => {
        if (!previewRef.current) return;

        setIsGenerating(true);
        try {
            const canvas = await html2canvas(previewRef.current, {
                scale: 3,
                useCORS: true,
                logging: false,
                windowWidth: previewRef.current.scrollWidth,
                windowHeight: previewRef.current.scrollHeight
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            let heightLeft = pdfHeight;
            let position = 0;
            const pageHeight = pdf.internal.pageSize.getHeight();

            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
                heightLeft -= pageHeight;
            }

            const pdfBlob = pdf.output('blob');
            const file = new File([pdfBlob], 'Lease_Agreement_Preview.pdf', { type: 'application/pdf' });
            setPreviewFile(file);
            setCurrentStep(6);
        } catch (error) {
            console.error('Failed to generate preview', error);
            alert('An error occurred while generating the preview. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadPdf = () => {
        if (!previewFile) return;
        downloadBlob(previewFile, 'Residential_Lease_Agreement.pdf');
        markSuccess();

        clearPersistedData();
        setCurrentStep(1);
        setPreviewFile(null);
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

    const validTenants = tenants.filter(t => t.trim() !== '');

    return (
        <div className="max-w-5xl mx-auto">
            {/* Wizard Progress Header */}
            <div className="mb-10">
                <div className="flex justify-between items-center relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full z-0"></div>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-violet-600 rounded-full z-0 transition-all duration-500 ease-in-out" style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}></div>

                    {STEPS.map((step) => {
                        const Icon = step.icon;
                        const isCompleted = currentStep > step.id;
                        const isCurrent = currentStep === step.id;

                        return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors duration-300
                                    ${isCompleted ? 'bg-violet-600 border-violet-100 text-white' :
                                        isCurrent ? 'bg-white border-violet-600 text-violet-600 shadow-md' :
                                            'bg-gray-50 border-gray-200 text-gray-400'}`}>
                                    {isCompleted ? <CheckCircle2 size={24} /> : <Icon size={24} />}
                                </div>
                                <span className={`text-xs font-bold pt-1 uppercase tracking-wider hidden sm:block whitespace-nowrap
                                    ${isCurrent ? 'text-violet-800' : isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Landlord Name *</label>
                                    <input type="text" name="landlordName" value={formData.landlordName || ''} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.landlordName ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-violet-500 outline-none transition bg-gray-50/50`} placeholder="e.g. John Smith" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Landlord Address *</label>
                                    <input type="text" name="landlordAddress" value={formData.landlordAddress || ''} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.landlordAddress ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-violet-500 outline-none transition bg-gray-50/50`} placeholder="123 Main St, City, ST 12345" />
                                </div>
                            </div>

                            <div className="bg-violet-50/50 p-6 md:p-8 rounded-2xl border border-violet-100 shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-violet-200 pb-4">
                                    <div>
                                        <label className="block font-bold text-violet-900 text-lg">Tenant Information *</label>
                                        <p className="text-sm text-violet-700/80">List all individuals signing the lease</p>
                                    </div>
                                    <button type="button" onClick={addTenant} className="bg-white text-violet-600 px-4 py-2 rounded-lg font-bold text-sm border border-violet-200 shadow-sm hover:bg-violet-50 flex items-center gap-2 transition active:scale-95"><Plus size={16} /> Add Tenant</button>
                                </div>
                                <div className="space-y-4">
                                    {tenants.map((t, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className="flex-1 relative">
                                                <input type="text" placeholder={`Tenant ${i + 1} Name`} value={t} onChange={(e) => handleTenantChange(i, e.target.value)} className={`w-full p-4 rounded-xl border ${errors.tenants && !t ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-violet-500 outline-none transition`} />
                                            </div>
                                            {tenants.length > 1 && (
                                                <button type="button" onClick={() => removeTenant(i)} className="p-4 text-red-500 hover:bg-red-50 hover:text-red-700 border border-transparent hover:border-red-200 rounded-xl transition"><Trash2 size={20} /></button>
                                            )}
                                        </div>
                                    ))}
                                    {errors.tenants && <p className="text-red-500 text-sm font-bold">{errors.tenants}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Property Address *</label>
                                <input type="text" name="propertyAddress" value={formData.propertyAddress || ''} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.propertyAddress ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-violet-500 outline-none transition bg-gray-50/50`} placeholder="e.g. 456 Elm St, Apt 2B, City, ST 12345" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-8 rounded-2xl border border-slate-200">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Lease Start Date *</label>
                                    <input type="date" name="leaseStartDate" value={formData.leaseStartDate || ''} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.leaseStartDate ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-violet-500 outline-none transition bg-white`} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Lease End Date *</label>
                                    <input type="date" name="leaseEndDate" value={formData.leaseEndDate || ''} onChange={handleChange} className={`w-full p-4 rounded-xl border ${errors.leaseEndDate ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-violet-500 outline-none transition bg-white`} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Governing State *</label>
                                <input type="text" name="governingState" value={formData.governingState || ''} onChange={handleChange} className={`w-full md:w-1/2 p-4 rounded-xl border ${errors.governingState ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-violet-500 outline-none transition bg-gray-50/50`} placeholder="e.g. California" />
                                <p className="text-sm text-gray-500 mt-2">The state laws that will govern this agreement.</p>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Monthly Rent *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                        <input type="number" name="monthlyRent" value={formData.monthlyRent || ''} onChange={handleChange} min="0" className={`w-full pl-9 p-4 rounded-xl border ${errors.monthlyRent ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-violet-500 outline-none transition bg-emerald-50/30`} placeholder="2000" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Security Deposit *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                        <input type="number" name="securityDeposit" value={formData.securityDeposit || ''} onChange={handleChange} min="0" className={`w-full pl-9 p-4 rounded-xl border ${errors.securityDeposit ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'} focus:ring-2 focus:ring-violet-500 outline-none transition bg-emerald-50/30`} placeholder="2000" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Late Fee</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                        <input type="number" name="lateFee" value={formData.lateFee || ''} onChange={handleChange} min="0" className="w-full pl-9 p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-violet-500 outline-none transition bg-emerald-50/30" placeholder="50" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-emerald-50 p-6 md:p-8 rounded-2xl border border-emerald-200">
                                <h3 className="font-bold text-emerald-900 mb-4 text-lg">Utilities Included in Rent</h3>
                                <p className="text-sm text-emerald-700/80 mb-6">Select which utilities the landlord is responsible for paying.</p>
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {['utilityWater', 'utilityElectricity', 'utilityGas', 'utilityInternet'].map((name) => {
                                        const label = name.replace('utility', '');
                                        const isChecked = (formData as any)[name] === true;
                                        return (
                                            <label key={name} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition select-none
                                                ${isChecked ? 'border-emerald-500 bg-white shadow-sm ring-2 ring-emerald-500/20' : 'border-emerald-200/60 bg-white/50 hover:border-emerald-300'}`}>
                                                <input type="checkbox" name={name} checked={isChecked} onChange={handleChange} className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500" />
                                                <span className={`font-semibold ${isChecked ? 'text-emerald-900' : 'text-gray-700'}`}>{label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-gray-50/80 p-6 md:p-8 rounded-2xl border border-gray-200 shadow-inner">
                                <h3 className="font-bold text-gray-900 mb-2 text-lg">Pet Policy</h3>
                                <p className="text-sm text-gray-500 mb-6 border-b border-gray-200 pb-4">Will tenants be allowed to have pets on the premises?</p>
                                 <div className="flex gap-4 mb-6">
                                    {['Yes', 'No'].map(opt => {
                                        const isSelected = formData.petsAllowed === opt;
                                        return (
                                            <label key={opt} className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition select-none
                                                ${isSelected ? 'border-violet-500 bg-white ring-4 ring-violet-50 shadow-sm' : 'border-gray-200 bg-white/50 hover:border-gray-300'}`}>
                                                <input type="radio" name="petsAllowed" value={opt} checked={isSelected} onChange={handleChange} className="w-5 h-5 text-violet-600 focus:ring-violet-500" />
                                                <span className={`font-bold ${isSelected ? 'text-violet-900' : 'text-gray-700'}`}>{opt}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {formData.petsAllowed === 'Yes' && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Pet Deposit Amount</label>
                                        <div className="relative w-full md:w-1/2">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                            <input type="number" min="0" name="petDeposit" value={formData.petDeposit || ''} onChange={handleChange} className="w-full pl-9 p-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-violet-500 outline-none transition bg-white" placeholder="300" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50/50 p-6 md:p-8 rounded-2xl border border-amber-200/60">
                                <h3 className="font-bold text-amber-900 mb-2 text-lg">Optional Clauses</h3>
                                <p className="text-sm text-amber-700/80 mb-6 border-b border-amber-200/50 pb-4">Select the standard clauses you wish to include in your lease agreement.</p>
                                 <div className="space-y-4">
                                    {OPTIONAL_CLAUSES.map((clause) => {
                                        const isChecked = (formData as any)[clause.id] !== false;
                                        return (
                                            <label key={clause.id} className={`flex items-start gap-4 p-5 rounded-xl border cursor-pointer transition shadow-sm
                                                ${isChecked ? 'bg-white border-amber-300 ring-1 ring-amber-100' : 'bg-gray-50 border-gray-200 grayscale opacity-80'}`}>
                                                <input type="checkbox" name={clause.id} checked={isChecked} onChange={handleChange} className="mt-1 w-5 h-5 text-amber-600 rounded focus:ring-amber-500" />
                                                <div>
                                                    <span className={`font-bold block ${isChecked ? 'text-amber-900' : 'text-gray-900'}`}>{clause.title}</span>
                                                    <span className={`text-sm block mt-1 ${isChecked ? 'text-amber-700' : 'text-gray-500'}`}>{clause.content}</span>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 5 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            <div className="bg-violet-50 p-6 rounded-2xl border border-violet-200">
                                <h3 className="font-bold text-lg text-violet-900 mb-6 pb-2 border-b border-violet-200">Required Signatures</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <SignaturePad 
                                            title="Landlord Signature *" 
                                            height={150} 
                                            initialValue={formData.landlordSignature}
                                            onSave={(val) => {
                                                setFormData(prev => ({ ...prev, landlordSignature: val }));
                                                setErrors(prev => ({ ...prev, landlordSignature: '' }));
                                            }} 
                                        />
                                        {errors.landlordSignature && <p className="text-red-500 text-sm font-bold">{errors.landlordSignature}</p>}
                                    </div>
                                    
                                    {validTenants.map((t, idx) => (
                                        <div key={idx} className="space-y-2">
                                            <SignaturePad 
                                                title={`Tenant Signature: ${t} *`} 
                                                height={150} 
                                                initialValue={tenantSignatures[idx]}
                                                onSave={(val) => handleTenantSignatureChange(idx, val)} 
                                            />
                                            {errors[`tenantSignature_${idx}`] && <p className="text-red-500 text-sm font-bold">{errors[`tenantSignature_${idx}`]}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <p className="text-gray-600 mb-6">Preview your lease agreement below. When you download, this document will be transformed into a high-quality PDF perfectly mirroring this preview.</p>

                            <div className="border border-gray-300 shadow-2xl p-8 sm:p-12 md:p-16 max-h-[600px] overflow-y-auto bg-gray-50 rounded-xl">
                                {/* The physical preview element that gets screenshotted */}
                                <div ref={previewRef} className="p-10 sm:p-16 font-serif print-preview leading-relaxed mx-auto max-w-[800px]" style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', backgroundColor: '#ffffff', color: '#000000' }}>
                                    <h1 className="text-3xl font-bold text-center mb-8 uppercase tracking-widest border-b-2 pb-4" style={{ borderColor: '#000000' }}>Residential Lease Agreement</h1>

                                    <div className="text-justify space-y-6">
                                        <p>
                                            This Residential Lease Agreement ("Agreement") is made and entered into on this <strong>{new Date().toLocaleDateString()}</strong>, by and between <strong>{formData.landlordName || '[Landlord Name]'}</strong>, herein referred to as "Landlord", and the following individuals: <strong>{validTenants.length > 0 ? validTenants.join(', ') : '[Tenant Names]'}</strong>, herein referred to collectively as "Tenant".
                                        </p>

                                        <h2 className="text-lg font-bold uppercase mt-8 border-b inline-block" style={{ borderColor: '#000000' }}>1. Property</h2>
                                        <p>
                                            Landlord hereby leases to Tenant, and Tenant hereby leases from Landlord, the premises located at <strong>{formData.propertyAddress || '[Property Address]'}</strong> (the "Premises").
                                        </p>

                                        <h2 className="text-lg font-bold uppercase mt-8 border-b inline-block" style={{ borderColor: '#000000' }}>2. Term</h2>
                                        <p>
                                            The term of this lease shall commence on <strong>{formData.leaseStartDate ? new Date(formData.leaseStartDate).toLocaleDateString() : '[Start Date]'}</strong> and shall expire on <strong>{formData.leaseEndDate ? new Date(formData.leaseEndDate).toLocaleDateString() : '[End Date]'}</strong>.
                                        </p>

                                        <h2 className="text-lg font-bold uppercase mt-8 border-b inline-block" style={{ borderColor: '#000000' }}>3. Rent & Deposits</h2>
                                        <p>
                                            Tenant shall pay to Landlord a monthly rent of <strong>${formData.monthlyRent || '[Amount]'}</strong>. Rent shall be payable in advance on the first day of each calendar month.
                                            {formData.lateFee && ` If any rent payment is more than 5 days late, Tenant will be charged a late fee of $${formData.lateFee}.`}
                                        </p>
                                        <p>
                                            Upon execution of this Agreement, Tenant shall deposit with Landlord the sum of <strong>${formData.securityDeposit || '[Amount]'}</strong> as a security deposit to secure Tenant's performance of the obligations set forth in this Agreement.
                                        </p>

                                        <h2 className="text-lg font-bold uppercase mt-8 border-b inline-block" style={{ borderColor: '#000000' }}>4. Utilities</h2>
                                        <p>
                                            The following utilities will be paid for and maintained by the Landlord:
                                            <span className="font-bold ml-1">
                                                {['utilityWater', 'utilityElectricity', 'utilityGas', 'utilityInternet']
                                                    .filter(k => (formData as any)[k])
                                                    .map(k => k.replace('utility', ''))
                                                    .join(', ') || ' None'}
                                            </span>.
                                            Tenant is responsible for all other utilities associated with the Premises.
                                        </p>

                                        <h2 className="text-lg font-bold uppercase mt-8 border-b inline-block" style={{ borderColor: '#000000' }}>5. Pet Policy</h2>
                                        <p>
                                            {formData.petsAllowed === 'Yes'
                                                ? `Pets are allowed on the Premises. Tenant agrees to pay a non-refundable pet deposit of $${formData.petDeposit || '0'} prior to bringing the pet(s) onto the Property.`
                                                : 'No pets or animals of any kind shall be kept on the Premises without the prior written consent of the Landlord.'}
                                        </p>

                                        {/* Dynamic Optional Clauses */}
                                        {OPTIONAL_CLAUSES.map((clause, idx) => {
                                            if ((formData as any)[clause.id] === false) return null;
                                            return (
                                                <div key={clause.id} className="mt-8">
                                                    <h2 className="text-lg font-bold uppercase border-b inline-block" style={{ borderColor: '#000000' }}>{5 + idx + 1}. {clause.title}</h2>
                                                    <p className="mt-2">{clause.content}</p>
                                                </div>
                                            )
                                        })}

                                        <h2 className="text-lg font-bold uppercase mt-12 border-b inline-block" style={{ borderColor: '#000000' }}>Signatures</h2>
                                        <p className="mt-4">
                                            This Agreement shall be governed, construed and interpreted by, through and under the Laws of the State of <strong>{formData.governingState || '[Governing State]'}</strong>. The parties have executed this Agreement as of the date first written above.
                                        </p>

                                        <div className="flex justify-between items-end mt-16 pt-8 border-t border-dashed" style={{ borderColor: '#9ca3af' }}>
                                            <div className="w-[45%] flex flex-col items-center">
                                                <div className="border-b pb-2 mb-2 min-h-[80px] w-full flex items-end justify-center" style={{ borderColor: '#000000' }}>
                                                    {formData.landlordSignature ? (
                                                        <img src={formData.landlordSignature} alt="Landlord Signature" className="max-h-20 max-w-full object-contain" />
                                                    ) : null}
                                                </div>
                                                <div className="uppercase text-sm font-bold text-center">Landlord: {formData.landlordName || '[Name]'}</div>
                                            </div>
                                            <div className="w-[45%] flex flex-col items-center">
                                                <div className="border-b pb-2 mb-2 font-handwriting text-xl h-20 w-full flex items-end justify-center" style={{ borderColor: '#000000' }}>
                                                    {formData.landlordSignature ? new Date().toLocaleDateString() : ''}
                                                </div>
                                                <div className="uppercase text-sm font-bold text-center">Date</div>
                                            </div>
                                        </div>

                                        {validTenants.map((t, idx) => (
                                            <div key={idx} className="flex justify-between items-end mt-12 pt-8">
                                                <div className="w-[45%] flex flex-col items-center">
                                                    <div className="border-b pb-2 mb-2 min-h-[80px] w-full flex items-end justify-center" style={{ borderColor: '#000000' }}>
                                                        {tenantSignatures[idx] ? (
                                                            <img src={tenantSignatures[idx]} alt={`Tenant ${t} Signature`} className="max-h-20 max-w-full object-contain" />
                                                        ) : null}
                                                    </div>
                                                    <div className="uppercase text-sm font-bold text-center">Tenant: {t}</div>
                                                </div>
                                                <div className="w-[45%] flex flex-col items-center">
                                                    <div className="border-b pb-2 mb-2 font-handwriting text-xl h-20 w-full flex items-end justify-center" style={{ borderColor: '#000000' }}>
                                                        {tenantSignatures[idx] ? new Date().toLocaleDateString() : ''}
                                                    </div>
                                                    <div className="uppercase text-sm font-bold text-center">Date</div>
                                                </div>
                                            </div>
                                        ))}

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
                                    <h3 className="font-bold text-green-900">Lease Ready for Final Review</h3>
                                    <p className="text-green-700 text-sm">Please review the final document rendering. You can still go back if any corrections are needed.</p>
                                </div>
                            </div>

                            <div className="border rounded-2xl overflow-hidden shadow-inner bg-gray-100">
                                {previewFile ? (
                                    <PDFLivePreview file={previewFile} className="max-h-[600px]" />
                                ) : (
                                    <div className="h-[400px] flex items-center justify-center">
                                        <Loader2 className="animate-spin text-violet-600" size={32} />
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
                            className="flex items-center gap-2 font-bold px-8 py-4 bg-violet-600 text-white rounded-xl shadow-lg shadow-violet-200 transition active:scale-95 disabled:opacity-70"
                        >
                            {isGenerating ? (
                                <><Loader2 className="animate-spin" size={20} /> Creating Preview...</>
                            ) : (
                                <>{currentStep === 5 ? 'Review Final Doc' : 'Next Step'} <ArrowRight size={20} /></>
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
                {reviewAsk}
            </div>
        </div>
    );
}
