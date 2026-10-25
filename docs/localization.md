# Interface localization

Nexus follows Hydra's selected interface language. Supported languages are **English, Português (Brasil), Español, Русский, العربية, Français, Deutsch, Türkçe and Polski**. Regional tags are normalized (for example `ar-SA`, `es-419`, `fr-CA` `pt_BR` and `pl-PL`). Portuguese variants use the Brazilian Portuguese catalog. Unsupported languages and missing individual messages fall back to English.

## Runtime behavior

`src/i18n.cjs` supplies the main-process and sandboxed-renderer translator. The renderer reads Hydra's `document.documentElement.lang` and native preference events. Hydra synchronizes that attribute with its own translation instance. Nexus does not change Hydra's language or document direction, and does not use `navigator.language`. A small observer watches only the native language attribute; there is no translation scan of the DOM and no new polling interval.

The main process reads the native preferences through the existing database capability and observes `on-user-preferences-updated`, including broadcasts when the native main window is absent. The independent Notes window receives language changes without replacing the editor or losing pending edits. Nexus surfaces set their own `lang` and `dir`, so an unsupported RTL Hydra language can correctly display English Nexus controls from left to right.

The catalogs are bundled with the BAT. No translation service, API key, network request or additional installation is needed. Game names, account names, user Notes, paths, stored values and publisher requirements are preserved. Publisher requirements and upstream release notes remain in their original language. The standalone command-line installer, diagnostic logs and low-level operating-system errors retain their technical language; normal Nexus controls, help, status messages and native application dialogs are localized.

## Adding or changing copy

1. Use an English message as the key in **all nine** `src/locales/*.cjs` files. Files must be UTF-8. Names such as Hydra Nexus, Steam and Nexus Mods retain their brand spelling.
2. Use named placeholders in complete sentences: `tr('Version {version} is available', {version})`. Do not assemble sentences from translated prefixes/suffixes. Number placeholders use the selected locale; counts can use neutral labels to avoid incorrect plural grammar.
3. Use `ht(key, values)` when inserting translated text into HTML. It escapes both the translation and inserted values. For a native dialog, use `localizedDialog()` and translate composed text before adding user paths or game names. Keep button order and confirmation defaults unchanged.
4. Translate application response/error messages at the display boundary with `msg()`. Keep stored identifiers and backend transactions independent of language. Never send user Notes or private account information to a translation service.
5. Preserve form values, selections, focus and pending saves on a live language change. Arabic needs RTL on each owned surface; code, hardware names and paths must remain readable. Test longer German/Russian text as well as Arabic.

`tests/test-i18n.cjs` checks exact catalog parity, nonempty UTF-8 values, placeholder parity, aliases/fallbacks, escaping, native dialogs, preference races and unlocalized UI literals. The normal source check recursively parses every locale module. These checks are mandatory for future tools too.

## Verification

```powershell
python build.py
python tests/check.py
$env:HYDRA_PLAYWRIGHT_PATH='path/to/bundled/node_modules/playwright'
$env:HYDRA_BROWSER_EXE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
node tests/test-i18n-browser.cjs
node tests/test-browser-clicks.cjs
node tests/test-release-ui.cjs
node tests/test-ui-idle.cjs
```

Browser tests use isolated synthetic profiles and mocked native adapters. They cover every language, English fallback with a Japanese browser locale, live RTL changes, settings drafts, stable storage enums, Steam selections and Notes content/saves. They do not operate the installed Hydra, Steam accounts or game saves. A restricted Windows temporary folder may prevent browser startup or BAT renames; use an isolated writable temporary directory for the test process. A sandboxed Edge launch can also require an approved execution outside the sandbox.

### Keeping live surfaces consistent

Retain application status keys or structured progress events and translate at the display boundary. Do not retain already-translated strings: these cannot follow a subsequent language change. `setStatus`, Steam toasts, Backup toasts and the hardware status helpers intentionally accept original application messages and translate internally. Catalog checks also validate their literal keys. Never reverse-translate user text.

Language changes must preserve in-flight operations and disabled controls. In particular, update the existing per-game Backup section rather than replacing it during a pending backup/import. Steam repaint preserves focus, selection, scroll, status and pending confirmation without requesting account data again. PC comparison repaint uses its existing result rather than issuing another request. Both main and renderer preference startup reads must yield to newer preference events, even if the event repeats the current English fallback.

The expanded acceptance suite checks 1280px and 1000px main windows, the actual Notes HTML at 580px and its minimum 360px width, native menus, pending game-backup and Steam saves, status changes, comparison caching and preference races. The idle suite also checks Arabic/German/English switches. See [the language audit](localization-audit-2026-10-23.md) for scope and known limits.
