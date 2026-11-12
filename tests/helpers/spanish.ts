/**
 * Spanish house style for server-written pages (guides, comparisons, size and
 * limits pages): ¿ and ¡ open every question and exclamation, no space before
 * ? ! : ;, no ASCII apostrophe (Spanish needs none) and no dashes. True when
 * the text breaks a rule. Links are left out.
 */
export function badSpanish(text: string): boolean {
  const t = text.replace(/https?:\/\/\S+/g, 'URL');
  const count = (c: string) => t.split(c).length - 1;
  return /[–—]/.test(t) || / [?!:;]/.test(t) || t.includes("'") || count('?') !== count('¿') || count('!') !== count('¡');
}
