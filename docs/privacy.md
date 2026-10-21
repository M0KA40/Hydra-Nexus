# Privacy

Hydra Nexus is a local desktop extension. It has no analytics or project account server.

## Local storage

Preferences, chosen background media and play sessions remain under `%APPDATA%\Hydra\Nexus`. Backup preferences use `%APPDATA%\Hydra\BackupBridge`; game recovery points remain at the destination you select. Steam reads locally saved account metadata. Login-name privacy hides those names from the UI while keeping launcher metadata local. Nexus does not ask for your Steam password.

Game Notes stores text and any legacy embedded attachments in your chosen JSON file. Notes exports are portable and **not encrypted**. Their contents are not automatically uploaded to Drive. Restore creates a local safety copy. Hardware setup stores only the model names, RAM amount and storage classification you confirm; it does not request hardware serial numbers.

Optional Google refresh tokens and a personal Nexus Mods API key use Electron safeStorage on Windows. These secrets are not included in Notes exports, game recovery points or distribution packages.

## Network requests

- **GitHub:** automatic update metadata checks after startup and every six hours when enabled. Manual checks remain available. Installers/checksums are downloaded only as part of an update you request.
- **Google Drive:** optional direct upload of game backup archives to your own account, using `drive.file` access. API/OAuth configuration determines availability. No Drive desktop application is required.
- **Nexus Mods:** game search opens in your browser. With an optional personal API key, the game catalogue is read from Nexus Mods for identity matching. The built-in metadata snapshot needs no account.
- **Steam store:** a selected game's public minimum requirements are fetched when you request a compatibility comparison.
- **PassMark CPU Benchmark:** supported CPU names may be sent to an individual published benchmark page when no bundled reference is available. Successful ratings are cached locally; no hardware serial numbers are sent. GPU fallback references are bundled.
- **Wikidata:** manually edited CPU/GPU model names can be sent for a catalogue-name lookup. Missing or unavailable results remain unverified. The explicit Verify model online button opens a web search for the model name.
- **Active Hydra themes:** retain their own resources and policies. Nexus does not download theme CSS for editing or achievement-design imports in this build.

Web services receive their normal request information. Hydra Launcher, Steam and external providers have their own privacy policies.

## Removal

Removing the extension leaves local data intact. Disconnect Drive in Backup settings to remove its local connection. Remove a Nexus API key in Plugins. Preserve your Notes export and game backups before deleting local data or formatting Windows.
