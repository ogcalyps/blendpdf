/**
 * The request body as text, refusing to read more than `maxBytes` whatever
 * Content-Length says: a chunked upload sends none, so a check on the header
 * alone let any size through (security review, 2026-11-12). Null means too
 * big; the rest of the body is never read.
 */
export async function readBodyText(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
