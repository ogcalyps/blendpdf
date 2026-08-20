const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createFormDoc(title, fields) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const form = pdfDoc.getForm();

    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const margin = 50;
    let currentY = 841.89 - margin;

    page.drawText(title, { x: margin, y: currentY, size: 24, font: boldFont });
    currentY -= 40;

    for (const field of fields) {
        if (currentY < margin + 100) {
            page = pdfDoc.addPage([595.28, 841.89]);
            currentY = 841.89 - margin;
        }

        if (field.type === 'section') {
            currentY -= 10;
            page.drawText(field.label, { x: margin, y: currentY, size: 16, font: boldFont });
            currentY -= 30;
            continue;
        }

        if (field.type === 'text' || field.type === 'signature' || field.type === 'date') {
            page.drawText(field.label, { x: margin, y: currentY, size: 10, font });
            const textField = form.createTextField(field.name);
            const fieldHeight = field.multiline ? 60 : 20;
            const fieldY = currentY - (fieldHeight - 10);

            textField.addToPage(page, {
                x: margin + 150,
                y: fieldY,
                width: 300,
                height: fieldHeight,
            });
            if (field.multiline) textField.enableMultiline();
            currentY -= (fieldHeight + 15);
        } else if (field.type === 'checkbox') {
            page.drawText(field.label, { x: margin, y: currentY, size: 10, font });
            const checkBox = form.createCheckBox(field.name);
            checkBox.addToPage(page, {
                x: margin + 150,
                y: currentY - 5,
                width: 15,
                height: 15, // AcroForm checkbox
            });
            currentY -= 25;
        } else if (field.type === 'radioGroup') {
            page.drawText(field.label, { x: margin, y: currentY, size: 10, font });
            const radioGroup = form.createRadioGroup(field.name);
            currentY -= 20;
            for (const option of field.options) {
                if (currentY < margin + 30) {
                    page = pdfDoc.addPage([595.28, 841.89]);
                    currentY = 841.89 - margin;
                }
                page.drawText(option, { x: margin + 175, y: currentY, size: 10, font });
                radioGroup.addOptionToPage(option, page, {
                    x: margin + 150,
                    y: currentY - 2,
                    width: 15,
                    height: 15,
                });
                currentY -= 20;
            }
            currentY -= 10;
        }
    }

    return await pdfDoc.saveAsBase64({ dataUri: false });
}

// 1. W-9
const w9Fields = [
    { type: 'text', name: 'fullName', label: '1 Name (as shown on your income tax return)' },
    { type: 'text', name: 'businessName', label: '2 Business name/disregarded entity name' },
    {
        type: 'radioGroup', name: 'taxClassification', label: '3 Federal tax classification', options: [
            'Individual/sole proprietor or single-member LLC',
            'C Corporation',
            'S Corporation',
            'Partnership',
            'Trust/estate',
            'Limited liability company',
            'Other'
        ]
    },
    { type: 'text', name: 'llcClassification', label: 'LLC tax classification (C=C corp, S=S corp, P=Partnership)' },
    { type: 'text', name: 'exemptions', label: '4 Exemptions (codes apply only to certain entities)' },
    { type: 'text', name: 'address', label: '5 Address (number, street, and apt. or suite no.)' },
    { type: 'text', name: 'cityStateZip', label: '6 City, state, and ZIP code' },
    { type: 'text', name: 'accountNumbers', label: '7 List account number(s) here (optional)' },
    { type: 'section', label: 'Part I Taxpayer Identification Number (TIN)' },
    { type: 'text', name: 'ssn', label: 'Social security number (SSN)' },
    { type: 'text', name: 'ein', label: 'Employer identification number (EIN)' },
    { type: 'section', label: 'Part II Certification' },
    { type: 'signature', name: 'signature', label: 'Signature of U.S. person' },
    { type: 'date', name: 'date', label: 'Date' }
];

// 2. NDA
const ndaFields = [
    { type: 'text', name: 'disclosingPartyName', label: 'Disclosing Party Name' },
    { type: 'text', name: 'disclosingPartyAddress', label: 'Disclosing Party Address' },
    { type: 'text', name: 'receivingPartyName', label: 'Receiving Party Name' },
    { type: 'text', name: 'receivingPartyAddress', label: 'Receiving Party Address' },
    { type: 'date', name: 'effectiveDate', label: 'Effective Date' },
    { type: 'radioGroup', name: 'ndaType', label: 'NDA Type', options: ['One-Way', 'Mutual'] },
    { type: 'text', name: 'confidentialInformation', label: 'Definition of Confidential Information', multiline: true },
    { type: 'text', name: 'durationYears', label: 'Duration (Years)' },
    { type: 'text', name: 'governingState', label: 'Governing State Law' },
    { type: 'section', label: 'Signatures (Disclosing Party)' },
    { type: 'text', name: 'disclosingName', label: 'Name' },
    { type: 'text', name: 'disclosingTitle', label: 'Title' },
    { type: 'signature', name: 'disclosingSignature', label: 'Signature' },
    { type: 'date', name: 'disclosingDate', label: 'Date' },
    { type: 'section', label: 'Signatures (Receiving Party)' },
    { type: 'text', name: 'receivingName', label: 'Name' },
    { type: 'text', name: 'receivingTitle', label: 'Title' },
    { type: 'signature', name: 'receivingSignature', label: 'Signature' },
    { type: 'date', name: 'receivingDate', label: 'Date' }
];

// 3. I-9
const i9Fields = [
    { type: 'section', label: 'Section 1. Employee Information and Attestation' },
    { type: 'text', name: 'lastName', label: 'Last Name (Family Name)' },
    { type: 'text', name: 'firstName', label: 'First Name (Given Name)' },
    { type: 'text', name: 'middleInitial', label: 'Middle Initial' },
    { type: 'text', name: 'otherLastNames', label: 'Other Last Names Used (if any)' },
    { type: 'text', name: 'address', label: 'Address (Street Number and Name)' },
    { type: 'text', name: 'aptNumber', label: 'Apt. Number' },
    { type: 'text', name: 'cityStateZip', label: 'City or Town, State, ZIP Code' },
    { type: 'date', name: 'dob', label: 'Date of Birth (mm/dd/yyyy)' },
    { type: 'text', name: 'ssn', label: 'U.S. Social Security Number' },
    { type: 'text', name: 'email', label: 'Employee\'s Email Address' },
    { type: 'text', name: 'phone', label: 'Employee\'s Telephone Number' },
    {
        type: 'radioGroup', name: 'attestationStatus', label: 'I attest, under penalty of perjury, that I am:', options: [
            '1. A citizen of the United States',
            '2. A noncitizen national of the United States',
            '3. A lawful permanent resident',
            '4. An alien authorized to work'
        ]
    },
    { type: 'signature', name: 'employeeSignature', label: 'Signature of Employee' },
    { type: 'date', name: 'employeeDate', label: 'Date' },
    { type: 'section', label: 'Section 2. Employer Review and Verification' },
    { type: 'text', name: 'documentTitle', label: 'Document Title' },
    { type: 'text', name: 'issuingAuthority', label: 'Issuing Authority' },
    { type: 'text', name: 'documentNumber', label: 'Document Number' },
    { type: 'date', name: 'expirationDate', label: 'Expiration Date (if any)' },
    { type: 'text', name: 'employerName', label: 'Employer\'s Business or Organization Name' },
    { type: 'text', name: 'employerTitle', label: 'Title of Employer or Authorized Representative' },
    { type: 'text', name: 'employerAddress', label: 'Employer\'s Business or Organization Address' },
    { type: 'signature', name: 'employerSignature', label: 'Signature of Employer' },
    { type: 'date', name: 'employerDate', label: 'Date' }
];

// 4. Lease Agreement
const leaseFields = [
    { type: 'text', name: 'landlordName', label: 'Landlord Name' },
    { type: 'text', name: 'landlordAddress', label: 'Landlord Address' },
    { type: 'text', name: 'tenantNames', label: 'Tenant Names (comma separated)', multiline: true },
    { type: 'text', name: 'propertyAddress', label: 'Property Address' },
    { type: 'date', name: 'leaseStartDate', label: 'Lease Start Date' },
    { type: 'date', name: 'leaseEndDate', label: 'Lease End Date' },
    { type: 'text', name: 'monthlyRent', label: 'Monthly Rent Amount ($)' },
    { type: 'text', name: 'securityDeposit', label: 'Security Deposit Amount ($)' },
    { type: 'text', name: 'lateFee', label: 'Late Fee Amount ($)' },
    { type: 'text', name: 'gracePeriod', label: 'Grace Period (Days)' },
    { type: 'section', label: 'Utilities Included' },
    { type: 'checkbox', name: 'utilityWater', label: 'Water' },
    { type: 'checkbox', name: 'utilityElectricity', label: 'Electricity' },
    { type: 'checkbox', name: 'utilityGas', label: 'Gas' },
    { type: 'checkbox', name: 'utilityInternet', label: 'Internet' },
    { type: 'section', label: 'Pet Policy' },
    { type: 'radioGroup', name: 'petsAllowed', label: 'Are pets allowed?', options: ['Yes', 'No'] },
    { type: 'text', name: 'petDeposit', label: 'Pet Deposit Amount (if yes)' },
    { type: 'text', name: 'governingState', label: 'Governing State Law' },
    { type: 'section', label: 'Signatures' },
    { type: 'signature', name: 'landlordSignature', label: 'Landlord Signature' },
    { type: 'signature', name: 'tenantSignatures', label: 'Tenant Signatures', multiline: true }
];

// 5. Patient Intake
const patientIntakeFields = [
    { type: 'text', name: 'fullName', label: 'Patient Full Name' },
    { type: 'date', name: 'dob', label: 'Date of Birth' },
    { type: 'radioGroup', name: 'gender', label: 'Gender', options: ['Male', 'Female', 'Other'] },
    { type: 'text', name: 'address', label: 'Address' },
    { type: 'text', name: 'phone', label: 'Phone Number' },
    { type: 'text', name: 'email', label: 'Email Address' },
    { type: 'section', label: 'Emergency Contact' },
    { type: 'text', name: 'emergencyName', label: 'Name' },
    { type: 'text', name: 'emergencyPhone', label: 'Phone' },
    { type: 'text', name: 'emergencyRelationship', label: 'Relationship' },
    { type: 'section', label: 'Insurance' },
    { type: 'text', name: 'insuranceProvider', label: 'Provider Name' },
    { type: 'text', name: 'policyNumber', label: 'Policy Number' },
    { type: 'text', name: 'groupNumber', label: 'Group Number' },
    { type: 'text', name: 'primaryPhysician', label: 'Primary Care Physician' },
    { type: 'section', label: 'Medical Information' },
    { type: 'text', name: 'reasonForVisit', label: 'Reason for Visit' },
    { type: 'text', name: 'medications', label: 'Current Medications', multiline: true },
    { type: 'text', name: 'allergies', label: 'Allergies', multiline: true },
    { type: 'section', label: 'Medical History' },
    { type: 'checkbox', name: 'mhDiabetes', label: 'Diabetes' },
    { type: 'checkbox', name: 'mhHypertension', label: 'Hypertension' },
    { type: 'checkbox', name: 'mhHeartDisease', label: 'Heart Disease' },
    { type: 'checkbox', name: 'mhAsthma', label: 'Asthma' },
    { type: 'checkbox', name: 'mhCancer', label: 'Cancer' },
    { type: 'checkbox', name: 'mhNone', label: 'None of the above' },
    { type: 'section', label: 'Signatures' },
    { type: 'signature', name: 'patientSignature', label: 'Patient/Guardian Signature' },
    { type: 'date', name: 'date', label: 'Date' }
];

async function main() {
    console.log('Generating W-9...');
    const w9Base64 = await createFormDoc('Form W-9', w9Fields);

    console.log('Generating NDA...');
    const ndaBase64 = await createFormDoc('Non-Disclosure Agreement', ndaFields);

    console.log('Generating I-9...');
    const i9Base64 = await createFormDoc('Form I-9', i9Fields);

    console.log('Generating Lease Agreement...');
    const leaseBase64 = await createFormDoc('Residential Lease Agreement', leaseFields);

    console.log('Generating Patient Intake Form...');
    const patientBase64 = await createFormDoc('Patient Intake Form', patientIntakeFields);

    const fileContent = `// Auto-generated form templates base64 data
export const w9Template = "${w9Base64}";
export const ndaTemplate = "${ndaBase64}";
export const i9Template = "${i9Base64}";
export const leaseTemplate = "${leaseBase64}";
export const patientIntakeTemplate = "${patientBase64}";

export const formDefinitions = {
  w9: {
    title: 'W-9 Form',
    description: 'Request for Taxpayer Identification Number and Certification.',
    fields: ${JSON.stringify(w9Fields, null, 2)}
  },
  nda: {
    title: 'Non-Disclosure Agreement',
    description: 'Standard mutual or one-way NDA.',
    fields: ${JSON.stringify(ndaFields, null, 2)}
  },
  i9: {
    title: 'I-9 Form',
    description: 'Employment Eligibility Verification.',
    fields: ${JSON.stringify(i9Fields, null, 2)}
  },
  lease: {
    title: 'Residential Lease Agreement',
    description: 'Standard residential lease agreement.',
    fields: ${JSON.stringify(leaseFields, null, 2)}
  },
  patient: {
    title: 'Patient Intake Form',
    description: 'Standard medical patient intake form.',
    fields: ${JSON.stringify(patientIntakeFields, null, 2)}
  }
};
`;

    const outputPath = path.join(__dirname, '..', 'lib', 'form-templates-data.ts');
    fs.writeFileSync(outputPath, fileContent);
    console.log('Successfully wrote templates to ' + outputPath);
}

main().catch(console.error);
