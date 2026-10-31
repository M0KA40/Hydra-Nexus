# Legacy compatibility scope

- This is the owner-authorized BAT 2.3 compatibility branch based on 2.2; native EXE-only work belongs to main/3.0. Do not import new Cloud or Activity features here.
- Preserve optional Arabic support; do not audit or test Arabic/RTL unless explicitly requested.

# Hydra Nexus development

- Mandatory page layout rule: read `docs/page-layout.md` before any page change. Inherit native Settings/header/content dimensions and theme spacing. Compare actual geometry at 1200×860, 1024×600, 1280×720 and 1920×1080, all nine languages/RTL and representative themes. No fixed full-page desktop caps or zeroing native margins. Preserve and extend the Backup/statistics geometry regressions.

- Keep all nine interface languages in sync: en, pt-BR, es, ru, ar, fr, de, tr, pl. Follow Hydra's selected language and preserve live changes, drafts and Arabic RTL. Read docs/localization.md before user-facing changes.
- Preserve native commands, achievements/playtime, Steam switching, transactional backups, transfer verification, update rollback and exact reversible native patches.
- Use isolated fixtures for games, saves, accounts, transfers and power actions. Never use real user data for tests.
- Run python build.py and python tests/check.py. Run affected browser suites for interface changes. Native fixture results do not imply real-application acceptance.
- Distribute only release-files.json entries. Never include local profiles, credentials, development logs, chat exports, native Hydra fixtures or unlisted files.
- A local build does not publish a release. Keep private preparation separate from repository/release assets.

- Owner animation rule (2026-10-27): Nexus animations must run independently of Windows animation/accessibility animation switches. Do not gate custom UI motion on Windows ClientAreaAnimation or system motion preferences. Preserve explicit Nexus user controls where provided.

- Mandatory owner design reference: read `docs/design-quality.md` before any Nexus interface change. Deliver professional visual hierarchy, responsive theme-native geometry and deliberate smooth motion. Preference saves must preserve unrelated control DOM, focus, drafts and scroll; no full-surface refresh for a toggle.
