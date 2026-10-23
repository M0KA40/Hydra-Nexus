# Hydra Nexus development rules

## Interface languages — required for every feature and fix

- Support English (`en`), Brazilian Portuguese (`pt-BR`), Spanish (`es`), Russian (`ru`), Arabic (`ar`), French (`fr`), German (`de`) and Turkish (`tr`). New features and changes to user-facing copy must include all eight translations in the same change.
- Follow the language selected in **Hydra**, including live changes. Unsupported languages fall back to English. Never select the language from Windows, the browser locale or geolocation. Do not add a separate Nexus language preference unless the owner requests one.
- Read `docs/localization.md` before changing interface copy. Use `src/i18n.cjs` and the eight `src/locales/*.cjs` catalogs. English messages are keys; preserve named placeholders and translate complete sentences instead of concatenating translated fragments.
- Use `tr()` for text and `ht()` for translated text inside generated HTML. Escape variable values. Use `localizedDialog()` for native dialogs and `msg()` only for application messages. Do not translate game titles, account/display names, filenames, paths, Notes contents, links, stored enums, IPC identifiers or publisher content.
- Scope Arabic RTL to Nexus-owned surfaces; keep code/path fields readable and preserve native Hydra commands, form drafts, pending Notes writes and saved values when changing language.
- Run `python build.py` and `python tests/check.py`. For interface changes, run the isolated browser suites, including `tests/test-i18n-browser.cjs`, using the dependencies documented in `docs/localization.md`. Catalog parity, placeholders and UI-copy checks must pass. Do not claim real Hydra verification from fixture results.

## Existing behavior and release discipline

- Preserve unrelated local changes. The updater repair started before the multilingual update and must remain included.
- Preserve native achievements/playtime, native commands and menus, the original requested Steam switching workflow, transactional backups and updater rollback protections.
- Low Resource Mode controls visual effects. Do not reintroduce the removed tray-memory/window-retirement feature.
- Do not test with real Steam account switches, game processes or user saves. Use isolated fixtures.
- Creating a build does not publish a release. Publishing, replacing GitHub assets or installing into the live application requires current user authorization. Record the actual release status precisely.
- If a local handoff reference is supplied by the owner, update it after completed changes with the exact version/revision, changes, tests, outstanding work, artifact locations and whether anything was committed, pushed or published. Never include the private handoff or recovery data in distributable sources.
