# Installation and removal

## Requirements

- Windows and an existing Hydra Launcher installation.
- Hydra 4.2.0 is the verified application version for this release.
- Write access to Hydra's installation folder. Administrator access is needed only if Windows protects that folder.

## Install or update

1. Get `Hydra_Nexus.bat` from the project's [Releases](https://github.com/M0KA40/Hydra-Nexus/releases/latest).
2. Exit Hydra from its tray menu. Closing its main window may only hide it.
3. Run the BAT and select **Install / Update / Repair**.
4. Select the Hydra installation folder if detection cannot find it.
5. Start Hydra and open **Settings → Hydra Nexus**.

Choose plugins individually. Notes asks for its storage folder; PC Compatibility asks for a confirmed PC profile. Steam, Backup and Play Activity require games to be closed before their plugin switches can change.

The BAT includes the patch runtime. Python and Node.js are needed only to build or test the source, not to install the release.

## Moving from a development build

If you installed an earlier development build numbered 2.x, close Hydra and run the **1.0.0 BAT installer** once. The development updater treats the new launch number as an older version and cannot perform that migration itself. Settings, notes, backups and play history are kept. Future 1.x updates use the normal in-app updater.

## After a Hydra update

For Nexus updates, open **Nexus → Updater**, check for updates and choose **Download & install update**. The confirmation uses Hydra's current theme. Review the version, expand **Update details** for the source and SHA-256 if needed, then choose **Install & restart**. Pause active downloads and close games first. Hydra saves pending data, closes, installs the verified update and reopens once.

If an older updater cannot close or reopen Hydra, exit Hydra completely and run the latest BAT once using **Install / Update / Repair**. This installs the replacement updater for subsequent updates and preserves Nexus data.

Hydra updates can replace `app.asar`, removing the Nexus loader. Exit Hydra and re-run the Nexus BAT. Existing Nexus data stays outside the application archive. There is no fixed-version whitelist, but a future Hydra change can require an updated adapter. If installation reports an unsupported structure, keep the recovery copy and report the version instead of forcing a different patch.

## Remove Nexus

Exit Hydra, run the BAT and choose **Remove Nexus**. This removes the loader and leaves your notes, settings, backgrounds, history and game backups on disk. To reinstall, use Install / Update / Repair again.

The patch changes Hydra's application archive, so installation disables Electron's embedded archive-integrity check (fuse 4). Archive-only loading (fuse 5) remains enabled. Removal restores the original fuse settings only when the saved executable matches the current build and no other patch requires the archive change. If that match cannot be verified, reinstall the official Hydra build rather than replacing a newer executable with an older backup.

The in-app updater keeps recovery copies of the application archive and executable before installing. Installation, verification or reopen errors restore those copies; an error after the application has already started is outside that check. Keep recovery copies until the installation has been checked.

## Data locations

| Data | Location |
| --- | --- |
| Nexus preferences, history and background media | `%APPDATA%\Hydra\Nexus` |
| Backup engine preferences and Drive connection | `%APPDATA%\Hydra\BackupBridge` |
| Game backups | Your selected backup destination |
| Game notes | Your chosen folder, in `Hydra-Nexus-Notes.json` |

Keep an exported Notes file and a game backup copy somewhere that will survive reinstalling Windows. API credentials are not part of those exports.
