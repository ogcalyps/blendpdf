# Security Policy

## Reporting a vulnerability

Please report security issues privately, **not** as a public GitHub issue.

Use GitHub's [private vulnerability
reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository — that's the fastest route and keeps the report between us
until there's a fix.

Please include what you'd expect: what the issue is, how to reproduce it, and
what an attacker could actually do with it. A proof of concept helps a lot.

## What's in scope

This project handles user-uploaded PDFs and shells out to native binaries for
some conversions, so the areas most worth looking at are:

- **Command injection** in the `app/api/*` routes that invoke `qpdf`,
  `ghostscript`, `libreoffice`, `ocrmypdf`, or the Python converters
- **Path traversal** in temp-file handling around those conversions
- **Malicious PDF handling** — parser abuse, resource exhaustion, XXE-style
  issues in the processing pipeline
- **SSRF** in the Google Drive import path
- **Rate-limit bypass** on the server-side conversion routes

## What's out of scope

- Findings that require a compromised server or physical access
- Missing hardening headers with no demonstrated impact
- Vulnerabilities in third-party dependencies with no exploitable path here
  (report those upstream; do tell us if the path *is* exploitable here)
- Automated scanner output without a working reproduction

## No bounty

There's no money behind this — it's a solo project. Credit in the release
notes is offered if you want it, and declined gracefully if you don't.
