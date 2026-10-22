# Contributing

For a bug, use the issue template and include a short reproduction. For a code change, describe the behavior being fixed and the checks you ran. Keep application text in English and reuse Hydra's native control styles.

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

Update the version in `src/brand.cjs` and write English notes in `docs/releases/<version>.md`. A main-branch commit with the message prefix `Release Hydra Nexus ` runs the checked release workflow. Ordinary commits only run verification. A maintainer can also dispatch Release with `confirm` set to `publish`. The workflow refuses to replace an existing release and marks a successful new release as latest.
