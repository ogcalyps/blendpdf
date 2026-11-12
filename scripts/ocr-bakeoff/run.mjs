#!/usr/bin/env node
// Stage-0 OCR bake-off: run a folder of Arabic PDFs through every available
// engine, score them, and emit a report. See README.md.
//
//   node scripts/ocr-bakeoff/run.mjs [--samples DIR] [--out DIR]
//        [--engines a,b,c] [--langs ara+eng] [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINES } from './engines.mjs';
import { scoreAgainst, scorePair, arabicRatio, hasRTL, charCount, normalizeLight } from './score.mjs';
import { writeReports } from './report.mjs';
import { pdfPageCount, firstPageThumb, ensureDir, mimeForFile, dataUri } from './util.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = { engines: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dry-run') a.dryRun = true;
    else if (k === '--samples') a.samples = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--langs') a.langs = argv[++i];
    else if (k === '--engines') a.engines = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else console.error(`ignoring unknown arg: ${k}`);
  }
  return a;
}

function runId() {
  // Sortable, filesystem-safe timestamp (avoid ':' for cross-platform paths).
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

const SAMPLE_RE = /\.(pdf|png|jpe?g|tiff?|webp|gif|bmp)$/i;

function discoverSamples(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => SAMPLE_RE.test(f))
    .sort()
    .map((f) => {
      const full = path.join(dir, f);
      const ext = path.extname(f);
      const base = f.slice(0, -ext.length);
      const gtPath = path.join(dir, `${base}.gt.txt`);
      const hasGT = fs.existsSync(gtPath);
      const mime = mimeForFile(full);
      return {
        name: base,
        path: full,
        kind: mime === 'application/pdf' ? 'pdf' : 'image',
        mime,
        hasGT,
        groundTruth: hasGT ? fs.readFileSync(gtPath, 'utf8') : null,
      };
    });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const samplesDir = args.samples ? path.resolve(args.samples) : path.join(HERE, 'samples');
  const langs = args.langs || process.env.OCR_LANGS || 'ara+eng';
  const claudeModel = process.env.CLAUDE_MODEL || 'claude-opus-5';
  const ctx = { langs, claudeModel };

  console.log('OCR bake-off — Stage 0\n');

  // 1. Capability probe -------------------------------------------------------
  const detected = [];
  for (const e of ENGINES) {
    const d = await e.detect();
    detected.push({ engine: e, ...d });
    const flag = d.ok ? '  ok' : 'skip';
    console.log(`  [${flag}] ${e.id.padEnd(11)} ${d.ok ? (d.note || '') : d.reason}`);
  }
  console.log('');

  let enabled = detected.filter((d) => d.ok);
  if (args.engines) {
    for (const id of args.engines) {
      if (!ENGINES.some((e) => e.id === id)) console.error(`  requested engine not recognized: ${id}`);
      const d = detected.find((x) => x.engine.id === id);
      if (d && !d.ok) console.error(`  requested engine unavailable: ${id} — ${d.reason}`);
    }
    enabled = enabled.filter((d) => args.engines.includes(d.engine.id));
  }
  if (!enabled.length) {
    console.error('No engines available. Configure at least Tesseract (brew install ocrmypdf tesseract-lang) and re-run.');
    process.exit(1);
  }
  console.log(`Running engines: ${enabled.map((d) => d.engine.id).join(', ')}\n`);

  // 2. Discover samples -------------------------------------------------------
  const samples = discoverSamples(samplesDir);
  if (!samples.length) {
    console.error(`No PDFs or images found in ${samplesDir}`);
    console.error('Drop representative Arabic docs there — PDFs or images (.png/.jpg/.tiff/.webp): clean scans,');
    console.error('mobile photos, an Emirates ID, a certificate, a mixed AR/EN page. Optionally add "<name>.gt.txt"');
    console.error('ground-truth files to get CER. Then re-run.');
    process.exit(1);
  }
  for (const s of samples) s.pages = s.kind === 'pdf' ? await pdfPageCount(s.path) : 1;

  const totalPages = samples.reduce((n, s) => n + (s.pages || 1), 0);
  console.log(`Samples: ${samples.length} (${samples.filter((s) => s.hasGT).length} with ground truth), ~${totalPages} pages total`);
  if (enabled.some((d) => d.engine.id === 'documentai')) {
    console.log(`Est. Document AI cost: ~$${((totalPages * 1.5) / 1000).toFixed(4)} (@ $1.50/1k pages)`);
  }
  if (enabled.some((d) => ['claude', 'gemini'].includes(d.engine.id))) {
    console.log('Est. Claude/Gemini cost: token-based, typically a few cents at this scale (exact costs reported after the run).');
  }
  console.log('');

  if (args.dryRun) {
    console.log('--dry-run: not calling any engine. Remove the flag to execute.');
    return;
  }

  // 3. Run --------------------------------------------------------------------
  const outDir = ensureDir(args.out ? path.resolve(args.out) : path.join(HERE, 'out', runId()));
  console.log(`Output: ${outDir}\n`);

  for (const s of samples) {
    s.workDir = ensureDir(path.join(outDir, 'work', s.name));
    s.thumb = s.kind === 'pdf' ? await firstPageThumb(s.path, s.workDir) : dataUri(s.path, s.mime);
    s.results = {};
    console.log(`• ${s.name} (${s.pages || '?'}pp)`);
    for (const d of enabled) {
      const e = d.engine;
      const res = await e.run(s, ctx);
      if (res.error) {
        console.log(`    ${e.id.padEnd(11)} ERROR: ${res.error}`);
      } else {
        // Derived metrics + optional CER against ground truth.
        res.charCount = charCount(res.text);
        res.arabicRatio = arabicRatio(res.text);
        res.hasRTL = hasRTL(res.text);
        if (s.hasGT && res.text) res.score = scoreAgainst(s.groundTruth, res.text);
        fs.writeFileSync(path.join(s.workDir, `${e.id}.txt`), res.text || '');
        const cer = res.score ? ` CER ${(res.score.cerNorm * 100).toFixed(1)}%` : '';
        console.log(`    ${e.id.padEnd(11)} ${(res.timeMs / 1000).toFixed(1)}s  ${res.charCount}chars  ar ${(res.arabicRatio * 100).toFixed(0)}%${cer}`);
      }
      s.results[e.id] = res;
    }

    // Inter-engine agreement (proxy signal when there's no ground truth).
    s.agreement = {};
    const ok = enabled.map((d) => d.engine.id).filter((id) => s.results[id]?.text && !s.results[id].error);
    for (let i = 0; i < ok.length; i++) {
      for (let j = i + 1; j < ok.length; j++) {
        s.agreement[`${ok[i]}|${ok[j]}`] = scorePair(s.results[ok[i]].text, s.results[ok[j]].text);
      }
    }
  }

  // 4. Aggregate + report -----------------------------------------------------
  const engineList = enabled.map((d) => ({ id: d.engine.id, label: d.engine.label, note: d.note || '' }));
  const aggregates = {};
  for (const e of engineList) {
    const rows = samples.map((s) => s.results[e.id]).filter(Boolean);
    const okRows = rows.filter((r) => !r.error);
    const cerRows = okRows.filter((r) => r.score);
    const slRows = okRows.filter((r) => r.searchLayer != null);
    aggregates[e.id] = {
      runs: okRows.length,
      errors: rows.length - okRows.length,
      avgTimeMs: okRows.length ? okRows.reduce((n, r) => n + (r.timeMs || 0), 0) / okRows.length : null,
      totalCostUSD: okRows.reduce((n, r) => n + (r.costUSD || 0), 0),
      avgCERNorm: cerRows.length ? cerRows.reduce((n, r) => n + r.score.cerNorm, 0) / cerRows.length : null,
      searchLayerOK: slRows.filter((r) => r.searchLayer).length,
      searchLayerTotal: slRows.length,
    };
  }

  const results = {
    runId: path.basename(outDir),
    generatedAt: new Date().toISOString(),
    config: { claudeModel, langs, engines: engineList.map((e) => e.id) },
    engines: engineList,
    aggregates,
    samples: samples.map((s) => ({
      name: s.name, pages: s.pages, hasGT: s.hasGT, groundTruth: s.groundTruth,
      thumb: s.thumb, results: s.results, agreement: s.agreement,
    })),
  };
  writeReports(outDir, results);

  // 5. Console summary --------------------------------------------------------
  console.log('\n──────── summary ────────');
  for (const e of engineList) {
    const a = aggregates[e.id];
    const cer = a.avgCERNorm == null ? 'CER n/a (no GT)' : `avg CER ${(a.avgCERNorm * 100).toFixed(1)}%`;
    const sl = a.searchLayerTotal ? `, search ${a.searchLayerOK}/${a.searchLayerTotal}` : '';
    console.log(`  ${e.id.padEnd(11)} ${a.runs} ok / ${a.errors} err · ${cer} · avg ${(a.avgTimeMs ? a.avgTimeMs / 1000 : 0).toFixed(1)}s · $${a.totalCostUSD.toFixed(4)}${sl}`);
  }
  if (!samples.some((s) => s.hasGT)) {
    console.log('\n  No ground truth → CER unavailable. Open report.html to eyeball RTL ordering + search layer,');
    console.log('  and check inter-engine agreement in report.md (Tesseract diverging from the VLMs is the signal).');
  }
  console.log(`\n  report.html  →  ${path.join(outDir, 'report.html')}`);
  console.log(`  report.md    →  ${path.join(outDir, 'report.md')}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
