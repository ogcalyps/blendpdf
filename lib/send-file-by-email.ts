import { trackEvent, currentToolFromPath } from '@/lib/analytics';

/**
 * Files above this size must be downloaded directly. SES caps a raw message at
 * 10 MiB, and base64 plus line folding inflates an attachment by about 37%, so
 * anything much past 7 MiB would only fail on the server with a 413
 * (see MAX_RAW_MESSAGE_BYTES in lib/send-file-email-ses.ts).
 */
export const MAX_EMAIL_FILE_SIZE = 7 * 1024 * 1024;

/** Give up on a send that hangs; the file is on screen and can be downloaded instead. */
const SEND_TIMEOUT_MS = 60_000;

/**
 * Convert a Blob to base64 using chunked conversion (0x8000-byte slices).
 * Avoids the O(n^2) string concatenation of byte-by-byte reduce, which
 * freezes the tab on large files.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK_SIZE = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    chunks.push(String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK_SIZE))));
  }
  return btoa(chunks.join(''));
}

/** The page's locale (set on <html lang> by app/layout.tsx), so the email matches what the user was reading. */
export function pageLocale(): 'ar' | 'fr' | 'es' | 'en' {
  if (typeof document === 'undefined') return 'en';
  const lang = document.documentElement?.lang?.toLowerCase() ?? '';
  return lang.startsWith('ar') ? 'ar' : lang.startsWith('fr') ? 'fr' : lang.startsWith('es') ? 'es' : 'en';
}

/** The tool page's route slug ("compress-pdf"), so the email can link back to it. */
function pageToolSlug(): string {
  return currentToolFromPath().replace(/_/g, '-');
}

/**
 * Email a processed file to the user. Never throws: every failure (SES not
 * live, sandbox rejection, oversized file, rate limit, network) resolves to
 * false, so the caller can point the user at the download button instead of
 * surfacing an error. The file is already on screen; email is only a convenience.
 */
export async function sendFileByEmail(blob: Blob, filename: string, email: string): Promise<boolean> {
  let status: number | 'too_large' | 'network' | 'timeout' = 'network';

  if (blob.size > MAX_EMAIL_FILE_SIZE) {
    status = 'too_large';
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const response = await fetch('/api/send-file-email', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          filename,
          fileData: await blobToBase64(blob),
          fileType: blob.type || 'application/pdf',
          locale: pageLocale(),
          tool: pageToolSlug(),
        }),
      });
      if (response.ok) {
        trackEvent('email_sent', { tool_name: currentToolFromPath() });
        return true;
      }
      status = response.status;
    } catch {
      // Network failure, timeout, or the browser could not encode the file
      if (controller.signal.aborted) status = 'timeout';
    } finally {
      clearTimeout(timer);
    }
  }

  trackEvent('email_send_failed', { tool_name: currentToolFromPath(), status });
  return false;
}
