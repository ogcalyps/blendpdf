/**
 * Log-safe stand-ins for what visitors hand us.
 *
 * The site promises documents are never tracked, but app logs end up in
 * ~/logs/blendpdf-*.log on the box (and CloudWatch when enabled) and are kept
 * for weeks. A filename is often the most identifying thing about a document
 * ("Contrat de bail - Dupont.pdf"), and an email address identifies the person
 * outright. Log these helpers' output instead of the values themselves;
 * tests/log-privacy.test.ts fails the build when a route logs a name or an
 * address directly.
 */

import { createHmac, randomBytes } from 'crypto';

/**
 * Random per process and never written anywhere, so a marker cannot be reversed
 * even by someone holding this code, the logs and a list of candidate values.
 * The cost is that markers only correlate within one process lifetime: a
 * deploy or restart starts a new key.
 */
const PROCESS_KEY = randomBytes(32);

/** A short marker that is equal for equal inputs (within this process) and reveals nothing else. */
export function logRef(value: string): string {
  return createHmac('sha256', PROCESS_KEY).update(value).digest('hex').slice(0, 12);
}

/** The lowercased extension, or 'unknown' when what follows the last dot is not a plausible one. */
export function fileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'unknown';
}

/** What to log about an uploaded file in place of its name. */
export function fileLogMeta(file: { name: string; size: number }): {
  fileExt: string;
  fileSize: string;
  fileRef: string;
} {
  return {
    fileExt: fileExt(file.name),
    fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
    fileRef: logRef(`${file.name}\0${file.size}`),
  };
}

/** What to log about an email address in place of the address. Normalize first so case variants match. */
export function emailLogRef(email: string): string {
  return logRef(email.toLowerCase().trim());
}

/**
 * An error reduced to name, message and stack, for logging an AWS SDK error
 * whole. The SDK copies every field of the service's error body onto the
 * exception, so an S3 NoSuchKey carries `Key` (uploads/<ts>-<id>-<filename>)
 * and console.error would print it.
 */
export function errorLogFields(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: typeof error, message: 'Non-Error thrown' };
}
