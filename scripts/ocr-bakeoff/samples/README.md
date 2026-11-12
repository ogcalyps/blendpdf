# Drop your Arabic sample PDFs here

Put 20–30 representative documents here — **PDFs or images**
(`.png .jpg .jpeg .tif .tiff .webp`). Phone photos of IDs/certificates work
directly, no need to convert to PDF first.

- clean flatbed scans
- mobile-phone photos of documents
- an Emirates ID / national ID
- a degree or attestation certificate
- at least one mixed Arabic + English page
- one deliberately low-quality / skewed scan

**Ground truth (optional but valuable).** For any sample, add a plain-text file
with the correct transcription named `<same-basename>.gt.txt`. For `nda.pdf`,
that's `nda.gt.txt`. When a `.gt.txt` exists, the harness computes real
Character Error Rate (CER) for every engine on that sample. Without it, you get
side-by-side output to eyeball plus inter-engine agreement — still enough to
judge RTL ordering and search-layer quality.

**Privacy.** This folder is git-ignored (see `../.gitignore`) so real IDs and
certificates never get committed. Note that the cloud engines (Document AI,
Claude, Gemini) upload each document to Google / Anthropic — mind data-residency
rules (UAE/Saudi PDPL) before putting genuinely sensitive B2B documents through
them. Tesseract runs fully locally.
