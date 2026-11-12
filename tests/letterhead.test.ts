/**
 * The letterhead's layout (lib/edit-pdf/model.ts letterheadPlacement) and
 * the file that carries it between devices (lib/letterhead-store.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  LETTERHEAD_GAP_PT,
  LETTERHEAD_LOGO_MAX_W_PT,
  LETTERHEAD_LOGO_PT,
  LETTERHEAD_MARGIN_PT,
  LETTERHEAD_MIN_SCALE,
  LETTERHEAD_ROOM_MIN_SCALE,
  letterheadHasContent,
  letterheadPlacement,
  letterheadRoom,
  letterheadScale,
  letterheadSideWidth,
  splitLetterheadText,
} from '../lib/edit-pdf';
import { letterheadFileText, parseLetterheadFile, type SavedLetterhead } from '../lib/letterhead-store';

const A4 = { width: 595, height: 842 };
const m = LETTERHEAD_MARGIN_PT;

describe('letterheadPlacement', () => {
  it('each side is its column between the margins and the logo; the logo is centred; the rule sits under the tallest', () => {
    const p = letterheadPlacement(A4, { left: { width: 100, height: 30 }, right: { width: 80, height: 50 }, logo: { width: 400, height: 200 } });
    const side = letterheadSideWidth(A4, { width: 400, height: 200 });
    expect(side).toBeCloseTo((A4.width - 2 * m - (80 + 2 * LETTERHEAD_GAP_PT)) / 2, 9);
    expect(p.left).toEqual({ x: m, y: m, w: side, h: 30, scale: 1 });
    expect(p.right).toEqual({ x: A4.width - m - side, y: m, w: side, h: 50, scale: 1 });
    expect(p.logo).toEqual({ x: (A4.width - 80) / 2, y: m, w: 80, h: LETTERHEAD_LOGO_PT });
    expect(p.headerRule).toBe(m + 50 + LETTERHEAD_GAP_PT / 2);
    expect(p.footer).toBeNull();
    expect(p.footerRule).toBeNull();
  });

  it('a wide logo is narrowed, keeping its shape', () => {
    const p = letterheadPlacement(A4, { logo: { width: 1000, height: 100 } });
    expect(p.logo!.w).toBe(LETTERHEAD_LOGO_MAX_W_PT);
    expect(p.logo!.h).toBeCloseTo(LETTERHEAD_LOGO_MAX_W_PT / 10, 9);
  });

  it('a block wider than its column (a word that cannot break) shrinks, never under LETTERHEAD_MIN_SCALE', () => {
    const side = letterheadSideWidth(A4, undefined);
    expect(letterheadPlacement(A4, { left: { width: side * 1.1, height: 20 } }).left!.scale).toBeCloseTo(1 / 1.1, 9);
    expect(letterheadPlacement(A4, { left: { width: side * 10, height: 20 } }).left!.scale).toBe(LETTERHEAD_MIN_SCALE);
    expect(letterheadScale({ width: 10, height: 1 }, 100)).toBe(1);
  });

  it('the footer spans the margins on the bottom margin, with its rule above', () => {
    const p = letterheadPlacement(A4, { footer: { width: 200, height: 12 } });
    expect(p.footer).toEqual({ x: m, y: A4.height - m - 12, w: A4.width - 2 * m, h: 12, scale: 1 });
    expect(p.footerRule).toBe(A4.height - m - 12 - LETTERHEAD_GAP_PT / 2);
    expect(p.headerRule).toBeNull();
  });

  it('a side splits into the name (first line) and the details', () => {
    expect(splitLetterheadText('  Centre Nour \nRabat\n05 37 ')).toEqual({ name: 'Centre Nour', details: 'Rabat\n05 37' });
    expect(splitLetterheadText('Centre Nour')).toEqual({ name: 'Centre Nour', details: '' });
  });

  it('something to draw: text anywhere or a logo', () => {
    const empty = { left: ' ', right: '', footer: '\n' };
    expect(letterheadHasContent(empty)).toBe(false);
    expect(letterheadHasContent({ ...empty, footer: 'x' })).toBe(true);
    expect(letterheadHasContent({ ...empty, logoAssetId: 'a' })).toBe(true);
  });
});

describe('letterheadRoom', () => {
  // A header 40 pt tall and a 12 pt footer on A4: text must stay between these
  const placed = letterheadPlacement(A4, { left: { width: 100, height: 40 }, footer: { width: 100, height: 12 } });
  const top = placed.headerRule! + LETTERHEAD_GAP_PT;
  const bottom = placed.footerRule! - LETTERHEAD_GAP_PT;

  it('text already clear of it: nothing moves', () => {
    expect(letterheadRoom(A4, placed, { top: top + 1, bottom: bottom - 1 })).toBeNull();
    expect(letterheadRoom(A4, placed, undefined)).toBeNull();
  });

  it('a Word letter (text from 72 pt) with room below just moves down, same size', () => {
    const room = letterheadRoom(A4, placed, { top: 72, bottom: 600 })!;
    expect(room.scale).toBe(1);
    expect(room.dx).toBe(0);
    expect(room.dy).toBeCloseTo(top - 72, 9);
  });

  it('a full page shrinks just enough, centred across, its text exactly between header and footer', () => {
    const text = { top: 50, bottom: 820 };
    const room = letterheadRoom(A4, placed, text)!;
    expect(room.scale).toBeCloseTo((bottom - top) / (text.bottom - text.top), 9);
    expect(room.dy + room.scale * text.top).toBeCloseTo(top, 9);
    expect(room.dy + room.scale * text.bottom).toBeCloseTo(bottom, 9);
    expect(room.dx).toBeCloseTo(((1 - room.scale) * A4.width) / 2, 9);
  });

  it('never shrinks under LETTERHEAD_ROOM_MIN_SCALE', () => {
    const tall = { width: 595, height: 300 };
    const p = letterheadPlacement(tall, { left: { width: 100, height: 60 }, footer: { width: 100, height: 60 } });
    expect(letterheadRoom(tall, p, { top: 0, bottom: 300 })!.scale).toBe(LETTERHEAD_ROOM_MIN_SCALE);
  });
});

describe('letterhead file', () => {
  const saved: SavedLetterhead = {
    left: 'Centre Nour\nRabat',
    right: 'مركز نور',
    footer: 'Rabat',
    pages: 'first',
    logo: { format: 'png', width: 2, height: 1, bytes: new Uint8Array([137, 80, 78, 71, 0, 255]) },
  };

  it('round-trips text, pages and the logo bytes', () => {
    expect(parseLetterheadFile(letterheadFileText(saved))).toEqual(saved);
    const { logo: _logo, ...noLogo } = saved;
    expect(parseLetterheadFile(letterheadFileText(noLogo))).toEqual(noLogo);
  });

  it('refuses anything that is not a BlendPDF letterhead', () => {
    const good = JSON.parse(letterheadFileText(saved));
    const bad = (patch: (o: Record<string, any>) => void) => {
      const o = structuredClone(good);
      patch(o);
      return parseLetterheadFile(JSON.stringify(o));
    };
    expect(parseLetterheadFile('not json')).toBeNull();
    expect(bad((o) => (o.app = 'other'))).toBeNull();
    expect(bad((o) => (o.version = 2))).toBeNull();
    expect(bad((o) => (o.letterhead.left = 'x'.repeat(301)))).toBeNull();
    expect(bad((o) => (o.letterhead.pages = 'some'))).toBeNull();
    expect(bad((o) => (o.logo.format = 'gif'))).toBeNull();
    expect(bad((o) => (o.logo.base64 = '%%%'))).toBeNull();
    expect(bad((o) => (o.logo.width = 0))).toBeNull();
  });
});

describe('roomMatrix', () => {
  it('maps visual (dx + k·x, dy + k·y) into user space on a page whose box does not start at 0', async () => {
    const { roomMatrix } = await import('../lib/edit-pdf/room');
    const g = { box: { x: 10, y: 20, width: 595, height: 842 }, rotation: 0 as const, width: 595, height: 842 };
    const room = { scale: 0.8, dx: 59.5, dy: 30 };
    const [a, , , d, e, f] = roomMatrix(g, room);
    const toUser = (x: number, y: number) => [g.box.x + x, g.box.y + g.box.height - y];
    for (const [x, y] of [[0, 0], [100, 200], [595, 842]]) {
      const [X, Y] = toUser(x, y);
      const [X2, Y2] = toUser(room.dx + room.scale * x, room.dy + room.scale * y);
      expect(a * X + e).toBeCloseTo(X2, 9);
      expect(d * Y + f).toBeCloseTo(Y2, 9);
    }
  });
});
