# Contributing

Thanks for looking. It's a small project and PRs are welcome.

## Where help is most useful

1. **Arabic and RTL correctness.** If you read Arabic and a string sounds
   translated, uses the wrong register, or renders with broken shaping or
   word order, that's a bug. File it even without a patch. A screenshot and
   what it should say is enough.
2. **PDFs the editor gets wrong.** If a line of your PDF can't be edited, or
   the saved line looks or searches wrong, an issue with the file (or a
   description of how it was made: which app, which font) helps more than
   anything else. The fixtures in `tests/fixtures/edit-pdf/` came from cases
   like that.
3. **Moving server tools to the browser.** Images to PDF and form filling run
   on the server but only use pdf-lib. Moving them client-side removes an
   upload.
4. **Other languages.** Persian, Urdu and Hebrew have no UI translation yet.
   See "Languages" in the README.
5. **Bug fixes** with a test that fails before and passes after.

## Ground rules

- Use Node 22 (`.nvmrc`) and `npm ci`.
- Run the gates before opening a PR. CI runs the same two, plus `npm audit`:
  ```bash
  npx tsc --noEmit
  npm test
  ```
- `npm run lint` reports a large backlog of old errors. It has never been
  enforced, so don't worry about unrelated ones, but don't add new ones in
  the files you touch:
  ```bash
  npx eslint <the files you changed>
  ```
  Cutting the backlog down is a useful contribution on its own.
- One concern per PR.
- Match the code around you. There is no separate style guide. Most modules
  open with a comment that explains their decisions; keep it true when you
  change the code.
- New UI strings go into every file in `messages/` (en, fr, es, ar). If you
  can't write one of the translations, add the English and say so in the PR.
- Tests live in `tests/` (Vitest). Anything that touches the editor, dates,
  page ranges or form filling needs one. For the editor, a real PDF fixture
  beats a generated one: pdf-lib can't write shaped Arabic, so Arabic fixtures
  are printed from HTML with Chrome.

## A note on content

The UI copy, FAQ answers, guides and comparison pages are under a separate
licence ([CONTENT-LICENSE](CONTENT-LICENSE)); the code is AGPL-3.0. That doesn't
get in the way of contributing: by opening a PR you offer your change under
the same terms as the files you touched. The split exists to stop wholesale
copying of the site, nothing else.

## Reporting bugs

Say which tool, which language (en, fr, es or ar), which browser, and attach the
PDF if you can share it. If you can't, its page count, whether it is scanned,
and the app that made it usually get us there.

Security issues: see [SECURITY.md](SECURITY.md), not a public issue.
