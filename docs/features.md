# Features

## Steam launch settings

![Steam launch settings](../assets/features/steam.webp)

Assign a saved Steam account and launch mode to each game. Default / standalone launches normally without asking Nexus to start or switch Steam; an existing Steam session stays unchanged. Steam online uses a saved personal account online. Steam offline forces the selected account offline, including shared accounts. Only accounts already saved in Steam are listed. Turn off Steam’s account-choice prompt on startup to allow automatic switching.

**Where to use it:** Library → game page → Steam button beside Play

## Game Storage Manager

![Game Storage Manager](../assets/features/storage.webp)

Browse installed games by drive, available space and measured file sizes. Search and sort by size or last played. Open a game folder or move selected games after reviewing the destination and required space. Copied files are verified before Hydra’s paths are updated and originals removed. Uncertain folders require confirmation; partial measurements are labelled. External launcher registrations and desktop shortcuts are not rewritten.

**Where to use it:** Settings → below Big Picture → Game Storage Manager

## Play Activity

![Play Activity](../assets/features/activity.webp)

Review recorded sessions, playtime and the last-played date for each game. Weekly and monthly recaps show games, active days and available dated achievements. Control notices from the bell, or disable recaps and all their notices while keeping session tracking and per-game history. Detailed history starts when Nexus tracks play; lifetime totals cannot reconstruct earlier sessions.

**Where to use it:** Sidebar → Play activity; per-game graph beside playtime

## Game Backup

![Game Backup](../assets/features/backup.png)

Keep separate recovery points for each game’s saves and local achievements. Restore a point, open its folder or extract a verified copy elsewhere without replacing current saves. Add an extra save folder or stop new backups for one game while keeping its history. For cloud copies, choose a folder synced by Google Drive for desktop; Drive handles cloud sync without a Google login inside Nexus. Close games before restoring. Local achievement restore does not grant Steam/Epic account unlocks.

**Where to use it:** Sidebar → Backup; game Options → General → Backup

## Extract Path

![Extract Path](../assets/features/extract.webp)

Download archives to one drive and extract the game to another. Enable automatic extraction in Download settings and choose Extract path. Nexus remembers the last accepted destination and keeps a destination for each queued download. A game folder is created inside it. Original archives remain in their download location for resume/seeding unless you separately enable archive deletion after extraction.

**Where to use it:** Download settings → automatic extraction → Extract path

## Download Finish Actions

![Download Finish Actions](../assets/features/finish.webp)

Choose a notification, Sleep or PC Shutdown after the whole download queue and enabled extractions finish. Power actions have 60 seconds to cancel. New downloads resume waiting; closing Hydra cancels the pending action. Enabling the plugin requires a Hydra restart, and restart never automatically arms a power action.

**Where to use it:** Downloads → beside Cancel → Download Finish Actions

## Invisible Mode

![Invisible Mode](../assets/features/invisible.webp)

Control Hydra activity sharing while retaining local progress and access to artwork. Enabling the plugin activates Invisible Mode immediately; change it afterward from the account menu. Private activity stays local after turning the mode off until you explicitly resume sharing. Presence updates can take time, and game notifications also depend on Hydra servers.

**Where to use it:** Account menu → below Friends → Invisible Mode

## Game Tabs

![Game Tabs](../assets/features/tabs.webp)

Open multiple game pages in tabs within the same Hydra window and return to your place. Catalogue search results, filters and scroll are retained. Right-click a game in Catalogue or Library and choose Open in New Tab; switch using the tab bar and close with ×. Tabs belong to the current Hydra session and are not restored after a full application restart.

**Where to use it:** Catalogue or Library → right-click → Open in New Tab

## Custom backgrounds

[![](../assets/media/custom-background-preview.jpg)](../assets/media/custom-background.mp4)

Choose your own local image or video as Hydra’s background. Adjust darkness and blur, optionally pause video while Hydra is inactive, and restore the theme background with Reset. Supported video playback depends on the codec; H.264 MP4 or WebM is recommended.

**Where to use it:** Hydra Nexus Settings → Themes → Choose image or video

## Additional tools

- Game Notes — text and links per game, an independent window, Always on top and a focus shortcut.
- Nexus Mods — open the matched game’s mods page or search when no reliable match is available.
- PC Compatibility — compare confirmed PC specifications with published minimum requirements. Estimates are not FPS predictions.
- Updater — check releases, verify the downloaded installer and update/restart from Hydra.


## Google Drive backup copies

1. [Install Google Drive for desktop](https://www.google.com/drive/download/) and sign in to your account in the Google app.
2. In **Backup → Google Drive**, select **Choose Drive folder**. Choose **My Drive**, or a folder already synced by Drive. Nexus creates **Hydra Nexus Backups** inside it and copies the existing latest backup for each game immediately. No new save changes are required. Drive letters can differ; do not assume everyone uses `G:`.
3. Select **Copy existing / latest backups**, or enable **Copy new backups to Google Drive** in General.
4. Check the Google Drive tray icon and wait for syncing to finish before shutting down or disconnecting the drive.

Nexus verifies each local recovery point, creates a ZIP and checks its copy before marking it complete. Google Drive handles uploading and authentication. Nexus does not use the Google Drive API, request Google credentials or confirm that a copy has reached the cloud. A copied file may still be waiting for internet access or available cloud storage.

Local backups remain available when the Drive folder is disconnected. Automatic copies stop after 3 failed attempts, at least five minutes apart. The counter survives restarts. Retry manually or select **Reset automatic attempts** after fixing the Drive folder. A successful copy resets the counter. Previously copied archives are skipped after an integrity check. Cloud copies are kept independently of local retention; manage older ZIPs in Drive yourself. Removing the folder from Nexus does not delete those copies.

To restore, use **Games → Import backup → Backup ZIP (local or Drive)** and choose the ZIP. Let Drive download an online-only file first if needed. Nexus verifies it and creates a safety copy before restoring.


See [installation](installation.md), [privacy](privacy.md) and [troubleshooting](troubleshooting.md).
