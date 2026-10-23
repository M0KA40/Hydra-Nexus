# Localization audit — 23 October 2026

The owner selected **1.2.0** for the forthcoming combined update: localization, the inherited in-app updater repair and a further feature whose specification is pending. This audit precedes that feature. The source/build identifier remains the unpublished 1.0.2 revision-1 development baseline until the combined release is prepared. No 1.0.2 release is intended or certified by this audit.

## Findings repaired

- Notes, Steam, Backup and hardware status could remain in the previous language. Retain original application messages/structured events and translate when displayed, including visible toasts, scan/model status and pending saves. A browser regression reproduced Portuguese Notes status remaining after an English switch before the fix.
- A delayed renderer startup preference read could overwrite a newer native event when `html.lang` was absent. Track preference revisions, including a repeated English fallback event.
- Steam language repaint moved focus to Close and queried accounts again. Preserve focus/scroll/selections and pending confirmation; reuse account data.
- Language changes replaced the game-options Backup section during a pending operation, recreating enabled controls and detaching the status. Update its copy in place, retain the active operation and keep its controls disabled until completion.
- A PC comparison language change repeated its backend lookup. Repaint the existing comparison instead; localize storage values and numeric displays.
- Existing injected native-menu entries and the tabs accessibility label could keep their old language. Refresh owned copy while preserving native commands.
- Add 24 previously uncovered application warnings/errors to all eight catalogs: save-file races, restore guards, archive conflicts, unsafe paths, damaged/unsupported backups, metadata limits, missing Ludusavi configuration and online-service errors. Total: **524 keys per catalog**, with identical placeholders. Technical low-level diagnostics remain unchanged.
- Format Backup byte values, retention labels, play-history day counts and benchmark values with the selected locale. Retention storage values remain numeric identifiers.

## Verification scope

The default suite checks source and bundled syntax plus 19 regression scripts. Browser acceptance uses isolated profiles, mocked native adapters, a Japanese browser locale and a read-only copy of Hydra 4.2.0's real stylesheet. It covers all eight languages, fallback/RTL, settings/Plugins/Themes/Updater/Backup/Drive/Steam/Notes, 1280px and 1000px main windows, actual Notes HTML at 580px and minimum 360px, focus/caret, form values, untranslated user content, native menu retention, pending Steam saves, pending game-options backups, cached comparisons and startup preference races. The idle suite checks that Arabic/German/English switches settle without repeated DOM callbacks or backend requests, while active work retains its bounded polling.

**Passed:** final rebuilt source/bundle syntax and all 19 default scripts, all four browser suites, 524-key/placeholder parity and `git diff --check`. All 11 idle cases settled with zero repeated observer callbacks/backend requests; active polling and its three-failure stop also passed. Arabic/German Plugins and actual Notes screenshots were visually inspected. Core catalog/message-path tests verify that Unicode paths and application placeholders remain intact. Detailed logs are retained privately in the current handoff and user-facing audit report.

These are isolated regression checks, not certification of the owner's live Hydra session, every third-party theme or a full-session RAM profile. Human native-speaker review of every phrase was not performed. No real installation, game launch, Steam switch, user-save modification, Git commit/push, tag or publication is part of this audit. A real corrected in-app update remains a separate end-to-end test.
