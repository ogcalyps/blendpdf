import { PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import { withToolTracking } from '@/lib/analytics';
import { isWinAnsiEncodable } from '@/lib/pdf-ops';
import { renderTextToImage, MAX_TEXT_IMAGE_CHARS } from '@/lib/text-to-image';

const RTL_CHARS = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

/** Word-wrap a long line so each chunk stays under the text-image cap. */
function chunkLine(line: string, maxChars: number): string[] {
    if (line.length <= maxChars) return [line];
    const words = line.split(/\s+/);
    const chunks: string[] = [];
    let current = '';
    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxChars && current) {
            chunks.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

/**
 * Render a non-WinAnsi field value (Arabic, CJK, emoji …) to transparent
 * PNGs, one per visual line. pdf-lib can't encode these into an AcroForm
 * appearance stream (and wouldn't shape Arabic even with a Unicode font),
 * so we stamp browser-shaped images over the field rect instead — the same
 * mechanism already used for drawn signatures.
 */
async function renderValueLines(value: string) {
    const lines = value
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .flatMap(l => chunkLine(l, MAX_TEXT_IMAGE_CHARS));
    const rendered = [];
    for (const line of lines) {
        rendered.push({
            image: await renderTextToImage(line, { fontSizePx: 48, color: '#000000' }),
            rtl: RTL_CHARS.test(line),
        });
    }
    return rendered;
}

async function fillPdfFormImpl(templateBase64: string, formData: Record<string, any>, fieldsDef: any[]) {
    const pdfDoc = await PDFDocument.load(templateBase64);
    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();
    const signaturesToDraw: any[] = [];
    const textImagesToDraw: any[] = [];

    for (const fieldDef of fieldsDef) {
        if (fieldDef.type === 'section') continue;

        let value = formData[fieldDef.name];
        if (value === undefined || value === null) continue;

        try {
            // Find field safely
            let field;
            try {
                field = form.getField(fieldDef.name);
            } catch (e) {
                const allFields = form.getFields();
                field = allFields.find(f => f.getName().toLowerCase() === fieldDef.name.toLowerCase());
                if (!field && fieldDef.type === 'signature') {
                    field = allFields.find(f => {
                        const name = f.getName().toLowerCase();
                        return name.includes('sign') || name.includes('sig') || name.includes('f1_11');
                    });
                }
            }

            if (!field) continue;

            // Resolve each widget of a field to its page + rectangle.
            const widgetPlacements = () => {
                const placements: { pageIndex: number; rect: any }[] = [];
                const widgets = field!.acroField.getWidgets();
                for (const widget of widgets) {
                    const rect = widget.getRectangle();
                    let pageIndex = -1;

                    const pageRef = widget.dict.get(PDFName.of('P'));
                    if (pageRef && pageRef instanceof PDFRef) {
                        pageIndex = pages.findIndex(p => p.ref === pageRef);
                    }
                    if (pageIndex === -1) {
                        pageIndex = pages.findIndex(p =>
                            p.node.Annots()?.asArray().some(a => a === widget.dict || (a as any).target === widget.dict)
                        );
                    }
                    if (pageIndex !== -1) placements.push({ pageIndex, rect });
                }
                return placements;
            };

            // Remove the field so flatten() doesn't paint a blank appearance
            // over what we draw manually.
            const removeFieldSafely = () => {
                try {
                    form.removeField(field!);
                } catch (err) {
                    if (field!.constructor.name.includes('TextField')) {
                        (field as any).setText('');
                    }
                }
            };

            if (fieldDef.type === 'signature' && typeof value === 'string' && value.startsWith('data:image')) {
                for (const placement of widgetPlacements()) {
                    signaturesToDraw.push({ ...placement, data: value });
                }
                removeFieldSafely();
            } else if (fieldDef.type === 'text' || fieldDef.type === 'signature' || fieldDef.type === 'date') {
                if (field.constructor.name.includes('TextField')) {
                    const text = String(value);
                    if (isWinAnsiEncodable(text)) {
                        (field as any).setText(text);
                    } else {
                        // Arabic/CJK/emoji: pdf-lib's Helvetica appearance
                        // would throw at flatten(). Stamp browser-shaped
                        // images over the field rect instead.
                        const lines = await renderValueLines(text);
                        if (lines.length > 0) {
                            for (const placement of widgetPlacements()) {
                                textImagesToDraw.push({ ...placement, lines });
                            }
                        }
                        removeFieldSafely();
                    }
                }
            } else if (fieldDef.type === 'checkbox') {
                if (field.constructor.name.includes('CheckBox')) {
                    const isChecked = value === true || value === 'true' || value === 'yes' || value === 'Yes' || value === '1';
                    if (isChecked) (field as any).check();
                    else (field as any).uncheck();
                }
            } else if (fieldDef.type === 'radioGroup') {
                if (field.constructor.name.includes('RadioGroup')) {
                    try {
                        (field as any).select(String(value));
                    } catch (err) {
                        console.warn(`Could not select value ${value} in radio group ${fieldDef.name}`);
                    }
                }
            }
        } catch (e) {
            console.warn(`Failed to process field ${fieldDef.name}`, e);
        }
    }

    // Flatten first to bake in all text data
    form.flatten();

    // Draw non-WinAnsi values (Arabic etc.) as images over their field rects.
    for (const item of textImagesToDraw) {
        try {
            const page = pages[item.pageIndex];
            const { x, y, width, height } = item.rect;
            const pad = 2;
            // 48 canvas px ≈ 12 pt at 0.25 — matches the visual size of
            // Helvetica-set neighbours; shrink further only if the rect demands it.
            const baseScale = 0.25;
            const lineGap = 2;
            const scaled = item.lines.map((l: any) => ({
                ...l,
                w: l.image.width * baseScale,
                h: l.image.height * baseScale,
            }));
            const totalH = scaled.reduce((s: number, l: any) => s + l.h, 0) + lineGap * (scaled.length - 1);
            const maxW = Math.max(...scaled.map((l: any) => l.w));
            const fit = Math.min(1, (height - pad * 2) / totalH, (width - pad * 2) / maxW);

            let cursorY = y + height - pad - (height - pad * 2 - totalH * fit) / 2;
            for (const line of scaled) {
                const image = await pdfDoc.embedPng(line.image.bytes);
                const w = line.w * fit;
                const h = line.h * fit;
                cursorY -= h;
                page.drawImage(image, {
                    // RTL lines hug the right edge of the field, LTR the left.
                    x: line.rtl ? x + width - pad - w : x + pad,
                    y: cursorY,
                    width: w,
                    height: h,
                });
                cursorY -= lineGap * fit;
            }
        } catch (err) {
            console.error('Error drawing text image', err);
        }
    }

    // Now draw signatures on top of the flattened PDF
    console.log(`Total signatures to draw: ${signaturesToDraw.length}`);
    for (const sig of signaturesToDraw) {
        try {
            const page = pages[sig.pageIndex];
            console.log(`Drawing signature on page ${sig.pageIndex} at rect:`, sig.rect);
            const image = sig.data.includes('image/png')
                ? await pdfDoc.embedPng(sig.data)
                : await pdfDoc.embedJpg(sig.data);

            const { width, height, x, y } = sig.rect;
            const imgDims = image.scale(1);
            const scaleX = width / imgDims.width;
            const scaleY = height / imgDims.height;
            const scale = Math.min(scaleX, scaleY, 1) * 0.95;

            const finalWidth = imgDims.width * scale;
            const finalHeight = imgDims.height * scale;
            const finalX = x + (width - finalWidth) / 2;
            const finalY = y + (height - finalHeight) / 2;

            console.log(`Final image dimensions: ${finalWidth}x${finalHeight} at (${finalX}, ${finalY})`);

            page.drawImage(image, {
                x: finalX,
                y: finalY,
                width: finalWidth,
                height: finalHeight,
            });
        } catch (err) {
            console.error('Error drawing stored signature', err);
        }
    }

    return await pdfDoc.save();
}

export function pdfBytesToBlob(bytes: Uint8Array): Blob {
    return new Blob([bytes as any], { type: 'application/pdf' });
}

// Tracked export: fires tool_process_start/complete/error GA events (page_slug
// distinguishes which form template page triggered the fill).
export const fillPdfForm = withToolTracking('fill_form_template', 'client', fillPdfFormImpl);
