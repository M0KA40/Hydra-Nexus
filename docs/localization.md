# Localization maintenance

Nexus follows Hydra's selected language through `src/i18n.cjs`. Keep all nine catalogs in `src/locales` aligned: en, pt-BR, es, ru, ar, fr, de, tr and pl. Use the existing translation helpers and preserve live language changes, RTL, drafts, focus and scroll. Do not replace unrelated controls to save a preference.

Release announcements use `src/release-content.cjs` and the exact matching files in `docs/releases/<version>/<language>.md`. The version and revision must match `src/brand.cjs`. `tests/test-release-localization.cjs` checks these copies, offline notes and updater fallback behavior.

Native geometry is authoritative; follow `page-layout.md` and `design-quality.md`. Fixture screenshots are not acceptance in an installed Hydra session.
