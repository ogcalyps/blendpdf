/**
 * Flatten the AcroForm before anything is drawn: viewers paint form widgets
 * above page content, so a cover or a text box over a filled field would
 * otherwise sit under it. Each field's normal appearance is drawn into its
 * page and the field is removed, one field at a time; a field that cannot be
 * flattened is left as it is and counted, and never stops the export.
 *
 * Runs while the page tree is untouched (pages are looked up in `pages`, the
 * list captured at load). Reached only through import().
 *
 * Workspace saves that only arrange pages (rotate, delete, crop, number...)
 * keep the form live instead (`all: false`, workspace-spec.md 3.2): the only
 * fields removed are those whose widgets all sat on deleted pages, so the
 * prune can drop those pages and nothing still points at them.
 */
import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDropdown,
  PDFName,
  PDFNumber,
  PDFOptionList,
  PDFRef,
  PDFSignature,
  PDFStream,
  PDFTextField,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
} from 'pdf-lib';
import type { PDFDocument, PDFField, PDFForm, PDFObject, PDFPage } from 'pdf-lib';
import { isWinAnsiEncodable } from '@/lib/pdf-ops';

/** Annotation flags that keep a widget off the screen (PDF 32000 12.5.3): Hidden, NoView. */
const HIDDEN_FLAGS = 2 | 32;

interface Draw {
  page: PDFPage;
  appearance: PDFRef;
  matrix: [number, number, number, number, number, number];
}

const asNumbers = (value: PDFObject | undefined): number[] | null => {
  if (!(value instanceof PDFArray)) return null;
  const out: number[] = [];
  for (let i = 0; i < value.size(); i++) {
    const n = value.lookup(i);
    if (!(n instanceof PDFNumber)) return null;
    out.push(n.asNumber());
  }
  return out;
};

/** [x0, y0, x1, y1] with x0 < x1 and y0 < y1, or null. */
function normalizedBox(numbers: number[] | null): [number, number, number, number] | null {
  if (!numbers || numbers.length !== 4 || numbers.some((n) => !Number.isFinite(n))) return null;
  const [a, b, c, d] = numbers;
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
}

/**
 * The matrix that puts an appearance stream on its widget's /Rect (PDF 32000
 * 12.5.5): its /BBox, transformed by its /Matrix, is fitted to the rectangle.
 * For pdf-lib's own appearances (BBox at the origin, no Matrix) this is the
 * plain translation PDFForm.flatten uses.
 */
function appearanceMatrix(stream: PDFStream, rect: [number, number, number, number]): Draw['matrix'] | null {
  const bbox = normalizedBox(asNumbers(stream.dict.lookup(PDFName.of('BBox'))));
  if (!bbox) return null;
  const m = asNumbers(stream.dict.lookup(PDFName.of('Matrix')));
  const [a, b, c, d, e, f] = m && m.length === 6 ? m : [1, 0, 0, 1, 0, 0];
  const corners = [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[1]],
    [bbox[0], bbox[3]],
    [bbox[2], bbox[3]],
  ].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const [bx0, by0, bx1, by1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  if (bx1 - bx0 <= 0 || by1 - by0 <= 0) return null;
  const sx = (rect[2] - rect[0]) / (bx1 - bx0);
  const sy = (rect[3] - rect[1]) / (by1 - by0);
  return [sx, 0, 0, sy, rect[0] - bx0 * sx, rect[1] - by0 * sy];
}

/** The widget's normal appearance stream, as a ref (a direct stream is registered), or undefined. */
function normalAppearance(doc: PDFDocument, widget: PDFDict, field: PDFField): PDFRef | undefined {
  const ap = widget.lookupMaybe(PDFName.of('AP'), PDFDict);
  if (!ap) return undefined;
  let entry: PDFObject | undefined = ap.get(PDFName.of('N'));
  const resolved = doc.context.lookup(entry);
  if (resolved instanceof PDFDict) {
    // An on/off state dictionary (check boxes, radio buttons): what the viewer shows is /AS, else the value.
    const state = widget.lookupMaybe(PDFName.of('AS'), PDFName) ?? field.acroField.dict.lookupMaybe(PDFName.of('V'), PDFName);
    entry = (state && resolved.get(state)) ?? resolved.get(PDFName.of('Off'));
  }
  const stream = doc.context.lookup(entry);
  if (!(stream instanceof PDFStream)) return undefined;
  return entry instanceof PDFRef ? entry : doc.context.register(stream);
}

/** The text a field's appearance would show, for the WinAnsi check before pdf-lib redraws it with Helvetica. */
function displayedText(field: PDFField): string | null {
  if (field instanceof PDFTextField) return field.getText() ?? '';
  if (field instanceof PDFDropdown) return field.getSelected().join('');
  if (field instanceof PDFOptionList) return field.getOptions().join('');
  return null;
}

/** Widgets of a terminal field with their refs: its /Kids, or the field dict itself when it is merged with its widget. */
function widgetsOf(field: PDFField): Array<{ dict: PDFDict; ref: PDFRef }> {
  const kids = field.acroField.dict.lookupMaybe(PDFName.of('Kids'), PDFArray);
  if (!kids) return [{ dict: field.acroField.dict, ref: field.ref }];
  const out: Array<{ dict: PDFDict; ref: PDFRef }> = [];
  for (let i = 0; i < kids.size(); i++) {
    const ref = kids.get(i);
    const dict = kids.lookup(i);
    if (ref instanceof PDFRef && dict instanceof PDFDict) out.push({ dict, ref });
  }
  return out;
}

/**
 * Flatten one field. Returns false (and changes nothing on the pages) when a
 * visible widget on a kept page has no appearance to draw.
 */
function flattenField(
  doc: PDFDocument,
  form: PDFForm,
  field: PDFField,
  pageOfAnnot: Map<PDFRef, PDFPage>,
  kept: Set<PDFRef>,
  defaultResources: PDFObject | undefined,
  needAppearances: boolean,
): boolean {
  const widgets = widgetsOf(field).map((w) => ({ ...w, page: pageOfAnnot.get(w.ref) }));
  const shown = widgets.filter((w) => {
    if (!w.page || !kept.has(w.page.ref)) return false; // on no page, or on a deleted one: nothing to draw
    const flags = w.dict.lookupMaybe(PDFName.of('F'), PDFNumber)?.asNumber() ?? 0;
    return (flags & HIDDEN_FLAGS) === 0;
  });

  if (shown.length > 0 && !(field instanceof PDFSignature)) {
    const text = displayedText(field);
    // With /NeedAppearances the viewer redraws text fields from their value, so the stored appearance may be stale.
    if (needAppearances && text) form.markFieldAsDirty(field.ref);
    if (field.needsAppearancesUpdate()) {
      if (text !== null && !isWinAnsiEncodable(text.replace(/[\r\n]/g, ''))) return false;
      field.defaultUpdateAppearances(form.getDefaultFont());
    }
  }

  const draws: Draw[] = [];
  for (const w of shown) {
    const appearance = normalAppearance(doc, w.dict, field);
    if (!appearance) {
      if (field instanceof PDFSignature) continue; // an unsigned signature box shows nothing
      return false;
    }
    const stream = doc.context.lookup(appearance, PDFStream);
    const rect = normalizedBox(asNumbers(w.dict.lookup(PDFName.of('Rect'))));
    if (!rect) return false;
    const matrix = appearanceMatrix(stream, rect);
    if (!matrix) continue; // an empty box draws nothing
    if (!stream.dict.has(PDFName.of('Resources')) && defaultResources) stream.dict.set(PDFName.of('Resources'), defaultResources);
    draws.push({ page: w.page!, appearance, matrix });
  }

  for (const draw of draws) {
    const name = draw.page.node.newXObject('FlatWidget', draw.appearance);
    draw.page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...draw.matrix), drawObject(name), popGraphicsState());
  }
  removeField(form, field, widgets);
  return true;
}

/** Take the field's widgets off their pages and the field out of the form. */
function removeField(form: PDFForm, field: PDFField, widgets: ReadonlyArray<{ ref: PDFRef; page?: PDFPage }>): void {
  const pages = new Set(widgets.map((w) => w.page).filter((p): p is PDFPage => p !== undefined));
  for (const w of widgets) w.page?.node.removeAnnot(w.ref);
  pages.forEach((page) => page.node.removeAnnot(field.ref));
  try {
    form.acroForm.removeField(field.acroField);
  } catch {
    // A field tree that does not list it where its /Parent says: its widgets are already off the pages.
  }
}

/**
 * Flatten every field it can (`all`, the default). `pages` is the document's
 * page list captured before any change; `keptPages` the refs of pages that
 * stay in the output (fields only on deleted pages are simply removed).
 * Returns how many fields were left interactive. Does nothing, and creates no
 * AcroForm, when the file has none.
 *
 * `all: false` keeps the form interactive: a field with no widget on a kept
 * page and at least one on a deleted page is removed, every other field is
 * left exactly as it is (a field placed on no page at all included). Returns
 * 0. With every page kept it touches nothing, not even an XFA form.
 */
export function flattenForm(doc: PDFDocument, pages: readonly PDFPage[], keptPages: ReadonlySet<PDFRef>, { all = true }: { all?: boolean } = {}): number {
  const acroForm = doc.catalog.AcroForm();
  if (!acroForm) return 0;
  if (!all && pages.every((page) => keptPages.has(page.ref))) return 0;
  acroForm.delete(PDFName.of('XFA')); // pdf-lib cannot draw XFA; without this getForm() warns and drops it anyway

  let form: PDFForm;
  let fields: PDFField[];
  try {
    form = doc.getForm();
    fields = form.getFields();
  } catch {
    return all ? Math.max(1, acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray)?.size() ?? 1) : 0;
  }

  const pageOfAnnot = new Map<PDFRef, PDFPage>();
  for (const page of pages) {
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    for (let i = 0; i < (annots?.size() ?? 0); i++) {
      const ref = annots!.get(i);
      if (ref instanceof PDFRef && !pageOfAnnot.has(ref)) pageOfAnnot.set(ref, page);
    }
  }
  const kept = new Set(keptPages);

  if (!all) {
    for (const field of fields) {
      try {
        const widgets = widgetsOf(field).map((w) => ({ ...w, page: pageOfAnnot.get(w.ref) }));
        const onKept = widgets.some((w) => w.page && kept.has(w.page.ref));
        const onDeleted = widgets.some((w) => w.page && !kept.has(w.page.ref));
        if (onDeleted && !onKept) removeField(form, field, widgets);
      } catch {
        // A field it can't read is left as it is: it stays fillable, at worst pointing at a scrubbed page.
      }
    }
    if ((acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray)?.size() ?? 0) === 0) doc.catalog.delete(PDFName.of('AcroForm'));
    return 0;
  }

  const defaultResources = acroForm.get(PDFName.of('DR'));
  const needAppearances = acroForm.lookupMaybe(PDFName.of('NeedAppearances'), PDFBool)?.asBoolean() === true;

  let left = 0;
  for (const field of fields) {
    try {
      if (!flattenField(doc, form, field, pageOfAnnot, kept, defaultResources, needAppearances)) left++;
    } catch {
      left++;
    }
  }
  // Nothing left to fill in: drop the form itself, so no viewer offers form tools for it.
  if ((acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray)?.size() ?? 0) === 0) doc.catalog.delete(PDFName.of('AcroForm'));
  return left;
}
