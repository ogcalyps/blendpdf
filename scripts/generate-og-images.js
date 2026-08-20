/**
 * Generates the static social/share images referenced by site metadata:
 *   public/og-image.jpg      1200x630 (Open Graph)
 *   public/twitter-image.jpg 1200x630 (Twitter card)
 *   public/logo.png          512x512  (Organization schema logo)
 *
 * Run: node scripts/generate-og-images.js
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const BRAND = '#FF6B35';
const BRAND_DARK = '#E04E1B';
const INK = '#231C17';
const PAPER = '#FFFFFF';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Simplified PDF-document glyph: rounded page with a folded corner and lines.
function drawDocGlyph(ctx, x, y, scale, pageColor, accentColor) {
  const w = 120 * scale;
  const h = 150 * scale;
  const fold = 36 * scale;
  const r = 10 * scale;
  ctx.save();
  ctx.translate(x, y);
  // page body
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - fold, 0);
  ctx.lineTo(w, fold);
  ctx.lineTo(w, h - r);
  ctx.arcTo(w, h, w - r, h, r);
  ctx.lineTo(r, h);
  ctx.arcTo(0, h, 0, h - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();
  ctx.fillStyle = pageColor;
  ctx.fill();
  // folded corner
  ctx.beginPath();
  ctx.moveTo(w - fold, 0);
  ctx.lineTo(w - fold, fold);
  ctx.lineTo(w, fold);
  ctx.closePath();
  ctx.fillStyle = accentColor;
  ctx.fill();
  // text lines
  ctx.fillStyle = accentColor;
  const lineX = 22 * scale;
  const lineW = w - 44 * scale;
  const lines = [64, 86, 108];
  for (const ly of lines) {
    roundRect(ctx, lineX, ly * scale, lineW, 10 * scale, 5 * scale);
    ctx.fill();
  }
  ctx.restore();
}

function drawShareImage(file) {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // background
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // top brand bar
  ctx.fillStyle = BRAND;
  ctx.fillRect(0, 0, W, 14);
  // soft corner shapes
  ctx.fillStyle = '#FFF1EA';
  ctx.beginPath();
  ctx.arc(W - 60, H - 40, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W - 260, H + 60, 160, 0, Math.PI * 2);
  ctx.fillStyle = '#FFE3D6';
  ctx.fill();

  // document glyph cluster (subtle stack)
  ctx.save();
  ctx.translate(920, 160);
  ctx.rotate(0.08);
  drawDocGlyph(ctx, 0, 0, 1.8, '#FFE3D6', '#FFC4A8');
  ctx.restore();
  ctx.save();
  ctx.translate(880, 200);
  ctx.rotate(-0.05);
  drawDocGlyph(ctx, 0, 0, 1.8, BRAND, BRAND_DARK);
  ctx.restore();

  // wordmark
  ctx.fillStyle = INK;
  ctx.font = 'bold 92px Helvetica';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Blend', 80, 250);
  const blendW = ctx.measureText('Blend').width;
  ctx.fillStyle = BRAND;
  ctx.fillText('PDF', 80 + blendW, 250);

  // tagline
  ctx.fillStyle = INK;
  ctx.font = 'bold 44px Helvetica';
  ctx.fillText('Free PDF tools that work', 80, 360);
  ctx.fillText('in every language', 80, 418);

  // supporting line
  ctx.fillStyle = '#6B6058';
  ctx.font = '30px Helvetica';
  ctx.fillText('Merge · Split · Compress · Convert · Sign — no sign-up', 80, 492);

  // url pill
  ctx.fillStyle = BRAND;
  roundRect(ctx, 80, 530, 300, 56, 28);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px Helvetica';
  ctx.fillText('blendpdf.com', 112, 567);

  const buf = canvas.toBuffer('image/jpeg', { quality: 0.92 });
  fs.writeFileSync(file, buf);
  console.log('wrote', file, buf.length, 'bytes');
}

function drawLogo(file) {
  const S = 512;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');
  // rounded orange square
  ctx.fillStyle = BRAND;
  roundRect(ctx, 0, 0, S, S, 96);
  ctx.fill();
  // white document glyph, centered
  ctx.save();
  ctx.translate(136, 96);
  drawDocGlyph(ctx, 0, 0, 2.0, '#FFFFFF', BRAND_DARK);
  ctx.restore();
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(file, buf);
  console.log('wrote', file, buf.length, 'bytes');
}

const pub = path.join(__dirname, '..', 'public');
drawShareImage(path.join(pub, 'og-image.jpg'));
fs.copyFileSync(path.join(pub, 'og-image.jpg'), path.join(pub, 'twitter-image.jpg'));
console.log('wrote', path.join(pub, 'twitter-image.jpg'));
drawLogo(path.join(pub, 'logo.png'));
