// Renders the assembled results into report.json, report.md and report.html.
// The HTML report is the artifact built for eyeballing RTL ordering and the
// searchable-text-layer quality — the two things the numbers can't show.
import fs from 'node:fs';
import path from 'node:path';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);
const ms = (x) => (x == null ? '—' : `${(x / 1000).toFixed(1)}s`);
const usd = (x) => (x == null ? '—' : x === 0 ? '$0' : `$${x.toFixed(4)}`);

export function writeReports(outDir, results) {
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(outDir, 'report.md'), markdown(results));
  fs.writeFileSync(path.join(outDir, 'report.html'), html(results));
}

function markdown(r) {
  const eng = r.engines;
  const L = [];
  L.push(`# OCR bake-off — ${r.runId}`, '', `Generated ${r.generatedAt}`, '');
  L.push(`- Samples: ${r.samples.length} (${r.samples.filter((s) => s.hasGT).length} with ground truth)`);
  L.push(`- Engines: ${eng.map((e) => e.label).join(', ')}`);
  L.push(`- Claude model: \`${r.config.claudeModel}\` · Tesseract langs: \`${r.config.langs}\``, '');

  L.push('## Aggregates', '');
  L.push('| Engine | Runs | Errors | Avg CER (norm) | Avg time | Total cost | Search layer |');
  L.push('|---|---|---|---|---|---|---|');
  for (const e of eng) {
    const a = r.aggregates[e.id];
    const cer = a.avgCERNorm == null ? '— (no GT)' : pct(a.avgCERNorm);
    const sl = a.searchLayerTotal ? `${a.searchLayerOK}/${a.searchLayerTotal} ok` : '—';
    L.push(`| ${e.label} | ${a.runs} | ${a.errors} | ${cer} | ${ms(a.avgTimeMs)} | ${usd(a.totalCostUSD)} | ${sl} |`);
  }
  L.push('');

  const anyGT = r.samples.some((s) => s.hasGT);
  if (anyGT) {
    L.push('## Per-sample CER (normalized, vs ground truth)', '');
    L.push(`| Sample | ${eng.map((e) => e.id).join(' | ')} |`);
    L.push(`|---|${eng.map(() => '---').join('|')}|`);
    for (const s of r.samples.filter((x) => x.hasGT)) {
      const cells = eng.map((e) => {
        const res = s.results[e.id];
        if (!res || res.error) return res?.error ? 'ERR' : '—';
        return res.score ? pct(res.score.cerNorm) : '—';
      });
      L.push(`| ${s.name} | ${cells.join(' | ')} |`);
    }
    L.push('');
  } else {
    L.push('## No ground truth provided', '',
      'CER is unavailable without `<name>.gt.txt` reference files. Use the HTML report to eyeball',
      'RTL ordering and search-layer quality, and the inter-engine agreement below as a proxy',
      '(engines that agree are likelier correct; the current Tesseract diverging from the VLMs is the signal to watch).', '');
    L.push('### Inter-engine agreement (avg pairwise CER, lower = more agreement)', '');
    for (const s of r.samples) {
      const pairs = Object.entries(s.agreement || {});
      if (!pairs.length) continue;
      L.push(`- **${s.name}**: ${pairs.map(([k, v]) => `${k} ${pct(v)}`).join(' · ')}`);
    }
    L.push('');
  }

  L.push('## Errors', '');
  let anyErr = false;
  for (const s of r.samples) {
    for (const e of eng) {
      const res = s.results[e.id];
      if (res?.error) { L.push(`- ${s.name} / ${e.id}: ${res.error}`); anyErr = true; }
    }
  }
  if (!anyErr) L.push('_None._');
  L.push('', `Open \`report.html\` in a browser for side-by-side text with RTL rendering.`);
  return L.join('\n');
}

function html(r) {
  const eng = r.engines;
  const summaryRows = eng.map((e) => {
    const a = r.aggregates[e.id];
    const cer = a.avgCERNorm == null ? '<span class="muted">no GT</span>' : pct(a.avgCERNorm);
    const sl = a.searchLayerTotal ? `${a.searchLayerOK}/${a.searchLayerTotal}` : '—';
    return `<tr><td>${esc(e.label)}</td><td>${a.runs}</td><td>${a.errors}</td><td>${cer}</td><td>${ms(a.avgTimeMs)}</td><td>${usd(a.totalCostUSD)}</td><td>${sl}</td></tr>`;
  }).join('');

  const sampleBlocks = r.samples.map((s) => {
    const panels = eng.map((e) => {
      const res = s.results[e.id] || {};
      if (res.error) {
        return `<div class="panel err"><div class="phead">${esc(e.label)} <span class="tag">error</span></div><div class="meta">${esc(res.error)}</div></div>`;
      }
      const bits = [];
      if (res.score) bits.push(`CER ${pct(res.score.cerNorm)}`);
      bits.push(ms(res.timeMs));
      bits.push(usd(res.costUSD));
      bits.push(`ar ${pct(res.arabicRatio)}`);
      if (res.searchLayer != null) bits.push(res.searchLayer ? 'search✓' : 'search✗');
      if (!res.hasRTL && res.arabicRatio > 0.05) bits.push('⚠ no-RTL');
      return `<div class="panel"><div class="phead">${esc(e.label)}</div>`
        + `<div class="meta">${bits.join(' · ')}${res.note ? ` · <span class="muted">${esc(res.note)}</span>` : ''}</div>`
        + `<div class="text" dir="auto">${esc(res.text || '(empty)')}</div></div>`;
    }).join('');
    const thumb = s.thumb ? `<img class="thumb" src="${s.thumb}" alt="page 1"/>` : '<div class="thumb muted">no preview</div>';
    return `<section class="sample"><h2>${esc(s.name)} <span class="muted">${s.pages || '?'}pp${s.hasGT ? ' · GT' : ''}</span></h2>`
      + `<div class="row"><div class="left">${thumb}${s.hasGT ? `<div class="panel gt"><div class="phead">ground truth</div><div class="text" dir="auto">${esc(s.groundTruth || '')}</div></div>` : ''}</div>`
      + `<div class="grid">${panels}</div></div></section>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OCR bake-off ${esc(r.runId)}</title><style>
:root{color-scheme:light dark}
body{font:14px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:24px;max-width:1400px;margin:auto}
h1{margin:0 0 4px}h2{margin:28px 0 10px;border-top:1px solid #8884;padding-top:14px}
.sub{color:#888;margin-bottom:18px}
table{border-collapse:collapse;width:100%;margin:12px 0}
th,td{border:1px solid #8884;padding:6px 10px;text-align:left}th{background:#8881}
.muted{color:#999}
.row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
.left{flex:0 0 240px;display:flex;flex-direction:column;gap:10px}
.thumb{width:240px;border:1px solid #8884;border-radius:6px}
.grid{flex:1 1 500px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;min-width:0}
.panel{border:1px solid #8884;border-radius:6px;padding:10px;min-width:0}
.panel.err{border-color:#e0555588;background:#e0555511}
.panel.gt{border-color:#4aa04a88;background:#4aa04a11}
.phead{font-weight:600;margin-bottom:4px}
.tag{font-weight:400;color:#e05555}
.meta{color:#888;font-size:12px;margin-bottom:8px}
.text{white-space:pre-wrap;word-break:break-word;max-height:420px;overflow:auto;font:13px/1.6 ui-monospace,Menlo,monospace;background:#8880;padding:8px;border-radius:4px}
</style></head><body>
<h1>OCR bake-off</h1>
<div class="sub">${esc(r.runId)} · ${esc(r.generatedAt)} · ${r.samples.length} samples · Claude <code>${esc(r.config.claudeModel)}</code> · Tesseract <code>${esc(r.config.langs)}</code></div>
<table><thead><tr><th>Engine</th><th>Runs</th><th>Errors</th><th>Avg CER</th><th>Avg time</th><th>Total cost</th><th>Search layer</th></tr></thead><tbody>${summaryRows}</tbody></table>
<p class="muted">CER shown only where ground-truth <code>.gt.txt</code> files were supplied. "⚠ no-RTL" flags Arabic-heavy output with no right-to-left characters — a reversed/broken-ordering symptom. "search✓/✗" reports whether a searchable text layer came back out of the produced PDF (Tesseract only).</p>
${sampleBlocks}
</body></html>`;
}
