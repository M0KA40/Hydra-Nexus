# Nexus Cloud Rclone integration (2.3.2 draft)

`src/cloud-rclone.cjs` runs only in Electron's main process. It supports one remote named `nexus`, with backend `onedrive` or `dropbox`. Provider replacement requires confirmation and an idle backend. Disconnect removes only the owned local credentials/configuration; it never deletes or migrates remote recovery points or local backups.

## Engine distribution

Pinned engine: **Rclone 1.75.2, Windows x64**. Source: <https://downloads.rclone.org/v1.75.2/rclone-v1.75.2-windows-amd64.zip>.

- Archive SHA-256: `8a9db2bad1dc79a65b3348fd857069598e2aab7cf4d118b77b1df23055aff818`.
- Extracted `rclone.exe` SHA-256: `41eab3e118d264920b62c3327966c5ece0dc4dd715ee617d9e30450d8ead95a4`.
- Build embeds the verified archive through `__NEXUS_RCLONE_ZIP__`. Source runs can use `tools/rclone/package.zip`. Optional HTTPS download uses that exact version and pinned hashes, never `current` or a self-update command.
- Provisioning extracts exactly one fixed executable entry to the owned Nexus Cloud data directory. Both archive and executable hashes are checked, and the executable is rehashed before every subprocess. Invalid/missing engines fail closed. Windows ARM64/32-bit builds are not included in this draft.
- `tools/rclone/LICENSE.txt` contains upstream's MIT license from tag `v1.75.2`. The original distribution archive is retained so a source build can reproduce the embedded bytes.

## Authentication and secrets

The current official [OneDrive](https://rclone.org/onedrive/) and [Dropbox](https://rclone.org/dropbox/) instructions allow the default Rclone OAuth client; no developer client ID/secret or provider sync client is supplied by Nexus. Browser authentication is initiated by the verified Rclone process. No command shell, public remote-control server, token-paste UI or secret-bearing renderer response is used.

Rclone's [noninteractive configuration protocol](https://rclone.org/commands/rclone_config_create/) is driven by the main process. A single available OneDrive drive is selected automatically; multiple drives appear as a bounded choice. Unsupported account setup states fail explicitly, rather than claiming connection. `connected` is saved only after actual remote listing succeeds. Reconnecting a saved connection starts in `reconnect`, not a fabricated successful state. Expired/revoked token diagnostics are converted to a generic reconnect state, without logging raw Rclone output.

The config is initialized **encrypted before OAuth**. A random 48-byte password is supplied to the encryption command through private stdin, and stored only as Electron `safeStorage` ciphertext. Rclone's config password is passed only in the child's environment on later operations. Existing `RCLONE_*` environment overrides are removed. Config refreshes stay encrypted. If safeStorage is unavailable, the integration refuses to connect; there is no plaintext fallback. Secret material is never returned in snapshots, command arguments or diagnostic logs. Config and engine paths reject symlinks/junction ancestors. Same-user administrative malware and filesystem races by another process are outside this module's protection.

## Recovery-point transport

Remote layout is `NexusCloud/v1/points/<UUID>/{manifest.json,COMPLETE,data/00000000,...}` and `NexusCloud/v1/catalog/<UUID>.json`.

Upload verifies the immutable local point first, copies only manifest-approved paths, then performs `rclone check --download --one-way` to read back and compare remote data. A small immutable catalog commit is published and read back last. An interrupted point without that catalog record is invisible to the cloud library. Upload failures preserve the local point. Listing discovers committed backups without requiring local save files or Hydra library entries.

**Native verification found that Rclone 1.75.2 single-file `copyto`/`copy` did not enforce the expected immutable guard in the local fixture.** Production uses directory-source `copy` with one exact `--include`, `--immutable` and `--checksum`. The real executable test confirms it refuses changed destinations and retains existing bytes. No `sync`, `move`, `delete`, `purge`, `mount` or `rcd` command is exposed.

Download uses a fresh owned staging directory and only numbered payload paths from a validated manifest. The manifest must match its COMPLETE hash and the committed catalog hash. Every payload size and SHA-256 is verified before the service imports it into the backup engine. Remote save destinations are never trusted for restore. Failed/partial staging remains unimported; retry uses a new staging path. One process operation runs at a time; provider change is rejected while busy. Cancellation kills the active child; automatic bounded retry is performed inside each copy command. Progress totals aggregate completed files and the current file rather than resetting to each file's size.

Each catalog response is capped at 64 KiB of actual subprocess output regardless of listing metadata. Only a fixed field projection reaches the public snapshot. Game keys, dates, nonnegative safe integer counts/sizes and hash syntax are validated; titles are capped at 4096 characters. Unknown remote object properties are discarded. Invalid catalog refreshes preserve the previous complete catalog rather than replacing it with a partial result.

Catalog records and hashes provide integrity checks and detect accidental corruption; they are not signatures against an attacker controlling the entire remote account. Cloud content is not encrypted by this integration beyond provider transport/storage protections. Rclone config encryption protects OAuth credentials, not recovery payloads.

## Public main-process API

`createCloudProvider({directory,safeStorage,changed?,fetcher?,executable?})` returns `initialize()/init()`, `snapshot()`, `provision()`, `connect(provider)`, `answerConnection(value)`, `disconnect({confirmed:true})`, `changeProvider(provider,{confirmed:true})`, `uploadPoint({id,directory})`, `downloadPoint({id,directory})`, `list()`, `health()`, `cancel(id?)`, `retry(id)`, and `busy()`.

`connect` provisions the engine automatically if necessary. Transfers await completion and return `{id,pointId,state,directory}`. Snapshot transfer IDs are distinct from point UUIDs. `retry` of a download returns a new staging directory, which the service must import using the returned `directory`.

## Verification and remaining limits

- `node tests/test-cloud-rclone.cjs`: isolated simulated provider tests cover one provider, encryption plumbing, drive choice, catalog commits, transfers, corruption, progress, cancellation, retry, provider-switch guards, locked credential store, and executable tampering. Simulated OAuth is not a real successful connection.
- `node tests/test-cloud-rclone-native.cjs`: actual pinned executable on synthetic local data verifies encrypted initialization, noninteractive config JSON, directory-scoped immutable protection, readback checks and corruption refusal. OAuth probe stops before account/browser authorization. No real saves or accounts are used.
- Real OneDrive and Dropbox OAuth, refresh-token expiry, account quota, institutional consent rules and internet-disconnection behavior still need opt-in account testing. No connection or real cloud upload is claimed as tested. Account email/name is not fabricated (`account:null`); `health()` obtains actual usage where supported.
- First-party shared OAuth clients can be throttled, blocked by organizational policy, or changed by providers. Such errors must remain failures; no developer credentials are silently substituted.

## Revision 2 — authorization cancellation

A cancellable connection attempt spans provisioning/config preparation, OAuth and pending OneDrive drive selection. Cancellation waits for the main-process child/attempt to settle before discarding incomplete credentials/provider state. The Cloud service uses a cancellation barrier so another provider cannot start while the previous attempt is cleaning up. The renderer has an explicit authorization Cancel action and also cancels when leaving the Cloud page. Tests cancel during config preparation, in-flight OAuth and drive selection, then connect Dropbox without restarting. These use simulated providers; actual account authorization remains outside fixture acceptance.

## Revision 3 — saved connection validation

When Cloud is enabled, the first initialized/open snapshot with saved provider metadata starts one asynchronous health check. A checking status is shown while the stored encrypted configuration is validated by Rclone; this never starts config create/OAuth. The check is coalesced and does not run on every snapshot. Disabled Cloud does not perform this remote check. Network failures retain credentials and show offline; explicit retry remains available. Authentication/key/engine failures show reconnect/attention. The list probe is bounded to 15 seconds and optional quota lookup to 8 seconds. This fixes the prior unconditional reconnect presentation on restart; real provider account validation is still a separate acceptance step.
