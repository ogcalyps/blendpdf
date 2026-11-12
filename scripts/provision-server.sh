#!/usr/bin/env bash
#
# provision-server.sh — Idempotent provisioning of the BlendPDF conversion stack
# on an Ubuntu EC2 host.
#
# Installs the Node.js runtime the app runs on:
#   - nodejs 22.x     (NodeSource apt repo; skipped when v22 is already installed)
#
# and every binary the conversion API routes shell out to:
#   - qpdf            (unlock/repair/protect PDFs)
#   - ghostscript     (compression)
#   - poppler-utils   (pdftoppm rendering)
#   - libreoffice     (word-to-pdf, pdf-to-word fallback)
#   - ocrmypdf + tesseract-ocr (+ara/+fra/+spa packs)  (ocr-pdf; eng ships with tesseract-ocr)
#   - default-jre     (required by tabula-py for pdf-to-excel, and by veraPDF)
#   - veraPDF         (/opt/verapdf; pdf-to-pdfa's PDF/A check — official installer,
#                      pinned + checksummed, since Ubuntu doesn't package it)
#   - MS-compatible + Arabic fonts (LibreOffice layout fidelity)
#   - Python packages: pypdf, pdf2docx (pdf-to-word), tabula-py + openpyxl (pdf-to-excel;
#     openpyxl is the .xlsx writer pandas uses — tabula imports fine without it)
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

# NodeSource's setup script points /etc/apt/sources.list.d/nodesource.list at
# node_${NODE_MAJOR}.x (replacing an older major's line) and installs the repo
# key, so the apt install below upgrades an older Node in place.
NODE_MAJOR=22
if [ "$(node -v 2>/dev/null | cut -d. -f1)" = "v${NODE_MAJOR}" ]; then
  echo "==> Node.js $(node -v) already installed."
else
  echo "==> Installing Node.js ${NODE_MAJOR}.x from NodeSource..."
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl
  NODESOURCE_SETUP="$(mktemp)"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" -o "$NODESOURCE_SETUP"
  sudo -E bash "$NODESOURCE_SETUP"
  rm -f "$NODESOURCE_SETUP"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  if command -v pm2 >/dev/null 2>&1; then
    echo "==> pm2 still runs the app on the old Node. Run 'pm2 update' to restart it on $(node -v)."
  fi
fi

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
  tesseract-ocr-spa \
  python3-pip \
  unzip \
  default-jre \
  fonts-crosextra-carlito \
  fonts-crosextra-caladea \
  fonts-noto-core \
  fonts-kacst

echo "==> Installing Python packages (pypdf, pdf2docx, tabula-py, openpyxl)..."
# Ubuntu 23.04+ marks the system Python as externally managed (PEP 668);
# fall back to --break-system-packages there.
PIP_PACKAGES=(pypdf pdf2docx tabula-py openpyxl)
if ! python3 -m pip install --upgrade "${PIP_PACKAGES[@]}"; then
  echo "==> pip refused (externally-managed environment); retrying with --break-system-packages..."
  python3 -m pip install --break-system-packages --upgrade "${PIP_PACKAGES[@]}"
fi

# veraPDF: the validator /api/pdf-to-pdfa runs on every file it makes. Root
# installs it read-only; the app (another user) only executes it.
VERAPDF_VERSION=1.30.4
VERAPDF_SHA256=04415ef3f149526a3048b9889723e81320ddf013bd891bcc7f0f297f3eadcc23
if /opt/verapdf/verapdf --version 2>/dev/null | grep -q "veraPDF ${VERAPDF_VERSION}"; then
  echo "==> veraPDF ${VERAPDF_VERSION} already installed"
else
  echo "==> Installing veraPDF ${VERAPDF_VERSION} into /opt/verapdf..."
  VERAPDF_TMP=$(mktemp -d)
  curl -fsSL -o "$VERAPDF_TMP/verapdf.zip" \
    "https://software.verapdf.org/releases/${VERAPDF_VERSION%.*}/verapdf-greenfield-${VERAPDF_VERSION}-installer.zip"
  echo "${VERAPDF_SHA256}  $VERAPDF_TMP/verapdf.zip" | sha256sum -c -
  unzip -q "$VERAPDF_TMP/verapdf.zip" -d "$VERAPDF_TMP"
  sudo java -DINSTALL_PATH=/opt/verapdf \
    -jar "$VERAPDF_TMP/verapdf-greenfield-${VERAPDF_VERSION}/verapdf-izpack-installer-${VERAPDF_VERSION}.jar" -options-system
  sudo chmod -R go-w /opt/verapdf
  rm -rf "$VERAPDF_TMP"
fi

echo ""
echo "=================================================="
echo "==> Verification (a failure here means a tool is missing)"
echo "=================================================="

echo "--- Node.js (need v${NODE_MAJOR}) ---"
node -v
node -v | grep -q "^v${NODE_MAJOR}\."

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

echo "--- tesseract OCR languages (need ara, eng, fra, spa) ---"
for lang in ara eng fra spa; do
  tesseract --list-langs 2>&1 | grep -qx "$lang"
  echo "tesseract language pack OK: $lang"
done

echo "--- Java (tabula + veraPDF dependency) ---"
java -version 2>&1 | head -1

echo "--- veraPDF (need ${VERAPDF_VERSION}) ---"
JAVA_OPTS=-Xmx448m /opt/verapdf/verapdf --version | head -1
/opt/verapdf/verapdf --version | grep -q "veraPDF ${VERAPDF_VERSION}"

echo "--- Python packages ---"
python3 - <<'PY'
# Import checks prove availability; versions via importlib.metadata because
# pdf2docx does not expose __version__.
from importlib.metadata import version
import pypdf, pdf2docx, tabula, openpyxl  # noqa: F401
for pkg in ("pypdf", "pdf2docx", "tabula-py", "openpyxl"):
    print(f"{pkg} {version(pkg)}")
PY

echo ""
echo "==> All conversion engines verified. Provisioning complete."
