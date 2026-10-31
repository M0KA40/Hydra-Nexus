
- Owner Arabic scope rule (2026-10-31): preserve existing Arabic support, but do not audit, test, correct or report Arabic/RTL unless explicitly requested. This overrides Arabic-specific review requirements elsewhere.
# Hydra Nexus development

- Version 3.0 distribution is native EXE only. Read `docs/native-exe.md` before installer/updater work. Use `python build.py --exe`; never revive the BAT wrapper or a PowerShell runtime. `installer/native/compatibility.json` is reviewed, hash-bound patch data; refresh it when changing native renderer/main hooks and verify against the supported official Hydra build. Published assets must keep `Hydra_Nexus.exe` and matching `SHA256SUMS.txt` names for future updates.
- Keep delivered `Release/` artifacts immutable. Make a new uniquely named candidate after any further code change. No public upload or publication until the owner explicitly authorizes it.

- Owner workflow priority (2026-10-31): English is the primary language for Play Activity design, implementation and visual review. Establish the English art direction and interactions first. Review the other supported languages, including Arabic/RTL and long translations, after the main design and interaction work is complete and before delivery. Do not make Arabic the starting point or central design constraint. Preserve all existing language support; this changes work order, not the final localization requirements. This is an owner-selected priority, not a measured usage statistic.

- Mandatory page layout rule: read `docs/page-layout.md` before any page change. Inherit native Settings/header/content dimensions and theme spacing. Compare actual geometry at 1200×860, 1024×600, 1280×720 and 1920×1080, all nine languages/RTL and representative themes. No fixed full-page desktop caps or zeroing native margins. Preserve and extend the Backup/statistics geometry regressions.

- Keep all nine interface languages in sync: en, pt-BR, es, ru, ar, fr, de, tr, pl. Follow Hydra's selected language and preserve live changes, drafts and Arabic RTL. Read docs/localization.md before user-facing changes.
- Preserve native commands, achievements/playtime, Steam switching, transactional backups, transfer verification, update rollback and exact reversible native patches.
- Use isolated fixtures for games, saves, accounts, transfers and power actions. Never use real user data for tests.
- Run python build.py and python tests/check.py. Run affected browser suites for interface changes. Native fixture results do not imply real-application acceptance.
- Distribute only release-files.json entries. Never include local profiles, credentials, development logs, chat exports, native Hydra fixtures or unlisted files.
- A local build does not publish a release. Keep private preparation separate from repository/release assets.

- Owner animation rule (2026-10-27): Nexus animations must run independently of Windows animation/accessibility animation switches. Do not gate custom UI motion on Windows ClientAreaAnimation or system motion preferences. Preserve explicit Nexus user controls where provided.

- Mandatory owner design reference: read `docs/design-quality.md` before any Nexus interface change. Deliver professional visual hierarchy, responsive theme-native geometry and deliberate smooth motion. Preference saves must preserve unrelated control DOM, focus, drafts and scroll; no full-surface refresh for a toggle.
