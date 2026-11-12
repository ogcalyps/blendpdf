/**
 * The fonts the editor draws with, fetched from this site (public/fonts)
 * once per session: Cairo, which the preview lays text out with and the
 * export embeds, and the look-alikes of "keep the font"
 * (keep-font/lookalike.ts), fetched only when a replaced line's own font
 * can't draw the new text. Never a CDN. Loaded only through import() (it is
 * reached from text-engine.ts, export.ts and keep-font/).
 */
import { CAIRO_FONT_URL } from '@/lib/pdf-text/constants';

const cache = new Map<string, Promise<Uint8Array>>();

/** A font file's bytes, by its URL under /fonts. Cached per URL; a failed fetch is not cached, so the next call tries again. */
export function loadFontFile(url: string): Promise<Uint8Array> {
  let bytes = cache.get(url);
  if (!bytes) {
    const attempt = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`The editor font did not load (HTTP ${response.status})`);
      return new Uint8Array(await response.arrayBuffer());
    })();
    cache.set(url, attempt);
    attempt.catch(() => {
      if (cache.get(url) === attempt) cache.delete(url);
    });
    bytes = attempt;
  }
  return bytes;
}

/** Cairo's bytes. A failed fetch is not cached, so the next call tries again. */
export function loadCairoBytes(): Promise<Uint8Array> {
  return loadFontFile(CAIRO_FONT_URL);
}
