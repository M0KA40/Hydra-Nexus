# Verification — Hydra Nexus 1.0.0

The release was checked on Windows against Hydra 4.2.0. Source checks are included in the repository and run in CI. Native application tests use an isolated profile and hidden windows.

## Completed

- Backup: per-game layout, changed-only snapshots, local achievements, safety copies, restore rollback, live-game guards, damaged settings preservation, integrity failures, traversal rejection and Drive desktop ZIP integrity, duplicate detection, cancellation cleanup, disconnected-folder handling and persistent retry limits.
- Notes: Unicode text, per-game separation, concurrent storage writes, export/restore, relocation, safety copies and legacy attachments. A rapid-edit test confirms that closing waits for the newest pending save.
- PC Compatibility: real publisher requirements for Control and Control Resonant, automatic supported CPU/GPU/RAM assessment, below-minimum and unknown results, laptop/desktop variant separation and benchmark source identity checks.
- Nexus Mods: edition normalization, distinct sequel identity, ambiguous-match fallback, API-key validation, invalid replacement-key rejection and basic links when the online catalogue fails.
- Tabs/UI: thirteen interaction scenarios using native Hydra CSS, including a non-library catalogue card and restoration of query, sort and scroll. Steam save success/error waits for a backend response. A separate Backup UI suite covers 38 assertions.
- Lifecycle: the native WindowManager duplicate-window race was reproduced and serialized. Parallel resource wake requests share one navigation. Pending dialogs and backup jobs block suspension.
- Native Electron: PNG decoding, actual MP4 playback through Hydra's local protocol, sandboxed Notes persistence/close/reopen, Always on top, Windows hardware scan and hidden-interface unload/restore. The small fixture's whole-app working set measured 427 MB before and 396 MB asleep; this does not predict normal-session savings.
- Installer: PowerShell parsing and isolated native-archive install, repair and removal, with one adaptive loader and no GameShift payload.
- Updater: checksum/version/origin rejection, cancellation, persisted staging after restart, pending notification delivery after suspension and opt-out. The generated PowerShell worker installed the real BAT into an isolated archive and reached one reopen sentinel.
- Distribution: source package paths, internal documentation links, release checksums and removal of the OAuth/API uploader and build-time credentials, and exclusion of private account data.

## Scope

These checks do not certify every game, theme, codec or hardware model. No real Steam account switch or game launch was performed. Drive tests create real ZIPs and copy them to an isolated folder; the user's Google account and cloud sync completion were not used or verified. Google Drive performs the cloud upload independently. PC comparisons have limited benchmark coverage. Detailed play history begins with tracking; existing totals cannot reconstruct older sessions.

## Desktop Drive checks in 1.0.0

- Existing OAuth tokens are removed locally; no authorization server, Google API endpoint or client configuration remains in the runtime.
- The folder must exist, be separate from protected application/backup/save paths and contain no linked path components. A disconnected drive is never recreated as a normal local folder.
- ZIPs are copied through unique partial files, checked by SHA-256 and renamed only after completion. Duplicate verified copies are skipped. Cancellation cleans partial and temporary files.
- Automatic failures stop at three, with at least five minutes between attempts. The limit survives a new runtime instance. Manual success or an explicit reset allows future attempts. Disconnecting keeps exported archives.
- Backup and copy operations exclude one another. The copy lock is acquired before recovery points are enumerated.

## Update checks

The bundled runtime test simulates a newer GitHub release, verifies an Update/Later event inside Hydra, restores a deferred event after interface suspension and verifies persisted opt-out. Updater failure tests reject changed hashes, wrong versions and unexpected origins before confirmation. The actual generated PowerShell helper installs this release's BAT into an isolated native archive and reaches one reopen sentinel. UI checks cover an absent install button when no update is available, an enabled action for a newer release and dismissing Later without downloading.
