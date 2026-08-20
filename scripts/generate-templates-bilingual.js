/**
 * Bilingual (English/Arabic) form template generator.
 *
 * Why a separate script from generate-templates.js: pdf-lib's standard fonts
 * are WinAnsi-only and pdf-lib does no bidi/shaping, so Arabic static text
 * cannot be drawn as text. Instead, Arabic runs are rendered to PNGs with
 * node-canvas (Pango/HarfBuzz shapes Arabic natively) and stamped as images.
 * English text is drawn as real Helvetica text, and the AcroForm fields are
 * normal text fields — so the output stays a regular fillable PDF.
 *
 * NOTE: rendering quality depends on the machine's Arabic system font
 * (Geeza Pro on macOS). The generated base64 output is committed to the
 * repo, so this script only ever needs to run on the dev machine:
 *   node scripts/generate-templates-bilingual.js
 * Output: lib/form-templates-bilingual-data.ts
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- geometry
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const SCALE = 3; // canvas px per PDF pt — ~216 dpi, crisp in print, smaller base64

const AR_FONT = '"Geeza Pro"';
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.38, 0.38, 0.42);

// ------------------------------------------------------- Arabic rasterizer
/**
 * Render Arabic (or any RTL) text to a transparent PNG.
 * Returns { buffer, wPt, hPt } — dimensions already in PDF points.
 * With maxWidthPt set, wraps words onto multiple right-aligned lines.
 */
function arText(text, sizePt, { bold = false, maxWidthPt = null, color = '#1a1a1f' } = {}) {
    const sizePx = sizePt * SCALE;
    const font = `${bold ? 'bold ' : ''}${sizePx}px ${AR_FONT}`;
    const measureCtx = createCanvas(10, 10).getContext('2d');
    measureCtx.font = font;
    measureCtx.direction = 'rtl';

    let lines = [text];
    if (maxWidthPt) {
        const maxPx = maxWidthPt * SCALE;
        lines = [];
        for (const paragraphLine of text.split('\n')) {
            const words = paragraphLine.split(/\s+/).filter(Boolean);
            let current = '';
            for (const word of words) {
                const candidate = current ? `${current} ${word}` : word;
                if (measureCtx.measureText(candidate).width > maxPx && current) {
                    lines.push(current);
                    current = word;
                } else {
                    current = candidate;
                }
            }
            if (current) lines.push(current);
        }
    }

    const lineHeightPx = sizePx * 1.55;
    const pad = Math.ceil(sizePx * 0.15);
    const widestPx = Math.max(...lines.map(l => measureCtx.measureText(l).width), 1);
    const canvas = createCanvas(
        Math.ceil(widestPx + pad * 2),
        Math.ceil(lineHeightPx * lines.length + pad * 2)
    );
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width - pad, pad + lineHeightPx * (i + 0.5));
    });

    return {
        buffer: canvas.toBuffer('image/png'),
        wPt: canvas.width / SCALE,
        hPt: canvas.height / SCALE,
    };
}

// -------------------------------------------------------------- doc builder
async function createBilingualDoc(def) {
    const pdfDoc = await PDFDocument.create();
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const form = pdfDoc.getForm();

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const ensure = (needed) => {
        if (y - needed < MARGIN) {
            page = pdfDoc.addPage([PAGE_W, PAGE_H]);
            y = PAGE_H - MARGIN;
        }
    };

    // Repeated labels (التوقيع، التاريخ…) reuse one embedded XObject.
    const embedCache = new Map();
    const drawAr = async (img, { xRight = PAGE_W - MARGIN, yTop = y } = {}) => {
        const key = img.buffer.toString('base64').slice(0, 64) + img.buffer.length;
        let png = embedCache.get(key);
        if (!png) {
            png = await pdfDoc.embedPng(img.buffer);
            embedCache.set(key, png);
        }
        page.drawImage(png, {
            x: xRight - img.wPt,
            y: yTop - img.hPt,
            width: img.wPt,
            height: img.hPt,
        });
    };

    const wrapEn = (text, size, font, maxW) => {
        const lines = [];
        for (const paragraphLine of text.split('\n')) {
            const words = paragraphLine.split(/\s+/).filter(Boolean);
            let current = '';
            for (const word of words) {
                const candidate = current ? `${current} ${word}` : word;
                if (font.widthOfTextAtSize(candidate, size) > maxW && current) {
                    lines.push(current);
                    current = word;
                } else {
                    current = candidate;
                }
            }
            if (current) lines.push(current);
        }
        return lines;
    };

    // Title block: EN left, AR right, rule underneath.
    const titleAr = arText(def.titleAr, 15, { bold: true });
    ensure(60);
    page.drawText(def.titleEn, { x: MARGIN, y: y - 15, size: 15, font: helvBold, color: INK });
    await drawAr(titleAr, { yTop: y + 2 });
    y -= Math.max(26, titleAr.hPt + 6);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.2, color: INK });
    y -= 18;

    for (const item of def.items) {
        if (item.type === 'section') {
            const ar = arText(item.labelAr, 11, { bold: true });
            ensure(34 + ar.hPt);
            y -= 6;
            page.drawText(item.label, { x: MARGIN, y: y - 11, size: 11.5, font: helvBold, color: INK });
            await drawAr(ar, { yTop: y + 1 });
            y -= Math.max(18, ar.hPt + 4);
            page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: MUTED });
            y -= 14;
            continue;
        }

        if (item.type === 'paragraph') {
            const enLines = wrapEn(item.en, 8.5, helv, CONTENT_W);
            const ar = arText(item.ar, 9, { maxWidthPt: CONTENT_W });
            ensure(enLines.length * 12 + ar.hPt + 16);
            for (const line of enLines) {
                page.drawText(line, { x: MARGIN, y: y - 9, size: 8.5, font: helv, color: INK });
                y -= 12;
            }
            y -= 3;
            ensure(ar.hPt + 8);
            await drawAr(ar, { yTop: y });
            y -= ar.hPt + 12;
            continue;
        }

        if (item.type === 'text' || item.type === 'signature' || item.type === 'date') {
            const ar = arText(item.labelAr, 8.5);
            const boxH = item.multiline ? 54 : 20;
            ensure(16 + boxH + 14 + ar.hPt);
            // Label row: EN left, AR right.
            page.drawText(item.label, { x: MARGIN, y: y - 8.5, size: 8.5, font: helv, color: MUTED });
            await drawAr(ar, { yTop: y + 1.5 });
            y -= Math.max(13, ar.hPt + 2);
            // Full-width input box below the label row.
            const field = form.createTextField(item.name);
            field.addToPage(page, {
                x: MARGIN,
                y: y - boxH,
                width: CONTENT_W,
                height: boxH,
                borderWidth: 0.75,
            });
            if (item.multiline) field.enableMultiline();
            y -= boxH + 14;
            continue;
        }

        if (item.type === 'checkbox') {
            const ar = arText(item.labelAr, 8.5);
            ensure(24);
            const checkbox = form.createCheckBox(item.name);
            checkbox.addToPage(page, { x: MARGIN, y: y - 13, width: 12, height: 12 });
            page.drawText(item.label, { x: MARGIN + 20, y: y - 11, size: 8.5, font: helv, color: INK });
            await drawAr(ar, { yTop: y + 1 });
            y -= Math.max(24, ar.hPt + 8);
            continue;
        }

        if (item.type === 'radioGroup') {
            const ar = arText(item.labelAr, 8.5);
            ensure(20 + item.options.length * 20);
            page.drawText(item.label, { x: MARGIN, y: y - 8.5, size: 8.5, font: helv, color: MUTED });
            await drawAr(ar, { yTop: y + 1.5 });
            y -= Math.max(16, ar.hPt + 4);
            const group = form.createRadioGroup(item.name);
            for (const option of item.options) {
                ensure(20);
                const optAr = arText(option.ar, 8.5);
                group.addOptionToPage(option.value, page, { x: MARGIN + 8, y: y - 13, width: 12, height: 12 });
                page.drawText(option.en, { x: MARGIN + 28, y: y - 11, size: 8.5, font: helv, color: INK });
                await drawAr(optAr, { yTop: y + 1 });
                y -= Math.max(20, optAr.hPt + 6);
            }
            y -= 6;
            continue;
        }
    }

    // Bilingual disclaimer footer on the last page.
    const discEn = 'This template is provided for convenience only and does not constitute legal advice. In case of any conflict between the English and Arabic texts, the parties agree on the governing text between them.';
    const discAr = 'هذا النموذج مُقدَّم للتيسير فقط ولا يُعد استشارة قانونية. في حال وجود تعارض بين النصين الإنجليزي والعربي، يتفق الطرفان على النص المعتمد فيما بينهما.';
    const discLines = wrapEn(discEn, 7, helv, CONTENT_W);
    const discArImg = arText(discAr, 7.5, { maxWidthPt: CONTENT_W, color: '#61616b' });
    ensure(discLines.length * 9.5 + discArImg.hPt + 20);
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: MUTED });
    y -= 10;
    for (const line of discLines) {
        page.drawText(line, { x: MARGIN, y: y - 7, size: 7, font: helv, color: MUTED });
        y -= 9.5;
    }
    y -= 2;
    await drawAr(discArImg, { yTop: y });

    return await pdfDoc.saveAsBase64({ dataUri: false });
}

// ---------------------------------------------------------- template: NDA
const F = (type, name, label, labelAr, extra = {}) => ({ type, name, label, labelAr, ...extra });
const SECTION = (label, labelAr) => ({ type: 'section', label, labelAr });
const P = (en, ar) => ({ type: 'paragraph', en, ar });

const ndaBilingual = {
    titleEn: 'Non-Disclosure Agreement',
    titleAr: 'اتفاقية عدم الإفصاح',
    items: [
        P(
            'This Non-Disclosure Agreement (the "Agreement") is entered into between the parties identified below, for the purpose of protecting confidential information exchanged between them.',
            'أُبرمت اتفاقية عدم الإفصاح هذه («الاتفاقية») بين الطرفين المحددين أدناه، بغرض حماية المعلومات السرية المتبادلة بينهما.'
        ),
        SECTION('1. Parties', '١. الطرفان'),
        F('text', 'disclosingPartyName', 'Disclosing Party — Full Name', 'الطرف المُفصِح — الاسم الكامل'),
        F('text', 'disclosingPartyAddress', 'Disclosing Party — Address', 'الطرف المُفصِح — العنوان'),
        F('text', 'receivingPartyName', 'Receiving Party — Full Name', 'الطرف المتلقي — الاسم الكامل'),
        F('text', 'receivingPartyAddress', 'Receiving Party — Address', 'الطرف المتلقي — العنوان'),
        F('date', 'effectiveDate', 'Effective Date', 'تاريخ النفاذ'),
        F('radioGroup', 'ndaType', 'Type of Agreement', 'نوع الاتفاقية', {
            options: [
                { value: 'One-Way', en: 'One-Way (only the Disclosing Party shares information)', ar: 'أحادية الاتجاه (الطرف المُفصِح وحده يشارك المعلومات)' },
                { value: 'Mutual', en: 'Mutual (both parties share information)', ar: 'متبادلة (كلا الطرفين يشارك المعلومات)' },
            ],
        }),
        SECTION('2. Confidential Information', '٢. المعلومات السرية'),
        F('text', 'confidentialInformation', 'Definition / scope of the Confidential Information', 'تعريف المعلومات السرية ونطاقها', { multiline: true }),
        P(
            'The Receiving Party shall keep all Confidential Information strictly confidential, use it only for the agreed purpose, and not disclose it to any third party without the prior written consent of the Disclosing Party.',
            'يلتزم الطرف المتلقي بالحفاظ التام على سرية جميع المعلومات السرية، وباستخدامها للغرض المتفق عليه فقط، وبعدم إفشائها لأي طرف ثالث دون موافقة كتابية مسبقة من الطرف المُفصِح.'
        ),
        P(
            'Information that is or becomes publicly available through no fault of the Receiving Party, was independently developed, or was lawfully received from a third party, is excluded from this obligation.',
            'تُستثنى من هذا الالتزام المعلومات التي تكون أو تصبح متاحة للعامة دون خطأ من الطرف المتلقي، أو التي طُوِّرت بشكل مستقل، أو التي وردت بطريقة مشروعة من طرف ثالث.'
        ),
        SECTION('3. Term & Governing Law', '٣. المدة والقانون الواجب التطبيق'),
        F('text', 'durationYears', 'Confidentiality period (years)', 'مدة الالتزام بالسرية (بالسنوات)'),
        F('text', 'governingLaw', 'Governing law / jurisdiction', 'القانون الواجب التطبيق / الاختصاص القضائي'),
        SECTION('4. Signatures — Disclosing Party', '٤. التوقيعات — الطرف المُفصِح'),
        F('text', 'disclosingName', 'Name', 'الاسم'),
        F('text', 'disclosingTitle', 'Title / Capacity', 'الصفة'),
        F('signature', 'disclosingSignature', 'Signature', 'التوقيع'),
        F('date', 'disclosingDate', 'Date', 'التاريخ'),
        SECTION('5. Signatures — Receiving Party', '٥. التوقيعات — الطرف المتلقي'),
        F('text', 'receivingName', 'Name', 'الاسم'),
        F('text', 'receivingTitle', 'Title / Capacity', 'الصفة'),
        F('signature', 'receivingSignature', 'Signature', 'التوقيع'),
        F('date', 'receivingDate', 'Date', 'التاريخ'),
    ],
};

// -------------------------------------------- template: employment contract
const employmentBilingual = {
    titleEn: 'Employment Contract',
    titleAr: 'عقد عمل',
    items: [
        P(
            'This Employment Contract is entered into between the Employer and the Employee identified below, who agree to the following terms and conditions.',
            'أُبرم عقد العمل هذا بين صاحب العمل والموظف المحددين أدناه، وقد اتفقا على الشروط والأحكام التالية.'
        ),
        SECTION('1. Parties', '١. الطرفان'),
        F('text', 'employerName', 'Employer — Company / Full Name', 'صاحب العمل — اسم الشركة / الاسم الكامل'),
        F('text', 'employerAddress', 'Employer — Address', 'صاحب العمل — العنوان'),
        F('text', 'employeeName', 'Employee — Full Name', 'الموظف — الاسم الكامل'),
        F('text', 'employeeId', 'Employee — National ID / Passport No.', 'الموظف — رقم الهوية / جواز السفر'),
        F('text', 'employeeAddress', 'Employee — Address', 'الموظف — العنوان'),
        SECTION('2. Position & Term', '٢. الوظيفة والمدة'),
        F('text', 'jobTitle', 'Job Title', 'المسمى الوظيفي'),
        F('text', 'workLocation', 'Place of Work', 'مكان العمل'),
        F('date', 'startDate', 'Start Date', 'تاريخ المباشرة'),
        F('radioGroup', 'contractType', 'Contract Type', 'نوع العقد', {
            options: [
                { value: 'Fixed-Term', en: 'Fixed-term', ar: 'محدد المدة' },
                { value: 'Indefinite', en: 'Indefinite', ar: 'غير محدد المدة' },
            ],
        }),
        F('text', 'contractDuration', 'Duration (if fixed-term)', 'مدة العقد (إذا كان محدد المدة)'),
        F('text', 'probationMonths', 'Probation Period (months)', 'فترة التجربة (بالأشهر)'),
        SECTION('3. Compensation & Working Hours', '٣. الأجر وساعات العمل'),
        F('text', 'monthlySalary', 'Basic Monthly Salary', 'الراتب الشهري الأساسي'),
        F('text', 'allowances', 'Allowances & Benefits', 'البدلات والمزايا', { multiline: true }),
        F('text', 'weeklyHours', 'Working Hours per Week', 'ساعات العمل الأسبوعية'),
        F('text', 'annualLeaveDays', 'Annual Leave (days)', 'الإجازة السنوية (بالأيام)'),
        P(
            'The Employee shall perform the duties of the position faithfully and diligently, comply with the Employer\'s lawful policies, and maintain the confidentiality of the Employer\'s business information during and after the term of employment.',
            'يلتزم الموظف بأداء مهام وظيفته بأمانة واجتهاد، وبالامتثال لسياسات صاحب العمل المشروعة، وبالحفاظ على سرية معلومات العمل أثناء مدة العقد وبعد انتهائها.'
        ),
        SECTION('4. Termination & Governing Law', '٤. إنهاء العقد والقانون الواجب التطبيق'),
        F('text', 'noticeDays', 'Notice Period (days)', 'مدة الإشعار (بالأيام)'),
        F('text', 'governingLaw', 'Governing labour law / jurisdiction', 'قانون العمل الواجب التطبيق / الاختصاص القضائي'),
        P(
            'Either party may terminate this Contract in accordance with the notice period above and the applicable labour law. Statutory rights that cannot be waived remain unaffected by this Contract.',
            'يجوز لأي من الطرفين إنهاء هذا العقد وفقاً لمدة الإشعار المذكورة أعلاه وأحكام قانون العمل واجب التطبيق. ولا يخل هذا العقد بالحقوق النظامية التي لا يجوز التنازل عنها.'
        ),
        SECTION('5. Signatures — Employer', '٥. التوقيعات — صاحب العمل'),
        F('text', 'employerSignatoryName', 'Name & Title', 'الاسم والصفة'),
        F('signature', 'employerSignature', 'Signature', 'التوقيع'),
        F('date', 'employerSignDate', 'Date', 'التاريخ'),
        SECTION('6. Signatures — Employee', '٦. التوقيعات — الموظف'),
        F('signature', 'employeeSignature', 'Signature', 'التوقيع'),
        F('date', 'employeeSignDate', 'Date', 'التاريخ'),
    ],
};

// ------------------------------------------------ template: residential lease
const leaseBilingual = {
    titleEn: 'Residential Lease Agreement',
    titleAr: 'عقد إيجار سكني',
    items: [
        P(
            'This Residential Lease Agreement is entered into between the Landlord and the Tenant identified below, for the lease of the property described in this Agreement.',
            'أُبرم عقد الإيجار السكني هذا بين المؤجر والمستأجر المحددين أدناه، لاستئجار العقار الموصوف في هذا العقد.'
        ),
        SECTION('1. Parties', '١. الطرفان'),
        F('text', 'landlordName', 'Landlord — Full Name', 'المؤجر — الاسم الكامل'),
        F('text', 'landlordPhone', 'Landlord — Phone / Email', 'المؤجر — الهاتف / البريد الإلكتروني'),
        F('text', 'tenantName', 'Tenant — Full Name', 'المستأجر — الاسم الكامل'),
        F('text', 'tenantId', 'Tenant — National ID / Passport No.', 'المستأجر — رقم الهوية / جواز السفر'),
        F('text', 'tenantPhone', 'Tenant — Phone / Email', 'المستأجر — الهاتف / البريد الإلكتروني'),
        SECTION('2. Property & Term', '٢. العقار والمدة'),
        F('text', 'propertyAddress', 'Property Address', 'عنوان العقار', { multiline: true }),
        F('radioGroup', 'furnished', 'Furnishing', 'التأثيث', {
            options: [
                { value: 'Furnished', en: 'Furnished', ar: 'مفروش' },
                { value: 'Unfurnished', en: 'Unfurnished', ar: 'غير مفروش' },
            ],
        }),
        F('date', 'leaseStart', 'Lease Start Date', 'تاريخ بداية الإيجار'),
        F('date', 'leaseEnd', 'Lease End Date', 'تاريخ نهاية الإيجار'),
        SECTION('3. Rent & Deposit', '٣. الأجرة والتأمين'),
        F('text', 'monthlyRent', 'Rent Amount & Frequency', 'قيمة الأجرة ودورية السداد'),
        F('text', 'paymentMethod', 'Payment Method / Due Date', 'طريقة الدفع / تاريخ الاستحقاق'),
        F('text', 'securityDeposit', 'Security Deposit', 'مبلغ التأمين'),
        F('text', 'utilitiesIncluded', 'Utilities & Services Included in Rent', 'المرافق والخدمات المشمولة بالأجرة', { multiline: true }),
        F('checkbox', 'petsAllowed', 'Pets are permitted on the premises', 'يُسمح باصطحاب الحيوانات الأليفة في العقار'),
        P(
            'The Tenant shall use the property exclusively as a private residence, keep it in good condition, and not sublease it or make structural alterations without the Landlord\'s prior written consent. The Landlord is responsible for major structural maintenance.',
            'يلتزم المستأجر باستخدام العقار سكناً خاصاً فقط، وبالمحافظة عليه بحالة جيدة، وبعدم تأجيره من الباطن أو إجراء تعديلات إنشائية دون موافقة كتابية مسبقة من المؤجر. ويتحمل المؤجر مسؤولية الصيانة الإنشائية الأساسية.'
        ),
        P(
            'At the end of the term, the Tenant shall return the property in its original condition, fair wear and tear excepted, and the security deposit shall be refunded after deducting any documented damages or outstanding amounts.',
            'عند انتهاء مدة العقد، يلتزم المستأجر بإعادة العقار بحالته الأصلية مع مراعاة الاستهلاك الطبيعي، ويُرد مبلغ التأمين بعد خصم أي أضرار موثقة أو مبالغ مستحقة.'
        ),
        SECTION('4. Governing Law', '٤. القانون الواجب التطبيق'),
        F('text', 'governingLaw', 'Governing law / jurisdiction', 'القانون الواجب التطبيق / الاختصاص القضائي'),
        SECTION('5. Signatures — Landlord', '٥. التوقيعات — المؤجر'),
        F('signature', 'landlordSignature', 'Signature', 'التوقيع'),
        F('date', 'landlordSignDate', 'Date', 'التاريخ'),
        SECTION('6. Signatures — Tenant', '٦. التوقيعات — المستأجر'),
        F('signature', 'tenantSignature', 'Signature', 'التوقيع'),
        F('date', 'tenantSignDate', 'Date', 'التاريخ'),
    ],
};

// ----------------------------------------------------------------- output
/** Strip layout-only entries down to the field defs the fill UI consumes. */
function toFieldDefs(def) {
    return def.items
        .filter(i => i.type !== 'paragraph')
        .map(i => {
            if (i.type === 'section') return { type: 'section', label: i.label, labelAr: i.labelAr };
            const out = { type: i.type, name: i.name, label: i.label, labelAr: i.labelAr };
            if (i.multiline) out.multiline = true;
            if (i.options) {
                out.options = i.options.map(o => o.value);
                out.optionLabels = i.options.map(o => ({ value: o.value, en: o.en, ar: o.ar }));
            }
            return out;
        });
}

async function main() {
    const [ndaB64, employmentB64, leaseB64] = [
        await createBilingualDoc(ndaBilingual),
        await createBilingualDoc(employmentBilingual),
        await createBilingualDoc(leaseBilingual),
    ];

    const fileContent = `// AUTO-GENERATED by scripts/generate-templates-bilingual.js — do not edit by hand.
// Bilingual (English/Arabic) form templates: static Arabic is stamped as
// shaped PNG images (pdf-lib cannot draw Arabic); fields are normal AcroForm
// text fields filled client-side via lib/pdf-generation.ts.

export const ndaBilingualTemplate = "${ndaB64}";
export const employmentBilingualTemplate = "${employmentB64}";
export const leaseBilingualTemplate = "${leaseB64}";

export const bilingualFormDefinitions = {
  ndaBilingual: {
    title: 'Non-Disclosure Agreement (Bilingual)',
    titleAr: 'اتفاقية عدم الإفصاح',
    description: 'Bilingual English/Arabic mutual or one-way NDA.',
    fields: ${JSON.stringify(toFieldDefs(ndaBilingual), null, 2)}
  },
  employmentBilingual: {
    title: 'Employment Contract (Bilingual)',
    titleAr: 'عقد عمل',
    description: 'Bilingual English/Arabic employment contract.',
    fields: ${JSON.stringify(toFieldDefs(employmentBilingual), null, 2)}
  },
  leaseBilingual: {
    title: 'Residential Lease Agreement (Bilingual)',
    titleAr: 'عقد إيجار سكني',
    description: 'Bilingual English/Arabic residential lease agreement.',
    fields: ${JSON.stringify(toFieldDefs(leaseBilingual), null, 2)}
  }
};
`;

    const outputPath = path.join(__dirname, '..', 'lib', 'form-templates-bilingual-data.ts');
    fs.writeFileSync(outputPath, fileContent);
    console.log('Wrote ' + outputPath);
}

main().catch((err) => { console.error(err); process.exit(1); });
