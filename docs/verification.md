# Current local repair validation

See [repair-validation.md](repair-validation.md) for revision 10. The entries below are historical and retain their original test counts; they do not describe the current candidate.

# Verification — historical evidence

## 1.2.0 revision 6 — correct active renderer selection

Owner reproduction: the Invisible Mode plugin was enabled, but its account control was absent. The revision-5 component/transaction fixtures missed that native production WindowManager loads the hosted renderer first. The patched bundled renderer therefore did not necessarily execute. Revision 6 adds a scoped, removable native loader guard selecting the bundled renderer while Nexus is installed; development and absent-Nexus behavior remain native.

A new generated-installer/VM regression test covers reachable-CDN selection, the actual route/hash, development and absent-Nexus behavior, exact removal, stable repair and unknown-loader rejection. Actual Hydra 4.2.0 main/renderer transformations passed syntax, exact cleanup and repair again, including the loader hook. The synthetic ASAR install/repair/remove cycle passed. All 23 default scripts passed on Node 24.22.1. The revision-5 five browser suites remain evidence for the unchanged UI component code; they were not repeated for this loader-only correction. No live app was installed or executed by this task. Owner confirmation after applying revision 6 is outstanding.

## Historical 1.2.0 revision 5 — native UI, Invisible Mode corrections and release notes

PASS: build and all 22 default scripts on Node 24.22.1; all five Edge suites (native React integration, eight-language/native-CSS acceptance, native clicks, release UI, idle). Privacy coverage includes separate plugin/mode state and revision-4 migration, durable pending achievements, no false upload acknowledgements, account-specific request policy, private holds after disabling, explicit resume/cancel, a 2,000-record batched-update fixture and normal-exit checkpoint recovery. This is algorithm/state verification, not RAM profiling.

Native React acceptance exercises the inspected Hydra React runtime, independent plugin/mode toggles and hiding, bright/dim icons, native commands, repeated component mounting, Steam/Notes/Mods/Backup mount events, zero body-wide observers on the native path, idle silence and safe localized release notes. Source transforms passed against private Hydra 4.2.0 main/renderer fixtures: syntax, exact cleanup and stable repair. The archive transaction test now includes a native renderer and verifies install/repair/remove with exact restored renderer bytes. No live app, account, Steam operation or save was exercised.

The restricted test environment initially denied Edge startup and temporary BAT renames; the successful final runs used an isolated writable temporary folder and approved execution. No production code was changed to bypass those environment restrictions. Full Node 22 checks were not repeated. Owner-reported revision-4 second-account presence was Offline; game notifications remain unverified. Native business logic/compatibility adapters remain; this is not an upstream Hydra source rebuild.

## Historical 1.2.0 revision 4 — Invisible Mode

21 default scripts passed on Node 24.22.1, with privacy-policy fixtures and bundled startup/RPC/state checks. Three applicable Edge suites passed: language (all eight/native CSS), release UI and idle. Actual Hydra 4.2.0 native privacy/activity transformations, capabilities, cleanup and ESM syntax passed on private read-only source fixtures. There were no live account/network/game operations. The unaffected click suite was not repeated for revision 4; no extra broad test rounds were added. See [Invisible Mode](invisible-mode.md) for persistent holds, chat impact, explicit resumption and the unverified server-side presence boundary. Console-only updater fixture executables now compile as Windows applications to avoid transient console windows; production updater behavior is unchanged.

## Historical 1.2.0 revision 3 — pre-release findings repaired

The revision-2 audit findings F1–F3 are repaired: shared Steam launch exclusion/coalescing across Play and shortcuts; structured switching progress and busy copy in all eight languages (526 catalog keys); native Classics/LaunchBox shortcut restore protection. The original forced Steam switching sequence is retained. Concurrent different requests are rejected, not queued; the exclusion is released after success or either preparation/native failure.

PASS: build plus all 20 default scripts on Node 24.22.1; all four Edge suites, with native Hydra CSS and added online/offline progress, fallback-account, live-language and escaping assertions. Isolated real-Hydra-4.2.0 archive install/repair/remove passed, including revision-2 hook migration, exactly one Steam and one Classics marker, exact native text cleanup and ESM parsing. A stubbed VM of the actual patched run handler confirmed Steam and LaunchBox restore blocking and native fallback. Tests also cover duplicate launch coalescing, competing/unbound/disabled-plugin requests, exclusion held through the native callback, retry after both failure stages, privacy and Classics passthrough. An old privacy assertion was updated to verify the new structured message payload; production privacy behavior remains tested.

Node 22 passed the preceding revision-2 audit; it was not rerun for revision 3 because the owner requested stopping additional test rounds. No live Hydra installation, authenticated Steam test, GitHub CI, commit, push or publication occurred. The prior audit report remains historical evidence for revision 2 and is superseded by these repairs.

## Historical 1.2.0 revision 2 — native shortcut repair; Nexus Shortcut removed


The owner withdrew Nexus Shortcut entirely. Its plugin/control, records implementation, CLI handler, account overrides, extra native launch capabilities and dedicated tests/docs were removed. The existing eight plugins, 524-message language catalogs/audit fixes and inherited updater repair remain.

The existing Hydra Desktop shortcut protocol bypassed the Steam IPC wrapper and called native `launchGame` directly. The installer now instruments only the `handleRunGame` launch call; both it and native Play await the same saved-binding preparation in `steam.cjs`. No links are rewritten, and previously created `hydralauncher://run` links require no recreation. Current executable/arguments and current saved account/mode are read at launch. Preserve native cloud-save gates, tracking and the original forced-switch delays; do not claim this validates the actual authenticated Steam session.

**PASS:** build, source/bundle syntax and all **20 default scripts**, including `test-native-shortcuts.cjs`. Tests cover unchanged old URLs at cold/warm entry points, awaiting preparation, latest bindings/game data, online/offline, disabled/unbound/other-store passthrough, failure/restore blocking, one native call, untouched unrelated launches, native fallback, safe unsupported-handler rejection and install/repair/remove without duplicate hooks. All four isolated Edge suites passed after removal, including eight-language live changes and idle regressions.

A private read-only extraction of Hydra 4.2.0's actual native main also accepted exactly one targeted hook, passed syntax parsing and returned byte-for-byte to the cleaned native text when the hook was removed. Existing Nexus hooks were stripped before this comparison. Native source was neither executed nor packaged. The installed application, real shortcuts, Steam accounts, games and saves were untouched. A live test after authorized installation remains outstanding.

## Historical follow-up language audit, 23 October 2026

The forthcoming combined release is **1.2.0**, as selected by the owner; the additional feature is pending specification. The local development identifier remains 1.0.2 revision 1 during this preparatory audit. The final rebuilt bundle passed source syntax and **all 19 default scripts**. All four Edge suites passed, including the expanded eight-language/layout/transaction checks and actual Notes HTML at 580px/360px. All catalogs now have **524 keys** with matching placeholders. The idle suite recorded zero repeated observer callbacks/backend requests in all 11 measured cases, including Arabic/German/English switches, and retained active polling plus its three-failure limit. `git diff --check` found no whitespace errors. No real installation, commit/push, GitHub CI or publication occurred. See [audit findings and scope](localization-audit-2026-10-23.md).

## Multilingual update, 23 October 2026

Local checks used Windows, Node.js **24.22.1** and the bundled Python **3.12.14**. The complete **19-script default suite** passed, including source/bundle syntax, all eight translation catalogs, native preference handling, backup/restore protections, generated updater startup/rollback, fuse preservation and isolated BAT install/repair/removal.

Four isolated headless Edge browser scripts passed: `test-i18n-browser.cjs`, `test-browser-clicks.cjs`, `test-release-ui.cjs` and `test-ui-idle.cjs`. The language suite covers all eight languages, 500 catalog messages with exact key/placeholder parity, Hydra-language precedence over a Japanese browser locale, English fallback, Arabic RTL, localized application errors/dialogs, live settings drafts, stable storage values, Steam selections and Notes contents/pending saves. It also passed with a read-only copy of Hydra 4.2.0's native stylesheet. Arabic and German fixture layouts were inspected and the language fixture had no horizontal overflow at the tested viewport.

The existing UI regression suites retain first-click Steam/Notes behavior, native navigation and menus, actual Notes HTML design/edit/read, and zero repeated idle backend requests/observer callbacks across the measured views. Native preference broadcasts also localize main-process dialogs when the main window is absent. A late initial preference read cannot replace a newer language event.

The source carries the previously unpublished updater startup repair. Local rollback testing also exposed that unavailable WMI could throw a terminating exception during optional stale-worker discovery; that optional discovery is now guarded, and the real generated-worker rollback/startup tests passed. Tests use fake executables, archives and accounts. No real Hydra installation, Steam switch, game launch, user save restore or Google cloud upload was performed for this update. Full live-session memory use was not profiled. Node.js 22/GitHub CI and publication were not run for this candidate.

The standalone command-line installer and diagnostic/operating-system output retain their technical language. Publisher requirements, upstream release notes, user data and native Hydra copy are not machine-translated.

## Historical verification — 1.0.1

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
