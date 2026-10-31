# Nexus Cloud interface

The Cloud renderer is installed by `cloud-ui.js` after the existing Nexus UI and receives data only through the trusted main-process Cloud service. It does not read tokens, run shell commands, create save directories or fabricate cloud statistics.

## Views and behavior

- Overview follows the supplied information hierarchy: real metrics, one connected provider, four most recently backed-up games, a transfer summary, quick preferences and recent activity.
- Backup Library contains detected saves, retained local/cloud history and failed scans. Search, sorting and the local/cloud/both/attention/detected filters operate on snapshots; the DOM is paged in groups of 30.
- Game details show recovery points, sizes, integrity state and the real actions for backup, verification, upload, download, export, adding a native-selected save folder and applying retention after confirmation.
- Restore shows the main-process preview and affected destination files, then submits its token with explicit confirmation. Choosing another restore location opens the backend's native destination selector. Downloading a cloud-only point and restoring it remain distinct actions.
- The provider card supports OneDrive drive selection, reconnect, explicit disconnection/provider change and diagnostic errors. It hides unavailable account/quota values instead of inventing them.
- Transfer progress uses actual bytes where available and an indeterminate progress indicator for operations without measured totals. Terminal provider states do not retain cancel controls. The service's `canCancel` and `canRetry` flags govern local operations.

Cloud settings update owned DOM in place, preserving unrelated nodes, focus, selection, scroll and search drafts. Polling occurs only while an action/provider/transfer is active, stops while hidden and stops on close; returning to the window refreshes the snapshot. Native route/sidebar navigation restores the original header/content nodes and their exact prior display declarations.

## Theme and localization

The page clones the native Hydra header/content frame and uses the native Settings wrappers. It does not set outer viewport dimensions, reset theme margins or impose a desktop width cap. Inner cards use responsive container queries and the native palette/control helpers. CSS is scoped to Cloud-owned nodes. Two temporary invisible native button probes resolve settled semantic foreground colors, preventing animated background transitions from leaving stale low-contrast text after live language changes. The probes are removed synchronously. Dialog animation is a brief opacity/transform transition independent of Windows animation switches.

`cloud-locales.cjs` supplies matching English, Brazilian Portuguese, Spanish, Russian, Arabic, French, German, Turkish and Polish messages. Language selection follows the existing `__nexusI18n` instance, including live changes and Arabic RTL. Native Cloud folder-selector titles are translated by the main process using the same catalog. Account names, paths, game titles and provider drive names remain user/provider content and are escaped rather than translated.

## Regression verification

`tests/test-cloud-ui-browser.cjs` runs only synthetic libraries, saves and cloud sessions against the retained native Hydra CSS fixture. It compares actual native header/content left/width/header-to-content gap for all five views at 1200×860, 1024×600, 1280×720 and 1920×1080 in all nine languages and ten theme profiles (the eight existing profiles plus real Nexus Quiet and Mint styles): 1,800 comparisons. It also checks settled control contrast of at least 4.5:1, full available panel width, overflow, four-game overview limit, paged large libraries, persistent control DOM/focus/selection, restore preview-token confirmation, pending drive selection, custom-folder game selection, truthful asynchronous failure details, cancellation capability, idle request silence, worst-case long/RTL/cloud-only rows and exact native restoration.

Screenshots from synthetic fixtures are written to the directory specified by `HYDRA_CLOUD_PREVIEW`. Fixture passes and screenshots do not establish acceptance in an installed Hydra session or successful real OneDrive/Dropbox OAuth.

## Build contract

The build replaces the unquoted `__NEXUS_CLOUD_LOCALES__` placeholder with the serialized catalog and the quoted `'__NEXUS_CLOUD_CSS__'` placeholder with a JSON-escaped CSS string. Bundle the exported installer function and invoke it after `installNexusUI`. The renderer calls `cloudSnapshot`, Cloud preference/backup/transfer/provider actions and explicit native picker actions; authorization and irreversible-operation safeguards remain in the main process.

## Revision 2 — native plugin lifecycle

Nexus Cloud is now a standard disabled-by-default plugin in native Nexus settings. The controller plugin flag is authoritative; toggling it does not rewrite unrelated Cloud preferences. The Cloud sidebar entry is removed when disabled. Opening the page clears other native active selections while preserving/restoring their original state. A scoped sidebar class observer handles native selection recommits without repeatedly writing unchanged classes. The full-page Close control has been removed. Leaving a pending authorization cancels it; Cancel remains inside the provider authorization flow.

Cloud settings include a translated, default-off option for uninstalled games with actual local saves or achievement files. File lists as well as game lists are paged in groups of 30. Native plugin labels, descriptions, guide and new preferences follow all nine existing catalogs.

## Revision 3 — Vault interface and game controls

Cloud remains an owned internal Hydra page using cloned native header/content geometry. Its Back to Hydra action restores original nodes, selection and focus. There are no changes to Play Activity. The hero illustration is bundled WebP (93,740 bytes), with no third-party runtime font/icon/CDN dependency. The artwork and directional gradient mirror for Arabic. Theme-owned margins, background surfaces and controls remain authoritative; the cinematic hero retains its own readable contrast.

Entry uses finite Web Animations on opacity/transform: 520 ms with at most 220 ms stagger. Loaded metrics and recent cards enter once; actual metric totals count over 480 ms, and view changes use 280 ms. Preferences and background refresh do not replay entry. No animation checks Windows settings or prefers-reduced-motion, following the owner's instruction. No indefinite decorative animation, artificial transfer percentage, per-frame layout measurement, or idle network poll was added. Native buttons remain immediately actionable during entry.

Backup Library owns the default-off uninstalled-game switch. Manage includes the same full, non-cropped cover, file counts/paths, integrity/restore/export actions and a persisted per-game backup switch. The main process rejects disabled-game manual backup calls and does not schedule game-exit backups for those games. Existing recovery points can still be verified/restored/exported. Portrait/custom native artwork is preferred over small app icons; image failures fall back to a local vector symbol.

The browser suite additionally checks motion under emulated reduced-motion, option placement, game-setting routing, disabled backup state, and the cover slot in Manage. All fixture screenshots use synthetic data, not a user's library.

## Revision 4 — dedicated Cloud page and artwork

Owner-approved layout exception: Cloud now owns a full-window internal overlay instead of hiding/replacing native Settings nodes. The static charcoal/navy/mint CSS backdrop belongs to the outer overlay; only the inner content scrolls. It does not reuse or play Hydra's wallpaper. The actual bundled Hydra Nexus logo replaces the generic shield in the page brand. A persistent Back to Hydra button and existing native preload window controls are available. Native root inert/aria-hidden, focus, native frame bounds and paused media are restored on close; tab-cache suspension mirrors Play Activity. No changes were made to Play Activity itself.

Artwork resolves only the displayed game's native full assets through window.electron.getGameAssets, including catalogue identity and operational artwork identity, matching Hydra's selected artwork behavior. Custom covers are authoritative. Resolution is bounded to three concurrent requests with a capped session cache, 15-minute successful reuse and short failure backoff. Library rows begin at 30; no all-library artwork storm or guessed Steam/SGDB URLs. Late results after close are ignored. Covers use portrait 2:3 geometry and object-fit:cover, per the owner's latest request to fill the entire frame, in both list and Manage. Native artwork availability still depends on its provider; no fake AI upscaling is applied.

Detection now rejects Steam config/librarycache metadata, including stale automatic roots from previous revisions. Such cache files remain untouched on disk and prior recovery points remain available. A fresh row needs native library membership and actual save OR achievement source files, rather than catalog/schema data. Save-only and achievement-only games remain supported. Unknown failed scans without any local source do not manufacture backup candidates.

## Revision 5 — native caption and recovery clarity

Windows/macOS use Hydra's existing native caption buttons, matching Play Activity. Cloud renders its own fallback controls only on hosts without that native caption. The header reserves the physical native button area on Windows (right) and macOS (left), independent of RTL. The recovery card has separate grid rows for location badges and action buttons, with a ten-pixel gap rather than overlapping both groups in one row.

Current fresh-device recovery: connect the same provider account, refresh the cloud catalog, open Backup Library and optionally filter Cloud. Previously uploaded games appear even with no local library entries or detected saves. Manage downloads/imports a verified point; Choose restore location maps the point's roots to this device, then explicit preview/confirmation restores its files. There is no download-all/restore-all action in this revision. The integration fixture now uses a genuinely empty library on the second device and verifies cloud-only listing, download/import, target mapping and restore. This is simulated provider I/O, not actual Dropbox OAuth testing.
