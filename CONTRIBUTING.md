# Contributing

For a bug, use the issue template and include a short reproduction. For a code change, describe the behavior being fixed and the checks you ran. Reuse Hydra's native control styles. All new or changed interface copy must ship in the nine supported languages; read [localization](docs/localization.md) and `AGENTS.md` before adding a feature.

## Layout

- `src/`: bundled runtime, UI adapters and game tools.
- `installer/`: self-contained BAT/PowerShell installer base.
- `assets/`: project branding, service icon and screenshots.
- `tests/`: storage, requirements, idle UI behavior, updater and Backup checks.
- `docs/`: setup, features, privacy, troubleshooting and verification.
- `build.py`: standard-library-only Python builder. Output is written to `dist/`.

Run `python build.py` and `python tests/check.py` before submitting. The Windows installer and actual Electron integration also require local checks against Hydra; see the verification record. Do not commit generated test folders, OAuth client secrets, tokens, account bindings, notes or game saves.

Google Drive integration uses a folder managed by Drive for desktop. Source and distributed builds contain no Google OAuth client configuration.

## Publishing

Update the version in `src/brand.cjs` and write English notes in `docs/releases/<version>.md`. Ordinary commits run verification. A main-branch commit whose message is exactly `Release Hydra Nexus 2.0` runs the checked release workflow; the separate Verify job is skipped to avoid repeating the same checks. Maintainers can also dispatch Release manually with `confirm` set to `publish`. Keep all nine translations in `src/release-content.cjs` and `docs/releases/<version>/` in sync with the exact version and revision. The workflow refuses to replace an existing release and marks a successful new release as latest.
