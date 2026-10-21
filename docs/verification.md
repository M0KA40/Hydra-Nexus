# Verification — Hydra Nexus 2.0.0

The release was checked on Windows against Hydra 4.2.0. Source checks are included in the repository and run in CI. Native application tests use an isolated profile and hidden windows.

## Completed

- Backup: per-game layout, changed-only snapshots, local achievements, safety copies, restore rollback, live-game guards, damaged settings preservation, integrity failures, traversal rejection and multi-chunk upload acknowledgements.
- Notes: Unicode text, per-game separation, concurrent storage writes, export/restore, relocation, safety copies and legacy attachments. A rapid-edit test confirms that closing waits for the newest pending save.
- PC Compatibility: real publisher requirements for Control and Control Resonant, automatic supported CPU/GPU/RAM assessment, below-minimum and unknown results, laptop/desktop variant separation and benchmark source identity checks.
- Nexus Mods: edition normalization, distinct sequel identity, ambiguous-match fallback, API-key validation, invalid replacement-key rejection and basic links when the online catalogue fails.
- Tabs/UI: twelve interaction scenarios using native Hydra CSS, including a non-library catalogue card and restoration of query, sort and scroll. Steam save success/error waits for a backend response. A separate Backup UI suite covers 38 assertions.
- Lifecycle: the native WindowManager duplicate-window race was reproduced and serialized. Parallel resource wake requests share one navigation. Pending dialogs and backup jobs block suspension.
- Native Electron: PNG decoding, actual MP4 playback through Hydra's local protocol, sandboxed Notes persistence/close/reopen, Always on top, Windows hardware scan and hidden-interface unload/restore. The small fixture's whole-app working set measured 427 MB before and 396 MB asleep; this does not predict normal-session savings.
- Installer: PowerShell parsing and isolated native-archive install, repair and removal, with one adaptive loader and no GameShift payload.
- Updater: checksum/version/origin rejection, cancellation, persisted staging after restart, pending notification delivery after suspension and opt-out. The generated PowerShell worker installed the real BAT into an isolated archive and reached one reopen sentinel.
- Distribution: source package paths, internal documentation links, release checksums and exclusion of supplied Google client secrets and private account data.

## Scope

These checks do not certify every game, theme, codec or hardware model. No real Steam account switch, game launch or live Google Drive upload was performed as part of this release audit. PC comparisons have limited benchmark coverage. Detailed play history begins with tracking; existing totals cannot reconstruct older sessions.
