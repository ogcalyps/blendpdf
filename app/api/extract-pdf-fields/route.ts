import { NextResponse } from 'next/server';
import { PDFDocument, PDFName, PDFRef, PDFArray, PDFPage } from 'pdf-lib';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import { inspectPdf } from '@/lib/pdf-validation';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface WidgetRect {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

/**
 * Resolve which page a widget annotation belongs to.
 * Primary: the widget's /P reference against the page tree.
 * Fallback: scan each page's /Annots array (entries are usually PDFRefs).
 */
function resolveWidgetPageIndex(widget: any, pdfDoc: PDFDocument, pages: PDFPage[]): number {
    const pageRef = widget.dict.get(PDFName.of('P'));
    if (pageRef && pageRef instanceof PDFRef) {
        const index = pages.findIndex(p => p.ref === pageRef);
        if (index !== -1) return index;
    }

    for (let i = 0; i < pages.length; i++) {
        const annots = pages[i].node.Annots() as PDFArray | undefined;
        if (!annots) continue;
        const found = annots.asArray().some(a => {
            const resolved = a instanceof PDFRef ? pdfDoc.context.lookup(a) : a;
            return resolved === widget.dict;
        });
        if (found) return i;
    }

    return -1;
}

export async function POST(request: Request) {
    const rateLimit = rateLimitMiddleware(request, {
        windowMs: 15 * 60 * 1000,
        maxRequests: 20,
    });

    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please wait a few minutes before trying again.' },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': '20',
                    'X-RateLimit-Remaining': String(rateLimit.remaining),
                    'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
                },
            }
        );
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'File exceeds the 50MB limit' }, { status: 413 });
        }

        const arrayBuffer = await file.arrayBuffer();

        const inspection = await inspectPdf(Buffer.from(arrayBuffer));
        if (!inspection.ok) {
            console.warn(`[extract-pdf-fields] Rejected: ${inspection.rejection.errorCode}`, inspection.rejection.detail ?? {});
            return NextResponse.json(
                { error: inspection.rejection.message, errorCode: inspection.rejection.errorCode }, // leak-guard: authored — PdfRejection.message is our copy, detail is what carries engine text
                { status: 400 }
            );
        }

        // Load the PDF
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        // Get the form
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        // Extract field information
        const fieldData = fields.map(field => {
            let type = 'Unknown';
            const fieldType = field.constructor.name;

            // Determine a friendly type name based on the class name
            if (fieldType.includes('TextField')) type = 'Text';
            else if (fieldType.includes('CheckBox')) type = 'Checkbox';
            else if (fieldType.includes('Dropdown')) type = 'Dropdown';
            else if (fieldType.includes('OptionList')) type = 'OptionList';
            else if (fieldType.includes('RadioGroup')) type = 'RadioGroup';
            else if (fieldType.includes('Button')) type = 'Button';
            else if (fieldType.includes('Signature')) type = 'Signature';

            // Extract every widget's bounding box and its page index
            const widgets = field.acroField.getWidgets().map(widget => {
                let rect: WidgetRect | null = null;
                try {
                    const { x, y, width, height } = widget.getRectangle();
                    // PDF coordinates [x1, y1, x2, y2]
                    rect = { x1: x, y1: y, x2: x + width, y2: y + height };
                } catch {
                    // Widget without a valid /Rect — leave rect null
                }
                const pageIndex = resolveWidgetPageIndex(widget, pdfDoc, pages);
                return { rect, pageIndex };
            });

            const firstWidget = widgets[0];

            return {
                name: field.getName(),
                type: type,
                rawType: fieldType,
                // Kept for backward compatibility: first widget's rect/page
                rect: firstWidget?.rect ?? null,
                pageIndex: firstWidget?.pageIndex ?? -1,
                widgets,
            };
        });

        if (fieldData.length === 0) {
            return NextResponse.json({
                fields: [],
                message: 'No form fields found in this PDF.'
            });
        }

        return NextResponse.json({ fields: fieldData });

    } catch (error) {
        console.error('Error extracting PDF fields:', error);
        return NextResponse.json(
            { error: "We couldn't read the form fields in this PDF.", errorCode: 'EXTRACT_FIELDS_FAILED' },
            { status: 500 }
        );
    }
}
