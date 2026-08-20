import type { CompressionLevel } from '@/types';
import { withToolTracking } from '@/lib/analytics';

/** Next.js routes use `{ error: string }`; Strapi uses `{ error: { message, name } }`. */
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
          'Failed to upload files. PDF merge uses /api/merge-upload (Strapi keeps /api/upload for the admin).'
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

async function compressPDFImpl(file: File, level: CompressionLevel): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('level', level);

    const response = await fetch('/api/compress', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to compress PDF');
      } catch {
        throw new Error('Failed to compress PDF');
      }
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
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to split PDF');
      } catch {
        throw new Error('Failed to split PDF');
      }
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
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to protect PDF');
      } catch {
        throw new Error('Failed to protect PDF');
      }
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
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to add page numbers');
      } catch {
        throw new Error('Failed to add page numbers');
      }
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
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to add watermark');
      } catch {
        throw new Error('Failed to add watermark');
      }
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

async function unlockPDFImpl(file: File, mode: 'remove-restrictions' | 'unlock-password', password?: string): Promise<Blob> {
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
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to unlock PDF');
      } catch {
        throw new Error('Failed to unlock PDF');
      }
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

async function pdfToExcelImpl(file: File): Promise<Blob> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/pdf-to-excel', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to convert PDF to Excel');
      } catch {
        throw new Error('Failed to convert PDF to Excel');
      }
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
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to sign PDF');
      } catch {
        throw new Error('Failed to sign PDF');
      }
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
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to repair PDF');
      } catch {
        throw new Error('Failed to repair PDF');
      }
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
