> Historical revision-10 validation. The current 1.2.01 experimental theme candidate is documented in [theme-compatibility.md](theme-compatibility.md).

# Revision 10 — completed isolated repair validation

Status: local repair candidate, **1.2.0 revision 10**. Not committed, pushed, published or installed into live Hydra. The inspected baseline is 1.2.0 revision 9 at commit `1ba22d7814e31365a8202f5d85a61de25380b604`.

## Verified results

- All **32 default scripts** passed on Node **24.22.1** in the isolated source copy. These comprise the original 27 scripts and five added repair suites; source and bundled JavaScript syntax checks also passed.
- All **32 default scripts** passed on Node **22.23.4** from an independently extracted source package. That package rebuilt the exact installer and bridge bytes. Its installer test used a synthetic native fixture, proving that private audit inputs are not needed by the distributed test suite.
- All **seven browser suites** passed in isolated headless Edge/Playwright profiles: localization, clicks, release UI, idle behavior, native UI, update confirmation and repair acceptance. The native UI suite used local Hydra React/CSS fixtures; no live Hydra session was started.
- All **15 targeted regression cases** failed against the preserved baseline and passed against the candidate. Baseline failures are intentional reproduction evidence, not candidate failures.
- Each of eight UTF-8 catalogs contains **569 messages**, with matching placeholders and English fallback. The package retains nine plugins.
- Packaging canaries `.env`, private handoff and local log were excluded. The source ZIP contains exactly **135 allowed files**, passes CRC verification and includes its manifest, runtime and reproducible tests. Native Hydra fixtures, local audit reports, test outputs and handoffs are excluded.

## Repair coverage

The repairs cover integration privacy gates and persistent per-store holds; complete/partial backup retention; damaged backup verification; damaged history and Steam binding preservation; update reservations, cancellation and deadlines; final running-game validation; durable approval revocation; relaunch-failure rollback; ASAR compaction; complete installation status; accurate per-game results and tracked long operations; explicit source packaging; confirmed recovery retention; single mouse/keyboard activation; and current installer/documentation identity.

Complete recovery points and partial recovery points have separate retention quotas, each using the configured keepVersions. Failed discovery never spends the complete quota. Partial points are labelled and excluded from the normal latest-complete selection.

The update reservation covers native mutation/launch routes and new backup work. Prepare, final flush, close, approval and failure-recovery waits have deadlines. A timed-out native close remains reserved until safe reopening finishes. Failed or unresolved reopening/revocation remains reserved instead of pretending that a second update is safe; restart/recovery may be required in that exceptional state. No attempt forcibly terminates hung native I/O.

Installer acceptance includes ten consecutive repairs without ASAR growth, exact normalized main/renderer cleanup on removal, preservation of ordinary/empty/unpacked/link metadata, four separately corrupted installation components reporting Partial, and current installation.json metadata. Actual relaunch rejection in an isolated PowerShell worker restored the previous archive and attempted the restored launch once.

Recovery cleanup confirms the exact startup identity/version/revision only after successful Nexus initialization, keeps at least two confirmed successful jobs and verifies a retained rollback before pruning older confirmed jobs. Failed, unresolved, legacy-unconfirmed or foreign-content jobs stay preserved. Such protected jobs can still consume space and need manual review.

## Scope and limits

All authored files, fixtures, logs, builds, temporary profiles and repair work are under the owner-requested Desktop repair folder. Original source, the original entry folder, installed Hydra, real Steam accounts, Notes and game saves were not modified. Correct side-folder handoff shortcuts replace the broken entry experience within the permitted scope; the old external shortcut is deliberately unchanged.

Tests cover source, bundled adapters, generated installers, real Windows worker processes, native-code transformations and isolated browser behavior. They do not establish live server-side visibility, notification behavior, hardware-specific stability or a guarantee against every future Hydra change. No real Steam account switch, game process, user-save restore or live application installation was performed. No RAM/CPU reduction percentage is claimed.

## Reproduce

Run `python build.py` and `python tests/check.py` from a source checkout with Node 22 or 24. The seven browser scripts additionally need Playwright and a browser as described in localization.md. `tests/test-repair-installer.cjs` accepts optional HYDRA_NATIVE_FIXTURES; without those private inputs it uses an isolated synthetic fixture.

The private Desktop handoff supplies PowerShell runners, complete logs, baseline comparisons, an Arabic report, source diffs and candidate artifacts. Those private files are not part of this source distribution.
