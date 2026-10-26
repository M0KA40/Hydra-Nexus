# Hydra Nexus development

- Keep all nine interface languages in sync: en, pt-BR, es, ru, ar, fr, de, tr, pl. Follow Hydra's selected language and preserve live changes, drafts and Arabic RTL. Read docs/localization.md before user-facing changes.
- Preserve native commands, achievements/playtime, Steam switching, transactional backups, transfer verification, update rollback and exact reversible native patches.
- Use isolated fixtures for games, saves, accounts, transfers and power actions. Never use real user data for tests.
- Run python build.py and python tests/check.py. Run affected browser suites for interface changes. Native fixture results do not imply real-application acceptance.
- Distribute only release-files.json entries. Never include local profiles, credentials, development logs, chat exports, native Hydra fixtures or unlisted files.
- A local build does not publish a release. Keep private preparation separate from repository/release assets.
