# Changelog

## 2.0.0 — First Public Release

The first public release with the new Hydra Nexus identity. The version follows the earlier 1.x development builds so existing users can update normally.

### Included

- Eight independent plugins: Steam, Backup, Play Activity, Game Tabs, Nexus Mods, Game Notes, PC Compatibility and Low Resource Mode.
- Custom image/video backgrounds, theme-aware controls and a GitHub updater.
- Per-game save and local-achievement recovery points, external restore and optional Drive uploads.
- Catalogue tabs for non-library games, with search/filter and scroll restoration.
- Portable text/link Notes, Always on top and a configurable focus shortcut.
- Automatic published-requirement checks with supported CPU/GPU benchmark comparisons.

### Fixed for launch

- Extend the native right-click menu instead of replacing it; keep existing shortcut controls beside the per-game Backup section.
- Use the game selected in Options for Backup actions, even when another game page is behind the modal.

- Main-window creation during startup and imported-theme redirects.
- Native local-media loading and failed-media fallback.
- Pending Notes saves when closing a note, disabling the plugin or preparing an update.
- Staged GitHub updates after a restart, and deferred update notices during interface suspension.
- Concurrent plugin/privacy preference writes.
- Catalogue tab identity when the search or filters change.
- Steam save feedback now waits for a backend confirmation.

GameShift, theme CSS editing, achievement-style imports and new Notes image attachments are excluded. Existing Notes attachments remain readable and exportable.
