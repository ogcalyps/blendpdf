# Arabic OCR bake-off (Stage 0)

A one-day measurement harness to answer the question that gates the whole
"AI Arabic OCR" bet: **on your real documents, how much better than the
Tesseract you already ship is a cloud OCR API or a vision-language model — and
does a VLM read Arabic correctly enough to collapse the RTL-reconstruction
work?**

It runs a folder of Arabic documents — **PDFs or images** (`.png/.jpg/.tiff/.webp`,
so phone photos of IDs work directly) — through up to four engines and produces
a side-by-side report:

| Engine | What it represents | Runs when |
|---|---|---|
| **Tesseract** (`ocrmypdf`) | what `app/api/ocr-pdf` ships **today** | `ocrmypdf` is installed |
| **Google Document AI** | the proposal's recommended cloud OCR | GCP project + processor + token |
| **Claude vision** | fits BlendPDF's existing Anthropic relationship | `@anthropic-ai/sdk` + credentials |
| **Gemini** | the proposal's best-in-class Arabic VLM | `GEMINI_API_KEY` |

Every engine is optional. Whatever you've configured runs; the rest are skipped
with a clear reason — so you get signal immediately with just the Tesseract you
already have, and add cloud engines as you get keys.

## What it measures

- **CER / WER** vs ground truth (when you supply `<name>.gt.txt` files),
  Arabic-normalized (diacritics/tatweel stripped, alef/ya/ta-marbuta unified).
- **Inter-engine agreement** (pairwise CER) when there's no ground truth —
  engines that agree are likelier right; Tesseract diverging from the VLMs is
  the signal to watch.
- **RTL health** — flags Arabic-heavy output that contains no right-to-left
  characters (a reversed/broken-ordering symptom).
- **Search-layer quality** — whether a searchable text layer actually comes back
  out of Tesseract's produced PDF (`ocrmypdf` already does this — part of the
  proposal's claimed "moat" you already have).
- **Time and cost** per engine (exact token cost for Claude/Gemini from usage,
  `$1.50/1k pages` for Document AI, `$0` for local Tesseract).

The **HTML report** puts the page-1 thumbnail next to each engine's text (with
correct RTL rendering) so you can eyeball the two things the numbers can't show:
reading order and ligature/diacritic fidelity.

## Prerequisites

- **Node 18+** (uses global `fetch`).
- **System binaries** (macOS): `brew install ocrmypdf tesseract-lang poppler`
  — `ocrmypdf`/`tesseract` for the current-prod engine, `poppler` for
  `pdfinfo`/`pdftoppm`/`pdftotext` (page counts, thumbnails, search-layer check).
- **Claude engine:** `npm i -D @anthropic-ai/sdk`, plus `ANTHROPIC_API_KEY`
  (or an `ant auth login` profile — the SDK picks it up automatically).
- **Gemini engine:** `GEMINI_API_KEY`.
- **Document AI engine:** `GCP_PROJECT_ID`, `DOCAI_PROCESSOR_ID` (a *Document
  OCR* processor), and either `GOOGLE_ACCESS_TOKEN` or the `gcloud` CLI
  authenticated (`gcloud auth application-default login`).

## Usage

```bash
# 1. Drop PDFs (and optional <name>.gt.txt files) into ./samples  (see samples/README.md)
# 2. See what's configured and the cost estimate, without calling anything:
node scripts/ocr-bakeoff/run.mjs --dry-run
# 3. Run it:
node scripts/ocr-bakeoff/run.mjs
```

Flags:

- `--samples DIR` — sample folder (default `./samples`).
- `--out DIR` — output folder (default `./out/<timestamp>`).
- `--engines tesseract,claude` — restrict to a subset.
- `--langs ara+eng` — Tesseract languages (default `ara+eng`, matching prod's allowlist).
- `--dry-run` — capability + cost report only, no engine calls.

Environment overrides: `CLAUDE_MODEL` (default `claude-opus-5` — set
`claude-haiku-4-5` to benchmark the cheap-path deployment), `GEMINI_MODEL`
(default `gemini-2.0-flash`), `DOCAI_LOCATION` (default `us`), `OCR_LANGS`.

## Output

Written to `out/<timestamp>/`:

- `report.html` — **open this first.** Side-by-side text with RTL rendering + thumbnails.
- `report.md` — the tables (aggregates, per-sample CER or agreement, errors).
- `report.json` — everything, machine-readable.
- `work/<sample>/<engine>.txt` — each engine's raw transcription.

## How to read it (the decision)

1. **Is the gap real on *your* docs?** Compare Tesseract's CER (or its output in
   the HTML) against the cloud/VLM engines. If the delta is large and consistent,
   the "upgrade the existing `/ocr-pdf` engine" project is justified. If it's
   small, the current engine is closer to good-enough than the proposal assumes.
2. **Does a VLM collapse the reconstruction work?** If Claude/Gemini return
   clean, correctly-ordered RTL text in one call, the hand-built
   bidi/ligature-reconstruction "moat" — the expensive engineering — may not need
   building at all. That's the central architecture fork.
3. **Cost vs the budget rule.** Check the per-engine `Total cost` against realistic
   volume. Cheap unit cost + a free no-signup endpoint still needs a hard monthly
   cap and a fallback-to-local-Tesseract path before shipping.

## Notes / limitations

- **Inputs:** PDFs and images (`.png .jpg .jpeg .tif .tiff .webp .gif .bmp`).
  Tesseract wraps images into a PDF at 300 DPI; the VLMs/Document AI take them
  natively. Claude accepts png/jpeg/gif/webp and Gemini png/jpeg/webp — a `.tiff`
  or `.bmp` is skipped for those two with a per-sample note (Tesseract and
  Document AI still handle it).
- Document AI's synchronous `process` endpoint caps at ~15 pages / 20 MB — keep
  samples small, or it returns a 400 (the harness flags this).
- Gemini cost is an order-of-magnitude estimate; verify against current pricing.
- Claude runs at `effort: low` (transcription needs little deliberation) to keep
  it cheap; raise `CLAUDE_MODEL`/effort in `engines.mjs` if you want the ceiling.
- This is a throwaway evaluation tool — plain Node ESM under `scripts/`, no
  changes to the app. Delete the folder when the decision is made.
