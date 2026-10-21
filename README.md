<p align="center"><img src="assets/brand/Hydra-Nexus-banner.png" alt="Hydra Nexus — Extend the experience" width="100%"></p>

<p align="center">
  <a href="https://github.com/M0KA40/Hydra-Nexus/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/M0KA40/Hydra-Nexus?color=62e5c8&label=release"></a>
  <img alt="Windows" src="https://img.shields.io/badge/platform-Windows-28b6be">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-afffe0"></a>
</p>

Hydra Nexus adds game tools to Hydra Launcher: backups, notes, tabs, play history, Steam launch settings and more. Features live in Hydra's settings and game pages, with controls that follow your installed theme.

**[Download the installer](https://github.com/M0KA40/Hydra-Nexus/releases/latest/download/Hydra_Nexus.bat)** · [Installation](docs/installation.md) · [Feature guide](docs/features.md) · [Report a problem](https://github.com/M0KA40/Hydra-Nexus/issues/new/choose)

## Install

1. Download **Hydra_Nexus.bat** from Releases.
2. Exit Hydra completely, including its tray icon.
3. Run the BAT and choose **Install / Update / Repair**.
4. Open **Hydra → Settings → Hydra Nexus → Plugins**.

The installer includes its runtime. You do not need Node.js, Python or the Google Drive desktop app. Updating keeps your settings, notes, play history and game backups.

## What's included

| Feature | What it does | Where to use it |
| --- | --- | --- |
| **Game Backup** | Keeps separate recovery points for each game's saves and local achievements. Supports external restore and optional Google Drive uploads. | Backup in the sidebar; game Options → General |
| **Game Notes** | Saves text and links for each game in a portable local file. The separate window supports Always on top and a keyboard shortcut. | Notes button beside Play |
| **Game Tabs** | Opens games from Catalogue or Library without losing your catalogue search, filters and scroll position. | Right-click a game → Open in New Tab |
| **Play Activity** | Shows the exact last-played date and a record of daily playtime and sessions. | Date and activity icon beside playtime |
| **Steam** | Chooses a saved Steam account and online, offline or standalone launch mode per game. Login usernames can be hidden. | Steam button beside game actions |
| **Nexus Mods** | Opens a matched game's mods page. Edition names are normalized; unmatched games open a game search. | Nexus Mods logo on library game pages |
| **PC Compatibility** | Compares your confirmed PC specifications with published minimum requirements. Supported CPU/GPU models use benchmark references. | Monitor icon on a game's cover |
| **Low Resource Mode** | Pauses background video and visual effects, and suspends an idle hidden interface until you return. | Plugins |
| **Custom Backgrounds** | Applies a local image or video over your theme's background. Includes darkness, blur and reset controls. | Themes |
| **Updater** | Checks GitHub releases and offers a verified download, installation and restart. Automatic checks can be disabled. | Updater |

Read the [feature guide](docs/features.md) for controls, setup and limitations.

## A look inside

<table>
  <tr><td><a href="assets/screenshots/plugins.png"><img src="assets/screenshots/plugins.png" alt="Hydra Nexus plugin settings"></a></td><td><a href="assets/screenshots/steam.png"><img src="assets/screenshots/steam.png" alt="Steam launch settings"></a></td></tr>
  <tr><td align="center">Plugin settings</td><td align="center">Steam launch settings</td></tr>
</table>

The screenshots show the extension with a Hydra theme. Themes are not included in the download.

## Before you start

- **Backups:** a game needs actual save files or local achievement data. Adding a title to your library does not create a save backup. Restoring local achievements does not grant Steam or Epic account unlocks.
- **Play history:** detailed sessions start when Nexus tracking is enabled. Earlier daily records cannot be recovered from a lifetime total.
- **PC checks:** results estimate minimum suitability. They do not predict FPS. Missing publisher requirements or unsupported hardware ratings are identified in the result.
- **Compatibility:** verified against Hydra 4.2.0 on Windows. There is no version whitelist, but Hydra updates can change internal interfaces and require a Nexus update. Re-run the installer after a Hydra update replaces the patch.

## Project information

**2.0.0 — First Public Release** is the launch release under the new Hydra Nexus identity. It replaces the earlier development builds; the version number keeps their update path intact. GameShift, achievement-style imports and theme CSS editing are not included.

Hydra Nexus is a community project, independent of Hydra Launcher, Valve, Google and Nexus Mods. Development continues; please include steps to reproduce a problem when opening an issue.

[Privacy](docs/privacy.md) · [Troubleshooting](docs/troubleshooting.md) · [Verification](docs/verification.md) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)

## Build from source

```sh
python build.py
# Optional: configure a public Google Desktop OAuth client
python build.py --google-client /path/to/desktop-client.json
```

The build writes `Hydra_Nexus.bat` to `dist/`. Only the public Google client ID is embedded; client secrets and account tokens are excluded. See [contributing](CONTRIBUTING.md) for the source layout and checks.
