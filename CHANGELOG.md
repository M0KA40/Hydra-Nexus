# Changelog

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
