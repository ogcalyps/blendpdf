# Contributing

Thanks for looking. This is a small project and PRs are genuinely welcome.

## Where help is most useful

1. **Arabic and RTL correctness.** This is the highest-value area by far. If
   you read Arabic natively and a string reads awkwardly, uses the wrong
   register, or renders with broken shaping or bidi ordering — that's a bug.
   File it even without a patch; a screenshot and a description of what it
   *should* say is plenty.
2. **Other RTL languages.** Hebrew, Persian, and Urdu are structurally
   supported but have no translations. See "Adding a language" in the README.
3. **Tools that only work server-side but shouldn't.** If something currently
   shells out to a binary but could run in the browser with `pdf-lib`, moving
   it client-side is a real win — it removes an upload.
4. **Bug fixes** with a failing test that turns green.

## Ground rules

- Run the gates before opening a PR:
  ```bash
  npx tsc --noEmit && npm test
  ```
  These two are what CI enforces, and both must pass.
- **`npm run lint` currently reports ~2,000 pre-existing errors.** Lint has
  never been enforced on this codebase, so don't be alarmed, and don't feel
  obliged to fix unrelated ones. Just don't add new errors in files you touch:
  ```bash
  npx eslint <the files you changed>
  ```
  Reducing that backlog is a genuinely welcome contribution on its own.
- Keep PRs focused. One concern per PR is much easier to review.
- Match the surrounding code. There's no separate style guide — the existing
  files are the spec.
- **New user-facing strings must be added to both `messages/en.json` and
  `messages/ar.json`.** If you can't write the Arabic, add the English key and
  say so in the PR; leaving it out entirely means it renders as a raw key.
- Tests go in `tests/` using Vitest. Anything touching date handling, page
  ranges, or form filling should have one.

## A note on content

The UI copy, FAQ answers, and marketing prose are under a restrictive license
(see [CONTENT-LICENSE](CONTENT-LICENSE)) while the code is MIT. This does not
restrict contributions — by opening a PR you're offering your changes under the
same terms as the files you touched. It exists to stop wholesale content
scraping, not to complicate contributing.

## Reporting bugs

Include the tool, the locale (`en` or `ar`), your browser, and the PDF if you
can share it. If you can't share the file, its page count and whether it's
scanned or digital-native is usually enough to reproduce.

For security issues, see [SECURITY.md](SECURITY.md) — don't open a public issue.
