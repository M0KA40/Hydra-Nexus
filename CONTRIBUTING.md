# Contributing

For a bug, use the issue template and include a short reproduction. For a code change, describe the behavior being fixed and the checks you ran. Keep application text in English and reuse Hydra's native control styles.

## Layout

- `src/`: bundled runtime, UI adapters and game tools.
- `installer/`: self-contained BAT/PowerShell installer base.
- `assets/`: project branding, service icon and screenshots.
- `tests/`: storage, requirements, resource lifecycle, updater and Backup checks.
- `docs/`: setup, features, privacy, troubleshooting and verification.
- `build.py`: standard-library-only Python builder. Output is written to `dist/`.

Run `python build.py` and `python tests/check.py` before submitting. The Windows installer and actual Electron integration also require local checks against Hydra; see the verification record. Do not commit generated test folders, OAuth client secrets, tokens, account bindings, notes or game saves.

Source and CI builds omit the optional Google client configuration unless one is supplied explicitly. The distributed release embeds only the public Desktop client ID.
