# Security Policy

## Reporting a vulnerability

Please report security issues privately, **not** as a public GitHub issue.

Use GitHub's [private vulnerability
reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository. It keeps the report between us until there is a fix.

Say what the issue is, how to reproduce it, and what an attacker could do
with it. A proof of concept helps a lot.

## What's in scope

The site takes uploaded PDFs and shells out to native programs for some
tools, so these are the areas most worth a look:

- **Command injection** in the `app/api/*` routes that run qpdf,
  Ghostscript, LibreOffice, ocrmypdf, veraPDF or the Python converters
- **Path traversal** in temporary-file handling around those runs
- **Malicious PDFs**: parser abuse and resource exhaustion, on the server and
  in the browser editor (pdf.js, pdf-lib, PDFium)
- **Abuse of the email route** (`/api/send-file-email`) to send mail to
  people who didn't ask for it
- **The back office** under `/admin`: its code isn't in this repository, but
  reports about it are welcome the same way
- **Rate-limit bypass** on the server routes and the analytics endpoint
  (`/api/ev`)

## What's out of scope

- Findings that need a compromised server or physical access
- Missing hardening headers with no demonstrated impact
- Vulnerabilities in dependencies with no exploitable path here (report those
  upstream, but do tell us if the path is exploitable here)
- Scanner output without a working reproduction

## No bounty

There's no money behind this, it's a solo project. Credit in the release
notes is yours if you want it.
