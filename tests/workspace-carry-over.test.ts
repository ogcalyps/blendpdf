/**
 * Switching language while a file is open: the tool page mounts again under
 * the new locale, and the file and edits used to be gone (reported 2026-11-04).
 * lib/workspace/carry-over keeps them for that one navigation.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearCarryOver,
  peekCarryOver,
  registerEditor,
  registerWorkspace,
  stashForLocaleSwitch,
} from '@/lib/workspace/carry-over';
import type { EditorState } from '@/components/edit-pdf/state';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const pdf = (name: string) => new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' });
const state = { view: 'grid' } as unknown as EditorState;

afterEach(() => clearCarryOver());

describe('work carried across a language switch', () => {
  it('the open file and editor go to the same page under the new locale', () => {
    const files = [pdf('a.pdf')];
    const working = pdf('a-ocr.pdf');
    const offWorkspace = registerWorkspace(() => ({ mode: 'rotate', files }));
    const offEditor = registerEditor(() => ({ workingFile: working, state }));
    stashForLocaleSwitch('/fr/rotate-pdf');
    offEditor();
    offWorkspace();

    const carried = peekCarryOver('/rotate-pdf', 'rotate');
    expect(carried?.files).toEqual(files);
    expect(carried?.editor).toEqual({ workingFile: working, state });
    // Render may run twice: peeking does not take it
    expect(peekCarryOver('/ar/rotate-pdf', 'rotate')).toBe(carried);
  });

  it('another page or mode does not pick it up', () => {
    const off = registerWorkspace(() => ({ mode: 'rotate', files: [pdf('a.pdf')] }));
    stashForLocaleSwitch('/rotate-pdf');
    off();
    expect(peekCarryOver('/fr/crop-pdf', 'rotate')).toBeNull();
    expect(peekCarryOver('/fr/rotate-pdf', 'crop')).toBeNull();
  });

  it('nothing is carried with no file open, or once the page has mounted', () => {
    const off = registerWorkspace(() => null);
    stashForLocaleSwitch('/rotate-pdf');
    expect(peekCarryOver('/fr/rotate-pdf', 'rotate')).toBeNull();
    off();

    const offAgain = registerWorkspace(() => ({ mode: 'rotate', files: [pdf('a.pdf')] }));
    stashForLocaleSwitch('/rotate-pdf');
    offAgain();
    clearCarryOver();
    expect(peekCarryOver('/fr/rotate-pdf', 'rotate')).toBeNull();
  });

  it('an unmounted workspace leaves nothing behind for the next switch', () => {
    const off = registerWorkspace(() => ({ mode: 'rotate', files: [pdf('a.pdf')] }));
    off();
    stashForLocaleSwitch('/rotate-pdf');
    expect(peekCarryOver('/fr/rotate-pdf', 'rotate')).toBeNull();
  });

  it('the switcher keeps the work before it navigates, and the shell and editor use it', () => {
    const switcher = read('components/LanguageSwitcher.tsx');
    expect(switcher.indexOf('stashForLocaleSwitch(window.location.pathname)')).toBeGreaterThan(-1);
    expect(switcher.indexOf('stashForLocaleSwitch(')).toBeLessThan(switcher.indexOf('router.push('));
    const shell = read('components/workspace/ToolWorkspace.tsx');
    expect(shell).toMatch(/peekCarryOver\(pathname, mode\)/);
    expect(shell).toMatch(/resume=\{resume\}/);
    const editor = read('components/edit-pdf/EditorWorkspace.tsx');
    expect(editor).toMatch(/useWorkingSource\(props\.resume\?\.workingFile \?\? props\.files\[0\]\)/);
    expect(editor).toMatch(/resume && resume\.state\.sourcePages\.length === source\.sourcePages\.length/);
    expect(editor).toMatch(/const mergedRef = useRef\(resume != null\)/);
  });
});
