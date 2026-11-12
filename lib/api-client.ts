import type { CompressionLevel } from '@/types';
import { withToolTracking } from '@/lib/analytics';
import type { ApiError } from '@/lib/analytics';
import type { OcrLanguage } from '@/lib/workspace/types';
import { pdfaCheckFromHeaders, type PdfaCheck, type PdfaLevel } from '@/lib/pdfa';

/** Next.js routes use `{ error: string }`; some upstreams nest it as `{ error: { message, name } }`. */
function messageFromApiErrorBody(body: unknown, fallback: string): string {
  if (body === null || body === undefined) return fallback;
  if (typeof body === 'string') {
    const t = body.trim();
    return t || fallback;
  }
  if (typeof body !== 'object') return fallback;
  const o = body as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error.trim()) return o.error;
  if (o.error && typeof o.error === 'object') {
    const e = o.error as Record<string, unknown>;
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
  }
  if (typeof o.message === 'string' && o.message.trim()) return o.message;
  return fallback;
}

/**
 * Builds an Error carrying the failed response's own message. Reading the body has to happen
 * outside the throw: a `throw` inside a `try` that also parses the body gets caught by its own
 * `catch`, which is how every specific server message used to turn into a generic one.
 *
 * The HTTP status rides along on the Error because analytics needs it: a 4xx is us correctly
 * declining bad input, a 5xx is us breaking, and lumping the two together made `unlock_pdf`
 * look like it failed 5 times out of 6 when those were all "wrong password".
 */
async function apiError(response: Response, fallback: string): Promise<ApiError> {
  const text = await response.text().catch(() => '');
  const trimmed = text.trim();
  let payload: unknown = null;
  // Ignore error pages and other oversized bodies; those are not messages for the user.
  if (trimmed && !trimmed.startsWith('<') && trimmed.length <= 500) {
    try {
      payload = JSON.parse(trimmed) as unknown;
    } catch {
      payload = trimmed;
    }
  }
  const error = new Error(messageFromApiErrorBody(payload, fallback)) as ApiError;
  error.status = response.status;
  const code = (payload as { errorCode?: unknown } | null)?.errorCode;
  if (typeof code === 'string') error.errorCode = code;
  return error;
}

async function mergePDFsImpl(files: File[]): Promise<Blob> {
  const startTime = Date.now();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  console.log(`[Client] Starting merge: ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB total`);

  // Upload through backend (secure - no S3 URLs exposed)
  console.log(`[Client] Using backend upload method`);
  return mergePDFsBackend(files);
}

async function mergePDFsBackend(files: File[]): Promise<Blob> {
  const startTime = Date.now();
  console.log(`[Client] Using backend upload method for ${files.length} files`);

  try {
    // Step 1: Upload files to backend (backend handles S3 internally)
    console.log(`[Client] Step 1: Uploading files to backend...`);
    const uploadStart = Date.now();

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const uploadResponse = await fetch('/api/merge-upload', {
      method: 'POST',
      body: formData,
    });

    const uploadBodyText = await uploadResponse.text();
    let uploadPayload: unknown;
    try {
      uploadPayload = JSON.parse(uploadBodyText) as unknown;
    } catch {
      uploadPayload = { error: uploadBodyText.slice(0, 500) };
    }

    if (!uploadResponse.ok) {
      throw new Error(
        messageFromApiErrorBody(
          uploadPayload,
          'Failed to upload files.'
        )
      );
    }

    const { keys } = uploadPayload as { keys: string[] };
    if (!keys || !Array.isArray(keys)) {
      throw new Error('Invalid upload response: missing keys');
    }
    console.log(`[Client] Files uploaded to backend in ${Date.now() - uploadStart}ms`);
    console.log(`[Client] Received ${keys.length} S3 keys (not exposed to client)`);

    // Step 2: Request merge from S3 (backend handles S3 access)
    console.log(`[Client] Step 2: Requesting merge...`);
    const mergeStart = Date.now();

    const mergeResponse = await fetch('/api/merge-s3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keys: keys,
      }),
    });

    const mergeBodyText = await mergeResponse.text();
    let mergePayload: unknown;
    try {
      mergePayload = JSON.parse(mergeBodyText) as unknown;
    } catch {
      mergePayload = { error: mergeBodyText.slice(0, 500) };
    }

    if (!mergeResponse.ok) {
      throw new Error(
        messageFromApiErrorBody(
          mergePayload,
          'Failed to merge PDFs.'
        )
      );
    }

    const result = mergePayload as { data: string };
    console.log(`[Client] Merge completed in ${Date.now() - mergeStart}ms`);

    // Step 3: Convert Base64 result to Blob
    const base64Data = result.data.replace(/^data:application\/pdf;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log(`[Client] Backend merge successful! Total time: ${Date.now() - startTime}ms`);
    return new Blob([bytes], { type: 'application/pdf' });
  } catch (error) {
    console.error(`[Client] Backend merge error after ${Date.now() - startTime}ms:`, error);
    throw error;
  }
}

/** targetBytes: get it under this size instead of using the level (the route picks the setting). */
async function compressPDFImpl(file: File, level: CompressionLevel, targetBytes?: number): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('level', level);
    if (targetBytes !== undefined) formData.append('targetBytes', String(targetBytes));

    const response = await fetch('/api/compress', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to compress PDF');
    }

    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: 'application/pdf' });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

async function splitPDFImpl(file: File, ranges: string): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ranges', ranges);

    const response = await fetch('/api/split', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to split PDF');
    }

    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: 'application/pdf' });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

async function protectPDFImpl(file: File, password: string): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);

    const response = await fetch('/api/protect-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to protect PDF');
    }

    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: 'application/pdf' });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

async function addPageNumbersImpl(
  file: File,
  position: string,
  format: string,
  startFrom: number = 1,
  fontSize: number = 12
): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('position', position);
    formData.append('format', format);
    formData.append('startFrom', String(startFrom));
    formData.append('fontSize', String(fontSize));

    const response = await fetch('/api/add-page-numbers', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to add page numbers');
    }

    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: 'application/pdf' });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

async function watermarkPDFImpl(
  file: File,
  watermarkType: 'text' | 'image',
  text: string = 'DRAFT',
  position: string = 'diagonal',
  opacity: number = 0.3,
  fontSize: number = 48,
  imageFile?: File
): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('watermarkType', watermarkType);
    formData.append('text', text);
    formData.append('position', position);
    formData.append('opacity', String(opacity));
    formData.append('fontSize', String(fontSize));
    if (imageFile) {
      formData.append('image', imageFile);
    }

    const response = await fetch('/api/watermark-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to add watermark');
    }

    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: 'application/pdf' });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

/** `noRestrictions` is true when the PDF was never restricted, so the file comes back unchanged. */
export type UnlockResult = { blob: Blob; noRestrictions: boolean };

async function unlockPDFImpl(file: File, mode: 'remove-restrictions' | 'unlock-password', password?: string): Promise<UnlockResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    if (password && mode === 'unlock-password') {
      formData.append('password', password);
    }

    const response = await fetch('/api/unlock-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to unlock PDF');
    }

    const noRestrictions = response.headers.get('X-Unlock-Result') === 'no-restrictions';
    const rawBlob = await response.blob();
    return { blob: new Blob([rawBlob], { type: 'application/pdf' }), noRestrictions };
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

async function pdfToExcelImpl(file: File): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/pdf-to-excel', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to convert PDF to Excel');
    }

    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

async function signPDFImpl(
  file: File,
  signatureType: 'text' | 'image',
  text: string = 'Signature',
  position: string = 'bottom-right',
  pageNumber: number = 1,
  imageFile?: File
): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('signatureType', signatureType);
    formData.append('text', text);
    formData.append('position', position);
    formData.append('pageNumber', String(pageNumber));
    if (imageFile) {
      formData.append('image', imageFile);
    }

    const response = await fetch('/api/sign-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to sign PDF');
    }

    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: 'application/pdf' });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

async function repairPDFImpl(file: File): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/repair-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to repair PDF');
    }

    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: 'application/pdf' });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

/** `languages` go joined with '+' (ara+eng); 'redo' re-reads pages that already have text. */
async function ocrPdfImpl(file: File, languages: readonly OcrLanguage[], mode: 'redo' | 'searchable'): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('languages', languages.join('+'));
    formData.append('mode', mode);

    const response = await fetch('/api/ocr-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to make the PDF searchable');
    }

    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: 'application/pdf' });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

/** `compatibility` is true when the server fell back to LibreOffice, so the layout may differ. */
export type PdfToWordResult = { blob: Blob; compatibility: boolean };

async function pdfToWordImpl(file: File): Promise<PdfToWordResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/pdf-to-word', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to convert PDF to Word');
    }

    const compatibility = response.headers.get('X-Conversion-Method') === 'libreoffice';
    const rawBlob = await response.blob();
    return {
      blob: new Blob([rawBlob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      compatibility,
    };
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

/** The PDF/A file and veraPDF's verdict on it (X-PdfA-* headers, lib/pdfa.ts). */
export type PdfToPdfaResult = { blob: Blob; check: PdfaCheck };

async function pdfToPdfaImpl(file: File, level: PdfaLevel): Promise<PdfToPdfaResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('level', level);

    const response = await fetch('/api/pdf-to-pdfa', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to convert PDF to PDF/A');
    }

    const check = pdfaCheckFromHeaders((name) => response.headers.get(name), level);
    const rawBlob = await response.blob();
    return { blob: new Blob([rawBlob], { type: 'application/pdf' }), check };
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

/** A ZIP of one image per page (page-001.jpg...), rendered at 300 dpi like /pdf-to-images. */
async function pdfToImagesImpl(file: File, format: 'jpg' | 'png'): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);
    formData.append('dpi', '300');

    const response = await fetch('/api/pdf-to-images', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await apiError(response, 'Failed to convert PDF to images');
    }

    const rawBlob = await response.blob();
    return new Blob([rawBlob], { type: 'application/zip' });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Connection failed');
    }
    throw error;
  }
}

// Tracked exports: every call fires tool_process_start/complete/error GA events.
export const mergePDFs = withToolTracking('merge_pdf', 'server', mergePDFsImpl);
export const compressPDF = withToolTracking('compress_pdf', 'server', compressPDFImpl);
export const splitPDF = withToolTracking('split_pdf', 'server', splitPDFImpl);
export const protectPDF = withToolTracking('protect_pdf', 'server', protectPDFImpl);
export const addPageNumbers = withToolTracking('add_page_numbers', 'server', addPageNumbersImpl);
export const watermarkPDF = withToolTracking('watermark_pdf', 'server', watermarkPDFImpl);
export const unlockPDF = withToolTracking('unlock_pdf', 'server', unlockPDFImpl);
export const pdfToExcel = withToolTracking('pdf_to_excel', 'server', pdfToExcelImpl);
export const signPDF = withToolTracking('sign_pdf', 'server', signPDFImpl);
export const repairPDF = withToolTracking('repair_pdf', 'server', repairPDFImpl);
export const ocrPdf = withToolTracking('ocr_pdf', 'server', ocrPdfImpl);
export const pdfToWord = withToolTracking('pdf_to_word', 'server', pdfToWordImpl);
export const pdfToImages = withToolTracking('pdf_to_images', 'server', pdfToImagesImpl);
export const pdfToPdfa = withToolTracking('pdf_to_pdfa', 'server', pdfToPdfaImpl);
