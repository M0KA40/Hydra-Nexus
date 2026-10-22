# Memory and repeated-work review — Hydra Nexus 1.0.1

The experimental tray-memory plugin and its interface suspension, destruction and restoration code were removed. Eight plugins remain. Native Hydra hide/close behavior owns the window lifecycle; Low Resource Mode only controls visual effects. Existing settings are preserved, with retired plugin fields removed from the active schema on startup.

## Confirmed Nexus issues

- **Steam badge redraw loop:** generated self-closing SVG markup was compared to the browser's normalized innerHTML. They differed even when the button label was unchanged, causing repeated replacement. The reproduction measured 11 replacements in 2.2 seconds at idle. Comparing the last generated markup reduced this to zero. This was avoidable allocation and observer work; it does not establish that this loop alone caused a 1 GB session.
- **Idle Backup checks:** the previous interval woke every 1.5 seconds even without work. Polling now starts only for active operations and stops at idle. Three consecutive status-request failures pause automatic polling, with increasing delay. Progress events and a manual request remain available; Drive's independent copy retry policy is unchanged.

All four injected DOM observers were monitored after settling on game, catalogue, library, native settings, plugins, updater and backup pages. They produced zero idle callbacks and zero repeated backend requests in each measured interval. Active Backup status polling, return to idle and the three-failure stop were also checked. Game-page activity refresh every 30 seconds while visible and update checks every six hours are intentional; they remain bounded and shared requests are deduplicated.

## Read-only live process snapshot

The running Hydra session showed approximately 315 MB working set in the main process, 355 MB in the GPU process and 398 MB in one renderer; two further renderers showed about 116 MB and 180 MB. These values include shared pages and must not be summed as unique memory. The snapshot identifies process-level consumers, not the object or texture responsible for every allocation.

The installed main entry also contains a roughly 1.2 MB embedded-video injection added before Nexus. Nexus had no custom background configured in the inspected settings. Therefore an active Nexus custom-video layer was not the explanation for that particular snapshot. Native video decoding, artwork, blurred composition and additional native renderer windows can consume memory outside Nexus's JavaScript heap; the exact live contribution of each was not measured.

## Controlled Electron comparison

Separate processes used the same Electron build, native Hydra CSS, synthetic 500-game markup and 30 route changes. The native scenario loads this fixture without Nexus, not the entire logged-in Hydra application. No game was launched, no account was switched and the real application was not restarted or modified.

| Scenario | Sum of process working sets after navigation | Renderer JS heap |
| --- | ---: | ---: |
| native | 347.0 MB | 0.86 MB |
| installed | 369.4 MB | 1.89 MB |
| candidate | 356.8 MB | 1.70 MB |
| native-video | 393.9 MB | 0.96 MB |

These sums are comparable fixture observations and include shared memory; they are not Task Manager's unique-memory total or a promise for real libraries. A single pass cannot estimate variance. The 1 GB live behavior was not reproduced. The candidate's incremental cost in this fixture was small compared with the live renderer/GPU working sets, so the audit does not support attributing the entire live increase to Nexus.

After 30 routes, diagnostic garbage collection returned the candidate's listener count from 66 to its initial 36; renderer JS heap returned to about 1.2 MB. This distinguishes transient navigation garbage from retained growth in this short fixture. The product does not force collection or impose memory limits. Longer real sessions and the full native UI may behave differently.

## Validation and scope

All 17 remaining default regression scripts passed, including isolated installer/update transactions. Three browser suites passed: first-click Steam/Notes and manual scan edits; Backup/Updater navigation and eight-plugin settings; idle observers, active status polling and bounded failure handling. The previous forced Steam workflow and Hydra's achievement watcher/presenter were not changed by this removal. Background game-event delivery remains connected when the native main window is absent.

This candidate is local only. No real installation, Git commit, push or release was performed.
