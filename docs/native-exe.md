# Native Windows distribution

Hydra Nexus 3.0 uses a Windows EXE, not a BAT wrapper. The installer and updater
run compiled C#/.NET Framework code with a shared WPF interface. Windows includes
the runtime on supported Windows 10/11 systems. No PowerShell executable, hosted
PowerShell engine, Node installation or network bootstrap is needed to install.
The existing Hydra/Electron process runs the installed Nexus JavaScript bridge.

## Source map

- `installer/native/Engine.cs`: bounded ASAR parser, hash-bound edits, compact
  writing, per-entry integrity, the single Electron integrity fuse change,
  verified recovery copies, exclusive-access retry and transactional rollback.
- `installer/native/Setup.cs`: setup/update UI, native caption/taskbar identity,
  English default with optional compact language selector, safe application
  discovery, operation mutex, save/exit handoff and one confirmed Hydra reopen.
- `installer/native/Utilities.cs`: hardware inventory, Steam window hiding,
  validated Ludusavi extraction and sleep. These replace runtime PowerShell calls.
- `src/native-tools.cjs`: provisions the embedded utility in the Nexus-owned
  user-data directory with pinned SHA-256 verification and no command shell.
- `src/exe-metadata.cjs`, `updater.cjs`, `update-job.cjs`: PE/metadata validation,
  GitHub release discovery, whole-binary checksums and binary-safe atomic staging.
- `installer/native/compatibility.json`: reviewed native edit recipes. This is
  public patch data, not a copy of Hydra's native source or private test fixtures.

## Build and package

On Windows with Python 3, Node and the Windows .NET Framework C# compiler:

```
python build.py --exe
python tests/check.py
python release.py
```

`build.py` first compiles the small native helper and the Nexus bridge. The legacy
BAT is a development-only intermediate used by existing transform regressions;
it is never a public 3.0 release asset or the EXE runtime engine.
`native/prepare.py` bundles that bridge, the allowlisted artwork and compatibility
data. `native/build.py` embeds them as resources in `dist/Hydra_Nexus.exe` and
appends bounded product/version/revision metadata covered by the release checksum.
`release.py` packages only the EXE, source ZIP, nine-language release-notes JSON
and checksums. It does not publish. Public workflows must remain packaging-only.

The checked-in compatibility data allows ordinary builds without PowerShell or
private Hydra fixtures. Refreshing patch recipes for a changed native UI/main
requires a developer review against the corresponding official Hydra build.
Set `HYDRA_REFRESH_COMPATIBILITY=1` and `HYDRA_NATIVE_FIXTURES` to an isolated folder
with `hydra-main.mjs` and `hydra-renderer.js`, then run the build. This explicit
development refresh uses the existing PowerShell transform compiler as a
reference; that compiler and original Hydra chunks are not embedded in the EXE.
Review and test resulting recipes before committing them. Changes to
`src/native-ui.js` or installer native hooks require refreshing the recipes too.

## Host compatibility and migration

The first native recipe set targets the reviewed official Hydra 4.3.0 native
chunks and the latest Activity preview applied to that same build. Unknown
native main/renderer hashes fail before file replacement. Other Hydra builds,
unrecognized third-party modifications and older unsupported patch combinations
must not be guessed at or overwritten. Updating official Hydra may require a
new reviewed compatibility recipe. Do not advertise universal version support.

Installation reads the current archive, removes only known retired Nexus entries,
replaces Nexus-owned assets and compacts live entries. It never broadly deletes
an AppData/profile folder. Settings, provider authorization, backup records and
game files remain outside the patched archive and are retained. A verified
recovery of both `Hydra.exe` and `app.asar` is written under
`resources/nexus-native-recovery/<operation-id>` before committing. Incomplete
operations retain their recovery. Deleting recovery is a separate reviewed task;
the initial implementation conservatively keeps it rather than guessing which
copies a user might need.

## Future EXE updates

Keep the published installer asset named **Hydra_Nexus.exe** and include its
complete-file SHA-256 in **SHA256SUMS.txt**. Use a numeric release tag (`v3.0`,
`v3.1`, etc.), matching embedded version and internal revision. The updater reads
the stable GitHub release channel and never executes a downloaded BAT.

The downloaded EXE starts with `--update <request.json>`, validates its own hash,
version, request token and parent executable, acquires the installation mutex and
acknowledges readiness. Hydra saves and drains its native data before approving
exit. The EXE waits for that exact process to exit, installs transactionally and
opens Hydra once. The updated bridge writes the startup acknowledgement; lack of
confirmation is reported, not presented as verified startup. A local file choice
still requires explicit install confirmation. SHA-256 plus official HTTPS release
origin is the current distribution trust model; no Authenticode signature is
claimed.

For each new release, retain reviewed input recipes for supported previous native
patch states. Changing version/revision does not by itself establish support for
a new Hydra native build. Run transaction, rollback, handoff and metadata tests
and affected native geometry/localization checks before packaging.

## Memory and automatic-backup feedback (revision 2)

Offline Rclone/Ludusavi archives, licenses and compressed save-location manifest
are separate binary files under the ASAR main directory. `src/cloud-resources.cjs`
reads them on demand; provisioning still verifies the pinned archive/executable
hashes. Never base64-embed large tool archives in the JavaScript factories: that
retains source strings and parsed literals even while Cloud is idle. A verified
existing Rclone executable is reused without inflating its package again.

Automatic game-exit backups report progress/results only through the native bottom
status bar. Floating progress/result notifications are for manual operations. Keep
the `automatic` filters and durable failure indicators. Cancel the closing Cloud
screen’s owned animations before removing its DOM, so animation targets do not
retain detached panels/listeners across repeated visits. This does not gate motion
on Windows/system animation preferences.

## Mixed Latest release: BAT 2.3 and EXE 3.0

The owner uses GitHub Latest v2.3 so old 2.2 clients discover a compatible BAT.
The same release carries Hydra_Nexus.exe (3.0) and
Hydra-Nexus-exe-release.json (`schema`, EXE `version`, internal EXE `revision`).
The native updater reads this bounded, same-tag manifest when present; it does
not infer the EXE version from the legacy release tag or BAT revision marker.
Keep SHA256SUMS.txt entries for BOTH installers, plus separate versioned notes
and source ZIPs. The release body revision marker belongs to BAT 2.3; EXE
revision belongs to its JSON manifest. Future EXE releases must update their
manifest version/revision consistently with the compiled EXE. Older 3.0 r2
downloads are preserved in v3.0; the primary latest EXE includes this fix. Revision 4 also removes installer implementation details from all localized release announcements.
