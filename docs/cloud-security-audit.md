# Nexus Cloud independent security review

Reviewed 2026-10-30 against the new `cloud-backup`, `cloud-discovery`, `cloud-tools`, `cloud-rclone`, `cloud-service`, renderer and controller/build integration. This review was separate from the agents implementing those components. No real game saves, production account, OAuth login or cloud upload was used.

## Findings corrected during review

| Finding | Correction verified |
| --- | --- |
| Restart reconciliation could label a corrupt recovery payload verified after reading only its manifest. | Reconciliation preserves failed integrity and uses an unchecked state for other unverified points. Explicit verification hashes payloads before recording verified integrity. The regression corrupts a payload, restarts and checks that verification is not regained. |
| Cloud provider changes could occur during a local backup that was about to upload. | The main-process service checks running operations inside its connection mutation lock. The independent test confirms connect, disconnect and provider change are rejected while a local backup is active. |
| Normal Hydra exit did not cancel the active Rclone child. | The service exposes synchronous cancellation and the controller invokes it on `will-quit`. The test verifies cancellation reaches the provider adapter without waiting for a transfer. |
| An invalid newly chosen backup folder could replace the saved path before initialization succeeded. | A candidate engine is initialized before preferences and the live engine are swapped. Invalid index regression confirms the original folder remains selected and accessible. |
| Remote catalog JSON was forwarded with unrelated properties. | Provider code now bounds catalog reads, validates keys/dates/counts and projects an explicit public schema. No credentials or raw remote extras are required by the renderer. |
| Adding a custom save folder did not immediately discover its files. | The service now scans the selected game after adding its approved path. |
| The old 16 MiB updater limit rejected the new installer containing verified tool archives. | One bounded 128 MiB constant now governs remote downloads, persisted staging and local BAT selection. The actual large installer stages successfully and survives an updater restart; an oversized sparse fixture is rejected before reading. Metadata limits remain unchanged. |
| Cloud messages were translated separately from the catalog enforced by existing localization tests. | Cloud messages now extend the existing language catalogs without replacing existing translations. The copy guard recognizes the explicitly translated Cloud button sink and product name. |
| Imported or persisted deduplication metadata could claim a different save state and suppress a later backup. | State hashes are recomputed from verified file descriptors, including legacy imports. Before deduplicating, backup checks the verified manifest's derived state hash again. An adversarial import claiming a future save hash cannot prevent that future save from being backed up. |

## Independent regression

`tests/test-cloud-security.cjs` passed on Windows using disposable fixtures. It verifies:

- traversal, absolute paths, Windows device names and alternate data stream syntax are rejected;
- executable save roots and directory junctions are rejected;
- invented restore tokens and saves changed after preview do not overwrite current data;
- recovery payload corruption is not relabeled verified on restart;
- a forged persisted point folder is replaced with the canonical owned folder;
- a linked Rclone config is rejected before the command adapter is invoked;
- connection mutations are blocked during a local backup;
- exit cancellation is synchronous;
- failed backup-folder validation preserves the prior preference and engine.
- supplied deduplication metadata cannot suppress a backup of different file content.

Directory junction creation required execution outside the restricted sandbox. A file symlink case could not be created because the Windows account lacks that privilege; the linked-config test uses a directory junction instead. No production safety check was bypassed.

The complete required `python tests/check.py` run passed: 66 named suites, including nine Cloud suites, plus source and bundled JavaScript syntax checks. Its recorded duration was 340.36 seconds. The late canonical deduplication change was additionally checked with the backup, service integration and independent security regressions; the poisoned state-hash case passed. These are fixture results and do not establish real cloud authorization or installed-application acceptance.

## Remaining acceptance boundaries

Real OneDrive and Dropbox browser authorization, token expiry/revocation, provider policy limits and network interruptions still require account testing. Mock provider responses establish application invariants, not service interoperability. Checksums detect accidental corruption; they do not authenticate a cloud account or protect against a malicious actor able to replace both a point and its checksum catalog.

Filesystem link validation is repeated around sensitive operations but is not a kernel-level guarantee against another process racing to replace paths. Interrupted restores preserve journals and safety data and block further mutations; an automatic crash-recovery interface is not implemented. Registry-only saves are outside the file backup format. Installed-application appearance and resource usage remain separate from fixture/browser checks.
