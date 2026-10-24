# Changelog

## 1.2.1 — theme compatibility

Final release following experimental 1.2.01. Retains the Invisible Mode announcement and the 1.2.0 notes above the appended 1.2.1 fixes. Includes the theme/dropdown/Backup fixes, readable pending updater buttons and the preserved revision-10 repairs. [Release notes](docs/releases/1.2.1.md).

## 1.2.01 — theme compatibility, local testing candidate

- Fix unreadable Steam dropdown options across light, dark and translucent themes.
- Keep Nexus modal fields and action buttons readable using colors resolved from the active native theme.
- Render Backup as one native sidebar button with a visible label and icon, including themes that target the final sidebar item. Click opens settings; hold three seconds runs backup.
- Preserve focus, selected accounts, launch modes, pending saves, native controls, eight languages and Arabic RTL.
- Carry forward the completed 1.2.0 revision-10 repairs. The separate second-audit backend follow-ups remain deferred at the owner's request.

[1.2.01 notes](docs/releases/1.2.01.md) · [Theme acceptance](docs/theme-compatibility.md).

## 1.2.0 revision 10 — local repair candidate, 2026-10-24

Unpublished and not installed into live Hydra. [Completed isolated validation](docs/repair-validation.md).

- Protect store integration activity and persist unknown-game synchronization holds until explicit sharing resumption.
- Separate partial/complete backup retention; verify prior payloads before unchanged results; preserve corrupt history and Steam settings.
- Bound update shutdown and recovery waits, prevent conflicting work and late approval, and roll back a rejected relaunch.
- Compact ASAR payloads, validate full installation components and record current installer identity.
- Track long game operations, show accurate failure results, prevent duplicate long-press actions and explicitly select source-package files.
- Retain two verified, startup-confirmed successful update recoveries while preserving failed or unresolved jobs.

## 1.2.0 — 2026-10-23

- Added optional Invisible Mode with a native account-menu control, clear on/off states and persistent private activity holds.
- Added eight interface languages with live switching, English fallback and Arabic RTL.
- Fixed saved Steam account switching from existing Desktop shortcuts, competing launch requests and localized progress feedback.
- Rebuilt the updater handoff, fixed stalled restarts and added a themed install-and-restart confirmation with expandable verification details.
- Integrated native Nexus navigation and corrected production renderer selection.
- Reduced repeated UI work, indexed privacy checks and batched persistence.
- Fixed private souvenir status visibility and duplicate private-game counts; bundled the announcement image so it displays reliably inside release notes.

[Full release notes](docs/releases/1.2.0.md).

## 1.0.1

### Internal repair 2

Local repair only; it was not published as 1.0.1 revision 2 and is now included in the 1.2.0 candidate.

- Fixed **Install & restart** closing Hydra without installing the update or reopening the application on affected Windows systems.
- Hydra now waits for the update helper to confirm it is ready before exiting. If startup fails, Hydra stays open and reports the error; helper output is retained for diagnosis.
- Preserved checksum verification, normal shutdown, installation backups and rollback protections.

### Maintenance update

- Fixed unnecessary background refreshes, repeated Steam-button redraws and idle Backup checks that caused avoidable resource use.
- Restored the original Steam account-switching workflow, preserved saved accounts and online/offline modes, and fixed Steam settings sometimes needing more than one click. Steam startup failures now return an error instead of leaving an unhandled exception.
- Redesigned **Game Notes** with a cleaner title bar, improved editor and clearer Edit/Read controls. Improved saving and exporting the latest edits.
- Fixed **Backup and Updater navigation**, including pages remaining over the previous screen and multiple sidebar items appearing selected. Kept Hydra's original game shortcuts and context-menu commands.
- Fixed copying existing backups to a newly selected **Google Drive for desktop** folder. Automatic failures stop after three attempts; local backups remain available.
- Strengthened backup verification and restore recovery, with safety copies preserved when an operation fails. Blocked game launches through Hydra while a restore is replacing files.
- Fixed installer compatibility errors and improved update verification and rollback after a failed installation.

[Patch notes](docs/releases/1.0.1.md).

## 1.0.0

### Internal repair 2

- Copy existing backups immediately when choosing a Drive folder or enabling automatic Drive copies. Show copied and already-present counts separately from local backup changes.
- Keep automatic-copy controls and their current state on the Drive page.
- Detect internal repair revisions without changing the public release number.

The first official Hydra Nexus release.

- Eight optional plugins: Steam launch settings, Game Backup, Play Activity, Game Tabs, Nexus Mods, Game Notes, PC Compatibility and Low Resource Mode.
- Per-game saves and local-achievement recovery points, verified restores and copies through Google Drive for desktop. Automatic Drive failures stop after three attempts.
- Catalogue and Library tabs preserve native context-menu commands. Per-game Backup controls keep Hydra's original shortcuts and launch options.
- Image/video backgrounds, exact last-played dates and daily/session history.
- In-app update notices, SHA-256 verification, confirmation before installation and a single Hydra restart.

The old Google OAuth uploader has been removed. GameShift, achievement-style imports, CSS editing and new Notes image attachments are not included. Existing Notes attachments remain readable.
