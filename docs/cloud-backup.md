# Nexus Cloud backup engine (local 2.3.2 draft)

`src/cloud-backup.cjs` exports `createBackupEngine({directory,isRunning,scan,notify,protectedPaths,roots})`. Initialize before use. The index and immutable recovery points are separate; completed points are rediscovered if the index commit was interrupted. `snapshot()` returns games, recovery points, bounded activity, operation and recovery warnings. Games with historical points stay visible when saves disappear. Failed scans are distinct from successful scans with no files.

## Operations and safety

- `addPaths(game, paths)` registers existing user-selected files/folders. `scan(games)` combines those paths with preview discovery. It checks real files; empty folders cannot create backups. `backup(key,{reason})` rejects running games, streams hashes, checks source stability, verifies copied bytes, and publishes a completed point by renaming a private staging folder. Unchanged content reuses a verified existing point.
- `verify(id)` verifies the manifest and every payload with SHA-256. Point format is `NexusCloudPoint` v1 with `manifest.json`, `COMPLETE` (SHA-256 of the exact manifest bytes), and `data/00000000` payload files. Manifests contain logical root IDs and relative paths, never source-device absolute restore paths. These checks detect corruption, not malicious modification by an attacker who can rewrite the point and its hashes.
- `previewRestore(id,{targets})` verifies and returns a one-use five-minute token with affected files. `restore(token)` checks the running game and current file hashes again, creates an unpruned safety point, stages verified replacements, and records a journal before replacing files. Ordinary failures roll back; original files stay available if rollback fails. Pending/unreadable restore journals detected at startup block all further save mutations and remain for manual recovery. Automatic crash rollback is intentionally not claimed.
- Cross-device restore requires explicit local target mappings for unknown root IDs: `targets[rootId]=absoluteDirectory`. Imported paths never become authority for writes. Known local roots are the only automatic targets. Symbolic links, path traversal, alternate streams, drive/profile roots, application/backup paths and executable/startup files are rejected.
- `exportPoint(id,folder)` creates a separately verified point folder. `importPoint(folder)` verifies before publishing and never restores automatically. No ZIP extraction is used. Import also accepts the old `HydraBackupGame` v2 folder format, verifies every original payload, and converts save/achievement-source files into a new point. Old source folders remain unchanged. Legacy Hydra account/achievement database metadata is not imported or written to live accounts; it remains in the original legacy point. New-device target mapping is required for legacy roots.
- `prune(key,{keep})` previews candidates; deletion requires `confirm:true`. Safety points are excluded. No automatic old backup deletion occurs.

## Ludusavi

`src/cloud-tools.cjs` exports `createBundledLudusaviScanner({directory})`. It provisions a bundled, hash-pinned Windows x64 Ludusavi 0.31.0 archive; extraction accepts exactly the known executable entry. Its binary hash is checked before invocation. The isolated config disables cloud synchronization, release checks, and implicit manifest updates. Discovery uses `backup --preview --api --no-cloud-sync` with explicit game names and no shell; unrecognized manifest titles are excluded. Only file-based saves are imported; registry-only saves are not supported. No GUI/CLI setup is required from the user. No real game scan was performed during development.

Sources checked 2026-10-30:

- Release: https://github.com/mtkennerly/ludusavi/releases/tag/v0.31.0
- CLI flags: https://github.com/mtkennerly/ludusavi/blob/master/docs/cli.md
- Save manifest pinned at https://github.com/mtkennerly/ludusavi-manifest/tree/2c2109c6d4329ca8f369b96033af74b77928cf28
- Archive SHA-256: `f47a8ad8c708f01d2eb124704973beffab205e292f5287a10fc4a101f8d68706`
- Executable SHA-256: `5192fd1ef31b5718cdb787d3f41abdcca8682ba4cbad31812d44ca6630ec2c0c`
- Uncompressed manifest SHA-256: `45488b9318674e4c657069cfe9ba6e58c27ac4bf5f7a85f9bd4f0479045a711f`

The manifest and binary are pinned, so games added upstream later require a deliberate manifest refresh in a later build. Ludusavi's default user-folder discovery does not replace local validation. Exact-title matching may miss library names differing from the manifest; custom save paths are the fallback. The helper has a source-tree asset fallback and bundled base64 placeholders for release builds. Manifest bytes are gzip-compressed in distribution. License and third-party legal archive are retained under `tools/ludusavi`.

## Reuse and tests

The old 2.1.0 preview engine and DriveFolderSync were read only. Reused design principles: verified `COMPLETE` commit markers, reject links and protected locations, source-stability checks, explicit pre-restore safety points, transaction journals and isolated Ludusavi previews. The old Google Drive folder synchronization implementation is not used.

`node tests/test-cloud-backup.cjs` covers real/empty files, missing-local historical points, corrupted payloads, deduplication, running-game guards, one-use confirmation, save changes after preview, rollback after a mid-commit failure, recovery blockers, new-device mapping, legacy import and traversal rejection using synthetic data. `node tests/test-cloud-ludusavi.cjs` validates official binary/manifest hashes and invokes the real pinned executable only against a synthetic custom game in an isolated manifest/config. Both passed on Windows. Windows atomic replacement required running the fixture test outside the sandbox; production safety checks were not weakened.

## Revision 2 — native local achievement files

The main-process host supplies Hydra's `collectGameAchievementFiles` results (including supported local Steam cache files) as exact file paths alongside Ludusavi saves. Both kinds are SHA-256 verified and stored in the same immutable recovery point, then restored by the same preview/safety-point/rollback transaction. No account database snapshot or cloud achievement unlocking is performed. Unsupported or absent local achievement sources are reported as zero rather than fabricated.

The optional `includeUninstalled` preference defaults to false and expands discovery to retained/deleted game records. Installation probes run during explicit scans or backup, with bounded asynchronous concurrency; they do not run during page renders. Achievement-only points are supported. Turning discovery off retains all previous recovery-point history. `test-cloud-game-files.cjs` verifies both-file restoration, removed-game discovery, achievement-only backup and history retention using synthetic data.

## Revision 4 source eligibility

Native achievement collection uses includeSteamCache:false. Steam librarycache JSON may exist for games never played and is not sufficient evidence of locally restorable progress. Defense in depth excludes these known metadata paths from discovery/automatic roots/collection and corrects old cache-only index rows without deleting any file or recovery point. The Cloud service requires native library membership plus detected actual sources for a new candidate. Existing backup history can still be restored after a game leaves the library. tests/test-cloud-source-eligibility.cjs covers upgrade correction, ignored cache metadata, real save-only/achievement-only sources and retained history, using synthetic files only.

## Revision 5 — portable locations and recovery wizard

New NexusCloudPoint v1 manifests optionally include validated `locations` records: root ID, save/achievement kind, file/folder flag, original absolute path, recognized portable base and safe relative path. Older v1 points remain readable. Locations travel with the manifest and its COMPLETE hash; previous points are never rewritten. A new backup upgrades unchanged data to a new point when the earlier point did not preserve locations. Portable mapping recognizes current LocalAppData, Roaming AppData, Documents, Saved Games, home and an explicitly known game installation root. Directory creation happens only after confirmed preview; actual destination files still pass linked-path, protected-directory, executable/startup and concurrent-change guards. A safe child of Local is no longer rejected merely because its parent also contains protected Nexus data.

After confirmed restoration, selected mappings are persisted in the local game index. Original paths remain in the point. Missing bases show original save and achievement paths separately, with an in-place native destination picker. Older points with neither metadata nor local roots display an honest unavailable-location message rather than inventing a path. Auto detection of an arbitrary moved external folder is not claimed.

Cloud recovery always resolves the real committed catalog, lists one latest point per game (or the explicitly chosen older point), downloads and verifies selected points, then builds an explicit review. No save files change during download or planning. A one-use expiring batch confirmation authorizes sequential per-game transactions. Destination hashes are compared again before each transaction; overlapping destinations block review, changed saves fail safely, and partial results remain visible. Stop during restore finishes the current game and skips pending games. Original cloud points are never deleted. No cross-game all-or-nothing rollback or automatic resume after a process/system crash is claimed; existing interrupted-restore guards remain.

The primary Restore from cloud entry opens the wizard directly. Manage is a name/cover disclosure with basic actions and recovery points first, and technical controls grouped in Advanced options. The interface and release notes follow all nine languages. All native geometry, original state, motion independence and image quality rules remain.
