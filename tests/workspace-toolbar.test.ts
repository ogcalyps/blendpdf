/**
 * The workspace toolbar says what every button does in words (phones too),
 * the All pages grid shows page tools instead of tools that only work on one
 * page, the second line has the page and file tools, the Options button has
 * visible text, and the menus stay on screen.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'use-intl';
import { describe, expect, it, vi } from 'vitest';
import enMessages from '../messages/en.json';
import arMessages from '../messages/ar.json';
import { CONVERT_TOOLS, FILE_TOOLS, Toolbar, type FileTools, type PageTools } from '../components/edit-pdf/Toolbar';
import { ALL_TOOLS } from '../components/edit-pdf/workspace-rules';
import { MENU_EDGE, MENU_GAP, placeMenu } from '../components/edit-pdf/menuPlacement';

// next-intl's client entry imports next/navigation, which only resolves inside Next: its hooks are use-intl's
vi.mock('next-intl', () => import('use-intl'));

const MESSAGES = { en: enMessages, ar: arMessages };

function render(over: { view?: 'page' | 'grid'; pageTools?: PageTools; fileTools?: FileTools; locale?: 'en' | 'ar' } = {}) {
  const locale = over.locale ?? 'en';
  const missing: string[] = [];
  const noop = () => undefined;
  const html = renderToStaticMarkup(
    createElement(IntlProvider, {
      locale,
      timeZone: 'UTC',
      messages: MESSAGES[locale],
      onError: (error: Error) => missing.push(error.message),
      children: createElement(Toolbar, {
        view: over.view ?? 'page',
        onView: noop,
        tool: 'select',
        onTool: noop,
        onInsert: noop,
        pageTools: over.pageTools,
        fileTools: over.fileTools,
        canUndo: false,
        canRedo: false,
        onUndo: noop,
        onRedo: noop,
        zoom: 1,
        canZoomIn: true,
        canZoomOut: true,
        onZoom: noop,
        primary: { label: 'Save PDF', busy: false, busyLabel: 'Saving', onPrimary: noop, onMore: noop, onBlocked: noop },
        onBlocked: noop,
      }),
    }),
  );
  return { html, missing };
}

/** The text a button shows (tags stripped), for every button. */
const buttonTexts = (html: string) =>
  html
    .split('<button')
    .slice(1)
    .map((b) => b.slice(b.indexOf('>') + 1, b.indexOf('</button>')).replace(/<[^>]+>/g, '').trim());
/** The opening tag of the button that shows `text`. */
const buttonWith = (html: string, text: string) => html.split('<button').find((b) => b.slice(0, b.indexOf('</button>')).includes(`>${text}<`)) ?? '';

const ALL_PAGE_TOOLS: PageTools = {
  selected: 2,
  total: 5,
  onSelectAll: () => undefined,
  onClear: () => undefined,
  onTurn: () => undefined,
  onDelete: () => undefined,
  onAddBlank: () => undefined,
};

describe('the toolbar names every button in words', () => {
  it('shows a label on every editing tool, the view switch, undo, redo and zoom', () => {
    const { html, missing } = render();
    expect(missing).toEqual([]);
    const texts = buttonTexts(html);
    for (const label of [
      'One page',
      'All pages',
      'Select',
      'Text',
      'Edit existing text',
      'Draw',
      'Shapes',
      'Highlight',
      'Hide (white box)',
      'Crop',
      'Insert',
      'Undo',
      'Redo',
      'Zoom out',
      'Zoom in',
    ]) {
      // The Edit existing text button also carries its Beta badge
      expect(texts.some((t) => t === label || t === `${label}Beta`), label).toBe(true);
    }
    // No button is an icon alone
    expect(texts.filter((t) => t === '')).toEqual([]);
    // The label isn't held back to wide screens
    expect(html).not.toMatch(/hidden xl:inline/);
  });

  it('keeps beta in the Edit existing text name, and the Hide tooltip says the content stays', () => {
    const { html } = render();
    expect(buttonWith(html, 'Edit existing text')).toContain('aria-label="Edit existing text (beta)"');
    expect(buttonWith(html, 'Hide (white box)')).toContain('still in the file');
  });

  it('gives the Options button visible text, keeping its full name', () => {
    const { html } = render();
    const options = buttonWith(html, 'Options');
    expect(options).toContain('aria-label="More save options"');
  });

  it('has every string in Arabic too', () => {
    expect(render({ locale: 'ar' }).missing).toEqual([]);
    expect(render({ locale: 'ar', view: 'grid', pageTools: ALL_PAGE_TOOLS }).missing).toEqual([]);
  });
});

describe('the All pages grid shows page tools', () => {
  it('swaps the editing tools and zoom for the page tools', () => {
    const { html, missing } = render({ view: 'grid', pageTools: ALL_PAGE_TOOLS });
    expect(missing).toEqual([]);
    const texts = buttonTexts(html);
    for (const label of ['Select all', 'Clear selection', 'Turn left', 'Turn right', 'Delete selected', 'Add another PDF', 'Add a blank page']) {
      expect(texts, label).toContain(label);
    }
    for (const label of ['Text', 'Draw', 'Highlight', 'Hide (white box)', 'Edit existing text', 'Zoom in', 'Zoom out']) {
      expect(texts, label).not.toContain(label);
    }
    // Undo and the primary button stay
    expect(texts).toContain('Undo');
    expect(texts).toContain('Save PDF');
  });

  it('leaves out a page tool whose handler is not passed (Add another PDF goes through onInsert)', () => {
    const texts = buttonTexts(render({ view: 'grid' }).html);
    expect(texts).toContain('Add another PDF');
    for (const label of ['Select all', 'Clear selection', 'Turn left', 'Delete selected', 'Add a blank page']) {
      expect(texts, label).not.toContain(label);
    }
  });

  it('keeps Turn, Delete and Clear tappable but blocked with nothing selected, and Delete when every page is', () => {
    const none = render({ view: 'grid', pageTools: { ...ALL_PAGE_TOOLS, selected: 0 } }).html;
    for (const label of ['Turn left', 'Turn right', 'Delete selected', 'Clear selection']) {
      expect(buttonWith(none, label), label).toContain('aria-disabled="true"');
    }
    expect(buttonWith(none, 'Select all')).not.toContain('aria-disabled');
    const every = render({ view: 'grid', pageTools: { ...ALL_PAGE_TOOLS, selected: 5 } }).html;
    expect(buttonWith(every, 'Delete selected')).toContain('aria-disabled="true"');
    expect(buttonWith(every, 'Turn left')).not.toContain('aria-disabled');
  });
});

describe('menus stay on screen', () => {
  const viewport = { width: 1280, height: 800 };
  const menu = { width: 232, height: 340 };
  const at = (left: number, width = 60) => ({ left, right: left + width, top: 60, bottom: 108 });

  it('opens under the button, start edges lined up', () => {
    expect(placeMenu(at(400), menu, viewport, false)).toEqual({ top: 108 + MENU_GAP, left: 400, maxHeight: 800 - MENU_EDGE - 108 - MENU_GAP });
    // Arabic: the right edges line up
    expect(placeMenu(at(400), menu, viewport, true).left).toBe(460 - 232);
  });

  it('lines up the end edges when the start would run off screen (Insert at the end of the row)', () => {
    expect(placeMenu(at(1180), menu, viewport, false).left).toBe(1240 - 232);
    expect(placeMenu(at(20), menu, viewport, true).left).toBe(20);
  });

  it('clamps inside the screen when neither edge fits', () => {
    const narrow = { width: 300, height: 800 };
    const { left } = placeMenu({ left: 250, right: 290, top: 60, bottom: 108 }, { width: 260, height: 100 }, narrow, false);
    expect(left).toBeGreaterThanOrEqual(MENU_EDGE);
    expect(left + 260).toBeLessThanOrEqual(300 - MENU_EDGE);
  });

  it('opens upwards when it would not fit below and there is more room above', () => {
    const low = { left: 400, right: 460, top: 700, bottom: 748 };
    const place = placeMenu(low, menu, viewport, false);
    expect(place.top).toBe(700 - MENU_GAP - 340);
    expect(place.maxHeight).toBe(700 - MENU_GAP - MENU_EDGE);
  });
});

describe('the second line has the page and file tools', () => {
  const FILE: FileTools = { onPick: () => undefined, blocked: {} };
  const LABELS = ['Merge', 'Split', 'Rotate', 'Delete pages', 'Sign', 'Watermark', 'Page numbers', 'Compress', 'Convert', 'Protect'];

  it('names each one in words, next to the primary button', () => {
    const { html, missing } = render({ fileTools: FILE });
    expect(missing).toEqual([]);
    const texts = buttonTexts(html);
    for (const label of LABELS) expect(texts, label).toContain(label);
    expect(html).toContain('aria-label="Page and file tools"');
    // The line ends with the primary button
    const line = html.slice(html.indexOf('aria-label="Page and file tools"'));
    expect(buttonTexts(line).slice(-2)).toEqual(['Save PDF', 'Options']);
    expect(buttonWith(html, 'Merge')).toContain('title="Add another PDF to the end"');
  });

  it('only runs tools All tools has, and every format is in Convert', () => {
    const all = new Set(ALL_TOOLS.flatMap((g) => g.items));
    for (const id of [...FILE_TOOLS.flat(), ...CONVERT_TOOLS]) if (id !== 'convert') expect(all.has(id), id).toBe(true);
    expect([...CONVERT_TOOLS].sort()).toEqual(['excel', 'images', 'imagesInside', 'pdfa', 'plainText', 'word']);
  });

  it('leaves out of the grid the ones its page tools already have', () => {
    const texts = buttonTexts(render({ view: 'grid', pageTools: ALL_PAGE_TOOLS, fileTools: FILE }).html);
    for (const label of ['Merge', 'Rotate', 'Delete pages']) expect(texts, label).not.toContain(label);
    for (const label of ['Split', 'Sign', 'Compress', 'Convert', 'Protect']) expect(texts, label).toContain(label);
  });

  it("keeps a tool that can't act tappable, saying why", () => {
    const html = render({ fileTools: { ...FILE, blocked: { delete: 'Your PDF has one page' } } }).html;
    expect(buttonWith(html, 'Delete pages')).toContain('aria-disabled="true"');
    expect(buttonWith(html, 'Split')).not.toContain('aria-disabled');
  });

  it('has every string in Arabic, and no word on where things run', () => {
    expect(render({ locale: 'ar', fileTools: FILE }).missing).toEqual([]);
    expect(render({ locale: 'ar', view: 'grid', pageTools: ALL_PAGE_TOOLS, fileTools: FILE }).missing).toEqual([]);
    expect(render({ fileTools: FILE }).html).not.toMatch(/server|browser/i);
  });

  it('puts Undo, Redo and zoom on one line at a time: the first from 1000 px, before the primary button below', () => {
    const { html } = render({ fileTools: FILE });
    // Two copies, each shown only in its own width range: md:flex beside min-[1000px]:hidden left both showing at 1000 px
    expect(html.match(/min-\[1000px\]:flex/g)).toHaveLength(1);
    expect(html.match(/md:max-\[1000px\]:flex/g)).toHaveLength(1);
    expect(html).not.toMatch(/min-\[1000px\]:hidden/);
    const line2 = html.slice(html.indexOf('aria-label="Page and file tools"'));
    expect(buttonTexts(line2).slice(-6)).toEqual(['Undo', 'Redo', 'Zoom out', 'Zoom in', 'Save PDF', 'Options']);
  });

  it('without file tools the line holds the primary button only', () => {
    const texts = buttonTexts(render().html);
    for (const label of LABELS) expect(texts, label).not.toContain(label);
    expect(texts).toContain('Save PDF');
  });
});
