import { NextResponse } from 'next/server';
import { PDFDocument, PDFName, PDFRef, PDFPage } from 'pdf-lib';
import { rateLimitMiddleware } from '@/lib/rate-limit';

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB decoded template
// Base64 inflates ~4/3, plus mapping/rows payload
const MAX_BODY_SIZE = 80 * 1024 * 1024;
const MAX_ROWS_PER_REQUEST = 50;

/**
 * Interface for the mapping configuration
 * Key is the PDF field name, Value is the Spreadsheet column name
 */
interface FieldMapping {
    [pdfFieldName: string]: string;
}

/**
 * Interface for a single row of spreadsheet data
 */
interface RowData {
    [columnName: string]: string | number | boolean | null;
}

interface SignatureDraw {
    pageIndex: number;
    rect: { x: number; y: number; width: number; height: number };
    data: string;
}

/**
 * Resolve which page a widget annotation belongs to (same approach as
 * lib/pdf-generation.ts): the widget's /P reference first, then a scan of
 * each page's /Annots array.
 */
function resolveWidgetPageIndex(widget: any, pdfDoc: PDFDocument, pages: PDFPage[]): number {
    const pageRef = widget.dict.get(PDFName.of('P'));
    if (pageRef && pageRef instanceof PDFRef) {
        const index = pages.findIndex(p => p.ref === pageRef);
        if (index !== -1) return index;
    }

    for (let i = 0; i < pages.length; i++) {
        const annots = pages[i].node.Annots();
        if (!annots) continue;
        const found = annots.asArray().some(a => {
            const resolved = a instanceof PDFRef ? pdfDoc.context.lookup(a) : a;
            return resolved === widget.dict;
        });
        if (found) return i;
    }

    return -1;
}

/**
 * Collect the widget rects of a field so a signature image can be drawn over
 * them, then remove the field so an empty widget doesn't cover the image.
 * Ported from the signature handling in lib/pdf-generation.ts.
 */
function collectSignatureWidgets(
    field: any,
    form: any,
    pdfDoc: PDFDocument,
    pages: PDFPage[],
    dataUrl: string,
    signaturesToDraw: SignatureDraw[]
) {
    const widgets = field.acroField.getWidgets();
    for (const widget of widgets) {
        const rect = widget.getRectangle();
        const pageIndex = resolveWidgetPageIndex(widget, pdfDoc, pages);
        if (pageIndex !== -1) {
            signaturesToDraw.push({ pageIndex, rect, data: dataUrl });
        }
    }
    try {
        form.removeField(field);
    } catch {
        // If removal fails, leave the field in place; the image is still drawn
    }
}

export async function POST(request: Request) {
    const rateLimit = rateLimitMiddleware(request, {
        windowMs: 15 * 60 * 1000,
        maxRequests: 30,
    });

    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please wait a few minutes before trying again.' },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': '30',
                    'X-RateLimit-Remaining': String(rateLimit.remaining),
                    'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
                },
            }
        );
    }

    try {
        const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
        if (contentLength > MAX_BODY_SIZE) {
            return NextResponse.json({ error: 'Request body too large. The PDF template must be under 50MB.' }, { status: 413 });
        }

        const body = await request.json();
        const { pdfBase64, mapping, rows } = body as {
            pdfBase64: string;
            mapping: FieldMapping;
            rows: RowData[];
        };

        if (!pdfBase64 || !mapping || !rows || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Missing required parameters: pdfBase64, mapping, or rows' }, { status: 400 });
        }

        if (rows.length > MAX_ROWS_PER_REQUEST) {
            return NextResponse.json(
                { error: `Too many rows: this endpoint accepts at most ${MAX_ROWS_PER_REQUEST} rows per request. Please split your data into smaller batches.` },
                { status: 400 }
            );
        }

        // Convert base64 to Uint8Array
        const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

        if (pdfBytes.length > MAX_PDF_SIZE) {
            return NextResponse.json({ error: 'PDF template exceeds the 50MB limit.' }, { status: 413 });
        }

        const results = [];
        const logs = [];

        // Process each row
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            let filledPdfBase64 = null;
            let success = false;
            let errorMsg = null;
            const warnings: string[] = [];

            try {
                // Load a fresh copy of the PDF for each row to guarantee isolation
                const pdfDoc = await PDFDocument.load(pdfBytes);
                const form = pdfDoc.getForm();
                const pages = pdfDoc.getPages();
                const signaturesToDraw: SignatureDraw[] = [];

                // Fill fields based on mapping
                for (const [pdfFieldName, sheetColumnName] of Object.entries(mapping)) {
                    // If no column is mapped, skip
                    if (!sheetColumnName) continue;

                    const value = row[sheetColumnName];
                    // If the cell is empty or undefined, skip filling this field
                    if (value === undefined || value === null || value === '') continue;

                    const stringValue = String(value);

                    try {
                        const field = form.getField(pdfFieldName);
                        if (!field) continue;

                        const fieldType = field.constructor.name;

                        if (stringValue.startsWith('data:image')) {
                            // Signature image (data URL): stamp it over the field's widgets
                            collectSignatureWidgets(field, form, pdfDoc, pages, stringValue, signaturesToDraw);
                        } else if (fieldType.includes('Signature')) {
                            warnings.push(`Signature field "${pdfFieldName}" expects an image data URL (data:image/png;base64,...) — value was skipped`);
                        } else if (fieldType.includes('TextField')) {
                            const textField = form.getTextField(pdfFieldName);
                            textField.setText(stringValue);
                            // Note: pdf-lib doesn't easily expose max length without deeper parsing,
                            // but we can catch general errors and log warnings if text doesn't fit visually
                        } else if (fieldType.includes('CheckBox')) {
                            const checkBox = form.getCheckBox(pdfFieldName);
                            const isChecked = ['true', 'yes', 'y', '1', 'checked'].includes(stringValue.toLowerCase().trim());
                            if (isChecked) {
                                checkBox.check();
                            } else {
                                checkBox.uncheck();
                            }
                        } else if (fieldType.includes('Dropdown') || fieldType.includes('OptionList')) {
                            const dropdown = form.getDropdown(pdfFieldName); // Works for OptionList mostly too
                            try {
                                dropdown.select(stringValue);
                            } catch (e) {
                                // Value not among the existing options: add it, then select it
                                try {
                                    dropdown.addOptions([stringValue]);
                                    dropdown.select(stringValue);
                                    warnings.push(`Added missing option "${stringValue}" to dropdown "${pdfFieldName}"`);
                                } catch (addError) {
                                    warnings.push(`Could not select option "${stringValue}" in dropdown "${pdfFieldName}"`);
                                }
                            }
                        } else if (fieldType.includes('RadioGroup')) {
                            const radioGroup = form.getRadioGroup(pdfFieldName);
                            try {
                                radioGroup.select(stringValue);
                            } catch (e) {
                                warnings.push(`Could not select option "${stringValue}" in radio group "${pdfFieldName}"`);
                            }
                        }
                    } catch (fieldError: any) {
                        warnings.push(`Failed to set field "${pdfFieldName}": ${fieldError.message}`);
                    }
                }

                // Draw collected signature images over their widget rects
                for (const sig of signaturesToDraw) {
                    try {
                        const page = pages[sig.pageIndex];
                        if (!page) continue;

                        const image = sig.data.includes('image/png')
                            ? await pdfDoc.embedPng(sig.data)
                            : await pdfDoc.embedJpg(sig.data);

                        const { x, y, width, height } = sig.rect;
                        const imgDims = image.scale(1);
                        const scale = Math.min(width / imgDims.width, height / imgDims.height, 1) * 0.95;

                        const finalWidth = imgDims.width * scale;
                        const finalHeight = imgDims.height * scale;

                        page.drawImage(image, {
                            x: x + (width - finalWidth) / 2,
                            y: y + (height - finalHeight) / 2,
                            width: finalWidth,
                            height: finalHeight,
                        });
                    } catch (sigError: any) {
                        warnings.push(`Failed to draw signature image: ${sigError.message}`);
                    }
                }

                // Save the filled PDF
                const filledBytes = await pdfDoc.save();

                // Convert to base64 for transmission
                const buffer = Buffer.from(filledBytes);
                filledPdfBase64 = buffer.toString('base64');
                success = true;

            } catch (rowError: any) {
                errorMsg = rowError.message || 'Unknown error processing row';
                console.error(`Error processing row ${i}:`, rowError);
            }

            results.push({
                rowIndex: i,
                success,
                pdfBase64: filledPdfBase64,
                error: errorMsg,
                warnings
            });

            if (success) {
                logs.push(`Row ${i + 1}: Success${warnings.length > 0 ? ` (Warnings: ${warnings.join('; ')})` : ''}`);
            } else {
                logs.push(`Row ${i + 1}: FAILED - ${errorMsg}`);
            }
        }

        return NextResponse.json({ results, logs });

    } catch (error: any) {
        console.error('Error in batch processing chunk:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process batch chunk' },
            { status: 500 }
        );
    }
}
