# Verification — Hydra Nexus 1.0.1

The current audit uses Windows, Node.js 24.19.0 and Python 3.12.14. Tests use synthetic files, mocked adapters and an isolated headless browser. No real Steam accounts, installed games or user saves were changed. Node.js 22 and remote GitHub CI have not been run in this audit. The repository's CI configuration targets Node.js 22.

The earlier Hydra 4.2.0 native checks below describe prior verification; they were not all repeated in the final independent audit. Their measurements are historical fixture results, not a current memory-use promise.

## Completed

- Backup: per-game layout, changed-only snapshots, local achievements, safety copies, restore rollback, live-game guards, damaged settings preservation, integrity failures, traversal rejection and Drive desktop ZIP integrity, duplicate detection, cancellation cleanup, disconnected-folder handling and persistent retry limits.
- Notes: Unicode text, per-game separation, concurrent storage writes, export/restore, relocation, safety copies and legacy attachments. A rapid-edit test confirms that closing waits for the newest pending save.
- PC Compatibility: real publisher requirements for Control and Control Resonant, automatic supported CPU/GPU/RAM assessment, below-minimum and unknown results, laptop/desktop variant separation and benchmark source identity checks.
- Nexus Mods: edition normalization, distinct sequel identity, ambiguous-match fallback, API-key validation, invalid replacement-key rejection and basic links when the online catalogue fails.
- Tabs/UI: thirteen interaction scenarios using native Hydra CSS, including a non-library catalogue card and restoration of query, sort and scroll. Steam save success/error waits for a backend response. A separate Backup UI suite covers 38 assertions.
- Lifecycle: the native WindowManager duplicate-window race was reproduced and serialized.
- Native Electron: PNG decoding, actual MP4 playback through Hydra's local protocol, sandboxed Notes persistence/close/reopen, Always on top, Windows hardware scan and Windows lifecycle behavior.
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

## 1.0.1 regression checks

The source and bundled runtime regression suites cover:

- Steam: brace/escape-aware VDF parsing, targeted account rewrite, the real `openGame` IPC path, privacy-safe launch notices and immediate binding-save failure handling.
- Backup: snapshot-cache reuse and invalidation after new versions, verified restore-target metadata, ZIP-import temporary cleanup after a cancelled restore, external restore destination rejection, executable/Nexus protection, scoped retention and restore cleanup.
- Updater: stale staged BAT and PowerShell helper cleanup while preserving the currently verified update, plus checksum, version and download-origin rejection.
- Interface: contract checks for the five reported fixes and isolated Chromium checks against native Hydra CSS for settings drafts, stale compatibility results, a pending Update click, per-action busy labels and dialog focus containment.
- Build and release: `build.py` rejects bundled modules that reference an unpackaged relative module; `.github/workflows/release.yml` publishes only a main-branch commit whose message starts with `Release Hydra Nexus `, or a manual dispatch with `confirm == 'publish'`. Ordinary main-branch pushes do not publish a release.
- Runtime: idle-history writes, archived-session totals, Notes quit flushing, simultaneous Steam saves with bounded asynchronous commands and lightweight game-page history responses.

## Independent audit, 22 October 2026

An installation attempt after the initial audit exposed a wrong fuse-version assumption: the helper and its synthetic fixture used 0; Electron V1 uses numeric byte 1. A read-only inspection of the installed Hydra confirmed version 1 with nine fuses. The helper and fixture were corrected. A dedicated regression now accepts the observed layout, checks every modified byte and idempotent repair, and rejects version 0, unknown/ASCII versions, truncated layouts and unavailable integrity fuses without writes. The earlier audit's passing synthetic tests did not establish real installation compatibility. The pre-correction BAT/report/manifest were preserved as local audit evidence. See the [official implementation](https://github.com/electron/fuses/blob/main/src/index.ts) and [V1 definition](https://github.com/electron/fuses/blob/main/src/config.ts).

The current source was backed up separately before editing. The original pre-fix archive and the timestamped audit baseline were preserved and hashed. Local audit manifests, command logs and the detailed report are kept outside the distributable source package.

Additional regressions exercise:

- The final user-requested legacy Steam workflow is exercised through the actual IPC wrapper with fake process commands: forced exit/restart, exact account binding, online/offline, custom executable, standalone passthrough, recovery copy and write failures. The previous graceful/session coordinator and its tests are archived outside the distributable; that behavior is superseded. No real Steam or game process was terminated.
- Failed and concurrent Notes writes, exact serialized size accounting, and exporting the latest debounced renderer edit.
- The actual generated PowerShell updater restoring original archive/executable bytes after failed verification, retaining recovery copies and preserving a fresh running helper.
- The actual BAT's install, repair and removal against a generated ASAR. A separate C# fixture verifies that only fuse 4 changes and original fuse bytes can be restored.
- Private theme hosts, nested untrusted imports and redirects rejected before use, using mocked HTTP responses.
- Changed snapshot completion markers, verified restore metadata, conservative empty-partial cleanup and retention of interrupted recovery journals.
- Large existing activity histories compacted at startup, exact archived totals, bounded archive-failure backlog and negative hardware-rating cache eviction.
- Steam and Notes activation during a deliberately simulated native action-bar redraw: both fail on the preserved baseline and work after the fix. Keyboard activation and preservation of manual edits during a hardware scan are checked in headless Edge with Playwright.

An isolated benchmark of the actual backup-list formatter used 1,500 games and 20,000 snapshots. Median time over three measured runs changed from 100.16 ms to 2.65 ms, with identical output. This measures that function only; live Hydra RAM, CPU, GPU and Low Resource Mode savings were not measured in this audit.

The first baseline run stopped because Windows PowerShell could not autoload `Compress-Archive`. The test fixture now uses .NET ZipFile, matching production ZIP creation, with integrity assertions retained. A later updater fixture incorrectly supplied a revision mismatch to checksum tests; it was corrected to use the BAT's actual revision. The same-version update test uses local revision 1 and remote revision 2. Revision 0 is rejected, rather than being used to force a passing test.

Crash recovery is deliberately conservative: completed journals move to recovery history, but unfinished journals, nonempty partial snapshots and previous-file copies remain available. Automatic crash recovery does not overwrite a user's possibly newer save. Restore through a verified BeforeRestore recovery point after checking the affected files. Application rollback covers installer, verification and reopen errors; it cannot detect every crash after a successful launch. The patch must disable embedded archive integrity to modify Hydra; archive-only loading is retained. These checks are regression evidence, not a security certification of Hydra or third-party content.


## Memory and repeated-work review, 23 October 2026

The experimental main-interface suspension/retirement plugin, resource module, restoration hooks, UI snapshot API and feature-only tests were removed at the user's request. Eight plugins remain. Low Resource Mode only pauses background visual effects. Saved unknown plugin preferences are dropped from the active schema and cleaned on next startup. Native hide/close behavior and achievement processing are unchanged.

A Steam badge SVG was compared to serialized innerHTML; HTML normalization made the strings differ on every observer callback. This recreated the badge contents about five times per second. A browser reproduction measured 11 child-list replacements in 2.2 seconds before the fix and zero afterwards. The badge now retains the last generated markup instead of comparing differently serialized SVG.

Backup status checks are scheduled only while work is active, rather than waking every 1.5 seconds while idle. Automatic status-poll failures stop after three attempts, with increasing delay; progress events or a manual refresh can resume observation. Cloud-copy retry limits are unchanged.

An isolated seven-view browser audit checks all four injected observers and backend requests after settling, plus active Backup polling and return to idle. Separate Electron processes compare no Nexus, installed Nexus and the new candidate with identical synthetic 500-game markup and native Hydra CSS, followed by 30 route changes. A fourth scenario measures the old embedded theme video, which predates Nexus. These isolate incremental overhead; they do not reproduce a full logged-in Hydra session or certify the reason for every live allocation. Detailed local results are excluded from the distribution source ZIP.
