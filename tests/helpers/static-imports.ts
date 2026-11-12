/**
 * Reading a source file's import statements the way the bundler sees them.
 * Shared by tests/pdf-text-lazy-load.test.ts (lib/pdf-text stays out of
 * every first load) and tests/edit-pdf-facade.test.ts (the editor facade
 * stays light).
 */

/**
 * Module specifiers a file imports at load time. Leaves out import(),
 * `import type`, `export type` and braces holding only `type` names.
 */
export function staticImports(source: string): string[] {
  const specifiers: string[] = [];
  const withFrom = /^[ \t]*(?:import|export)[ \t]+(type[ \t]+)?([^;'"`]*?)[ \t\r\n]*from[ \t]*['"]([^'"]+)['"]/gm;
  for (const [, typeOnly, clause, specifier] of source.matchAll(withFrom)) {
    if (typeOnly) continue;
    const braces = /^\{([\s\S]*)\}$/.exec(clause.trim());
    const names = braces ? braces[1].split(',').map((name) => name.trim()).filter(Boolean) : [];
    if (names.length > 0 && names.every((name) => /^type\s/.test(name))) continue;
    specifiers.push(specifier);
  }
  for (const [, specifier] of source.matchAll(/^[ \t]*import[ \t]*['"]([^'"]+)['"]/gm)) specifiers.push(specifier);
  return specifiers;
}

/** Specifiers loaded with import(), in source order. */
export function dynamicImports(source: string): string[] {
  return [...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
}
