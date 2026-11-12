import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * pdf-to-images created a pdf-images-<uuid> directory in /tmp per conversion,
 * unlinked the page images inside it and never removed the directory itself.
 * On 2026-10-04 prod /tmp still held three of them (Sep 7, Sep 18, Oct 4).
 * They were empty, but a cleanup that runs only on the paths someone remembered
 * to write it on is one early return away from leaving page images behind.
 * A directory a route creates must be removed, recursively, in a finally.
 */

const root = join(__dirname, '..');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Variables that hold a directory the route creates, with where it is created. */
function createdDirs(src: string): Array<{ name: string; at: number }> {
  const patterns = [/\b(\w+)\s*=\s*await\s+mkdtemp\(/g, /\bawait\s+mkdir\(\s*(\w+)/g];
  return patterns.flatMap((pattern) => [...src.matchAll(pattern)].map((m) => ({ name: m[1], at: m.index! })));
}

/** The body of every `finally { … }`, brace-balanced, with where it starts. */
function finallyBlocks(src: string): Array<{ body: string; at: number }> {
  return [...src.matchAll(/\bfinally\s*\{/g)].map((m) => {
    const open = m.index! + m[0].length - 1;
    let depth = 0;
    let end = open;
    for (; end < src.length; end++) {
      if (src[end] === '{') depth++;
      else if (src[end] === '}' && --depth === 0) break;
    }
    return { body: src.slice(open, end + 1), at: m.index! };
  });
}

describe('every temp directory a route creates is removed in a finally', () => {
  const files = routeFiles(join(root, 'app/api'));

  it('is looking at the route that leaked (guard is not vacuous)', () => {
    const src = stripComments(readFileSync(join(root, 'app/api/pdf-to-images/route.ts'), 'utf8'));
    expect(createdDirs(src).map((dir) => dir.name)).toContain('tempDir');
  });

  for (const file of files) {
    it(relative(root, file), () => {
      const src = stripComments(readFileSync(file, 'utf8'));
      const blocks = finallyBlocks(src);

      for (const dir of createdDirs(src)) {
        const removal = new RegExp(`\\brm\\(\\s*${dir.name}\\s*,\\s*\\{[^}]*\\brecursive:\\s*true`);
        const removedAfterCreation = blocks.some((block) => block.at > dir.at && removal.test(block.body));
        expect(removedAfterCreation, `${dir.name} is never removed with rm(…, { recursive: true }) in a finally`).toBe(
          true
        );
      }
    });
  }
});
