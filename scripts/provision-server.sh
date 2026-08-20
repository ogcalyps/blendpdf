#!/usr/bin/env bash
#
# provision-server.sh — Idempotent provisioning of the BlendPDF conversion stack
# on an Ubuntu EC2 host.
#
# Installs every binary the conversion API routes shell out to:
#   - qpdf            (unlock/repair/protect PDFs)
#   - ghostscript     (compression)
#   - poppler-utils   (pdftoppm rendering)
#   - libreoffice     (word-to-pdf, pdf-to-word fallback)
#   - ocrmypdf + tesseract-ocr (+ara/+fra packs)  (ocr-pdf; eng ships with tesseract-ocr)
#   - default-jre     (required by tabula-py for pdf-to-excel)
#   - MS-compatible + Arabic fonts (LibreOffice layout fidelity)
#   - Python packages: pypdf, pdf2docx (pdf-to-word), tabula-py (pdf-to-excel)
#
# Safe to re-run: apt and pip skip anything already installed at the requested
# version. Run this ONCE on first boot / instance replacement — NOT on every
# deploy (see the commented step in .github/workflows/deploy.yml).
#
# Usage (on the server):
#   bash scripts/provision-server.sh
#
set -euo pipefail

echo "==> Updating apt package index..."
sudo apt-get update -y

echo "==> Installing conversion binaries and fonts..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  qpdf \
  ghostscript \
  poppler-utils \
  libreoffice \
  ocrmypdf \
  tesseract-ocr \
  tesseract-ocr-ara \
  tesseract-ocr-fra \
  python3-pip \
  default-jre \
  fonts-crosextra-carlito \
  fonts-crosextra-caladea \
  fonts-noto-core \
  fonts-kacst

echo "==> Installing Python packages (pypdf, pdf2docx, tabula-py)..."
# Ubuntu 23.04+ marks the system Python as externally managed (PEP 668);
# fall back to --break-system-packages there.
PIP_PACKAGES=(pypdf pdf2docx tabula-py)
if ! python3 -m pip install --upgrade "${PIP_PACKAGES[@]}"; then
  echo "==> pip refused (externally-managed environment); retrying with --break-system-packages..."
  python3 -m pip install --break-system-packages --upgrade "${PIP_PACKAGES[@]}"
fi

echo ""
echo "=================================================="
echo "==> Verification (a failure here means a tool is missing)"
echo "=================================================="

echo "--- qpdf ---"
qpdf --version

echo "--- ghostscript ---"
gs --version

echo "--- poppler (pdftoppm) ---"
pdftoppm -v 2>&1 | head -1

echo "--- LibreOffice ---"
soffice --version

echo "--- ocrmypdf ---"
ocrmypdf --version

echo "--- tesseract OCR languages (need ara, eng, fra) ---"
for lang in ara eng fra; do
  tesseract --list-langs 2>&1 | grep -qx "$lang"
  echo "tesseract language pack OK: $lang"
done

echo "--- Java (tabula dependency) ---"
java -version 2>&1 | head -1

echo "--- Python packages ---"
python3 - <<'PY'
# Import checks prove availability; versions via importlib.metadata because
# pdf2docx does not expose __version__.
from importlib.metadata import version
import pypdf, pdf2docx, tabula  # noqa: F401
for pkg in ("pypdf", "pdf2docx", "tabula-py"):
    print(f"{pkg} {version(pkg)}")
PY

echo ""
echo "==> All conversion engines verified. Provisioning complete."
