/**
 * Google Analytics (GA4) event tracking.
 *
 * All events flow through trackEvent(), which is a safe no-op when gtag
 * is unavailable (SSR, ad blockers, GA not configured).
 *
 * Standard events:
 * - tool_process_start    { tool_name, processing_method, file_count, total_size_mb }
 * - tool_process_complete { tool_name, processing_method, duration_ms, ... }
 * - tool_process_error    { tool_name, processing_method, duration_ms, error_message }
 * - file_upload           { tool_name, file_count, total_size_mb }
 * - file_download         { tool_name, file_name, file_extension }
 * - email_capture_submitted / delivery_choice { tool_name, ... }
 */

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', name, params);
  } catch {
    // Analytics must never break the app
  }
}

/** Derive the tool slug from the current URL, e.g. /en/merge-pdf → merge_pdf */
export function currentToolFromPath(): string {
  if (typeof window === 'undefined') return 'unknown';
  const segments = window.location.pathname.split('/').filter(Boolean);
  // Path shape is /<locale>/<tool>; fall back to the first segment for unprefixed paths
  const slug = segments[1] || segments[0] || 'home';
  return slug.replace(/-/g, '_');
}

function fileMeta(args: unknown[]): { file_count: number; total_size_mb: number } | undefined {
  const files = args
    .flat()
    .filter((a): a is File => typeof File !== 'undefined' && a instanceof File);
  if (files.length === 0) return undefined;
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  return {
    file_count: files.length,
    total_size_mb: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
  };
}

export function trackToolStart(tool: string, params?: Record<string, unknown>): void {
  trackEvent('tool_process_start', { tool_name: tool, ...params });
}

export function trackToolComplete(tool: string, durationMs: number, params?: Record<string, unknown>): void {
  trackEvent('tool_process_complete', { tool_name: tool, duration_ms: durationMs, ...params });
}

export function trackToolError(tool: string, error: unknown, durationMs?: number, params?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  trackEvent('tool_process_error', {
    tool_name: tool,
    error_message: message.slice(0, 100),
    ...(durationMs !== undefined ? { duration_ms: durationMs } : {}),
    ...params,
  });
}

export function trackDownload(filename: string): void {
  trackEvent('file_download', {
    tool_name: currentToolFromPath(),
    file_name: filename,
    file_extension: filename.includes('.') ? filename.split('.').pop() : 'unknown',
  });
}

/**
 * Wrap an async processing function so it fires start/complete/error events
 * automatically. File args are summarized into file_count/total_size_mb.
 */
export function withToolTracking<A extends unknown[], R>(
  tool: string,
  method: 'server' | 'client',
  fn: (...args: A) => Promise<R>
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const meta = { page_slug: currentToolFromPath(), ...fileMeta(args) };
    const started = Date.now();
    trackToolStart(tool, { processing_method: method, ...meta });
    try {
      const result = await fn(...args);
      trackToolComplete(tool, Date.now() - started, { processing_method: method, ...meta });
      return result;
    } catch (error) {
      trackToolError(tool, error, Date.now() - started, { processing_method: method, ...meta });
      throw error;
    }
  };
}
