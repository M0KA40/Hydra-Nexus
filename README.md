![Hydra Nexus — Extend your Hydra experience](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/promo/overview.jpg)

[English](README.md) · [Português (Brasil)](docs/readme/pt-BR.md) · [Español](docs/readme/es.md) · [Русский](docs/readme/ru.md) · [العربية](docs/readme/ar.md) · [Français](docs/readme/fr.md) · [Deutsch](docs/readme/de.md) · [Türkçe](docs/readme/tr.md) · [Polski](docs/readme/pl.md)

# Hydra Nexus

Hydra Nexus is a community extension for Hydra Launcher on Windows. It adds game storage tools, per-game Steam accounts, play activity, tabs, notes and your own backgrounds. Enable the tools you need in Plugins. Nexus follows Hydra’s language and uses native controls that work with your theme. An existing Hydra Launcher installation is required.

**[Download installer](https://github.com/M0KA40/Hydra-Nexus/releases/latest/download/Hydra_Nexus_2.2.exe)** · [Release notes](https://github.com/M0KA40/Hydra-Nexus/releases/tag/v2.2) · [Report a problem](https://github.com/M0KA40/Hydra-Nexus/issues/new/choose)

## Nexus Quiet (Beta)

Nexus Quiet goes beyond a conventional Hydra color theme. It redesigns navigation, Home and game pages, with integrated features that improve everyday browsing. Choose Quiet Slate or Nexus Mint using the circular color selectors in Settings → Themes. Both share the same layout and functionality. This is an initial beta; development and refinement will continue.

[What’s new in 2.2](https://github.com/M0KA40/Hydra-Nexus/releases/tag/v2.2)

## Game Page Layout

Choose which game-page sections appear and arrange their order from Plugins. Visibility can apply to library games or all games. Hidden middle sections retain their space; hidden sidebar sections release theirs. Preferences are saved without replacing unrelated controls or drafts.


## Steam launch settings

![Steam launch settings](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/ac0b8e5df56367c357d743ffb2c01ea4b1fc9c9a/assets/features/steam.webp)

Assign a saved Steam account and launch mode to each game. Default / standalone launches normally without asking Nexus to start or switch Steam; an existing Steam session stays unchanged. Steam online uses a saved personal account online. Steam offline forces the selected account offline, including shared accounts. Only accounts already saved in Steam are listed. Turn off Steam’s account-choice prompt on startup to allow automatic switching.

**Where to use it:** Library → game page → Steam button beside Play

## Game Storage Manager

![Game Storage Manager](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/storage.webp)

Browse installed games by drive, available space and measured file sizes. Search and sort by size or last played. Open a game folder or move selected games after reviewing the destination and required space. Copied files are verified before Hydra’s paths are updated and originals removed. Uncertain folders require confirmation; partial measurements are labelled. External launcher registrations and desktop shortcuts are not rewritten.

**Where to use it:** Settings → below Big Picture → Game Storage Manager

## Play Activity

![Play Activity](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/activity.webp)

Review recorded sessions, playtime and the last-played date for each game. Weekly and monthly recaps show games, active days and available dated achievements. Control notices from the bell, or disable recaps and all their notices while keeping session tracking and per-game history. Detailed history starts when Nexus tracks play; lifetime totals cannot reconstruct earlier sessions.

**Where to use it:** Sidebar → Play activity; per-game graph beside playtime



Keep separate recovery points for each game’s saves and local achievements. Restore a point, open its folder or extract a verified copy elsewhere without replacing current saves. Add an extra save folder or stop new backups for one game while keeping its history. For cloud copies, choose a folder synced by Google Drive for desktop; Drive handles cloud sync without a Google login inside Nexus. Close games before restoring. Local achievement restore does not grant Steam/Epic account unlocks.

**Where to use it:** Sidebar → Backup; game Options → General → Backup

## Extract Path

![Extract Path](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/extract.webp)

Download archives to one drive and extract the game to another. Enable automatic extraction in Download settings and choose Extract path. Nexus remembers the last accepted destination and keeps a destination for each queued download. A game folder is created inside it. Original archives remain in their download location for resume/seeding unless you separately enable archive deletion after extraction.

**Where to use it:** Download settings → automatic extraction → Extract path

## Download Finish Actions

![Download Finish Actions](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/finish.webp)

Choose a notification, Sleep or PC Shutdown after the whole download queue and enabled extractions finish. Power actions have 60 seconds to cancel. New downloads resume waiting; closing Hydra cancels the pending action. Enabling the plugin requires a Hydra restart, and restart never automatically arms a power action.

**Where to use it:** Downloads → beside Cancel → Download Finish Actions

## Invisible Mode

![Invisible Mode](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/invisible.webp)

Control Hydra activity sharing while retaining local progress and access to artwork. Enabling the plugin activates Invisible Mode immediately; change it afterward from the account menu. Private activity stays local after turning the mode off until you explicitly resume sharing. Presence updates can take time, and game notifications also depend on Hydra servers.

**Where to use it:** Account menu → below Friends → Invisible Mode

## Game Tabs

![Game Tabs](https://raw.githubusercontent.com/M0KA40/Hydra-Nexus/f575584cd94e2d50d5026ce64f396540ee46fc4c/assets/features/tabs.webp)

Open multiple game pages in tabs within the same Hydra window and return to your place. Catalogue search results, filters and scroll are retained. Right-click a game in Catalogue or Library and choose Open in New Tab; switch using the tab bar and close with ×. Tabs belong to the current Hydra session and are not restored after a full application restart.

**Where to use it:** Catalogue or Library → right-click → Open in New Tab

## Custom backgrounds

https://github.com/user-attachments/assets/f69ff1b4-6250-43b1-a5d7-98ca3722d952

Choose your own local image or video as Hydra’s background. Adjust darkness and blur, optionally pause video while Hydra is inactive, and restore the theme background with Reset. Supported video playback depends on the codec; H.264 MP4 or WebM is recommended.

**Where to use it:** Hydra Nexus Settings → Themes → Choose image or video

## Additional tools

- Game Notes — text and links per game, an independent window, Always on top and a focus shortcut.
- Nexus Mods — open the matched game’s mods page or search when no reliable match is available.
- PC Compatibility — compare confirmed PC specifications with published minimum requirements. Estimates are not FPS predictions.
- Updater — check releases, verify the downloaded installer and update/restart from Hydra.

## Supported interface languages

| Language | Native name | Nexus interface |
| --- | --- | --- |
| en | English | ✓ Supported |
| pt-BR | Português (Brasil) | ✓ Supported |
| es | Español | ✓ Supported |
| ru | Русский | ✓ Supported |
| ar | العربية | ✓ Supported |
| fr | Français | ✓ Supported |
| de | Deutsch | ✓ Supported |
| tr | Türkçe | ✓ Supported |
| pl | Polski | ✓ Supported |

## Install and update

1. Download Hydra_Nexus_2.2.exe from Releases.
2. Exit Hydra completely, including its tray icon.
3. Run the EXE and choose Install / Update / Repair.
4. Open Hydra → Settings → Hydra Nexus → Plugins.

No separate Node.js or Python installation is needed to run the installer. Updating keeps Nexus settings, Notes, play history. If a Hydra update replaces the modification, reapply a compatible Nexus build. Nexus is independent of Hydra Launcher, Valve, Google and Nexus Mods. Include both app versions and reproduction steps when reporting problems.

## More information

[Privacy](docs/privacy.md) · [Troubleshooting](docs/troubleshooting.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [MIT](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)

## Build from source

```sh
python build.py
```
