# Feature guide

Manage the eight plugins in **Settings → Hydra Nexus → Plugins**. Backgrounds and updates have their own pages in the same settings group.

## Game Backup

Backups contain the saves and local achievement data found for a specific store/game identity. Each game has its own folder and recovery points. Files that have not changed reuse the previous snapshot instead of filling the backup history with duplicates.

- **Click Backup** in the sidebar to open its settings.
- **Hold Backup for 3 seconds** to start a manual backup. Release early or move away to cancel the hold.
- Use **Options → General → Hydra Nexus Backup** on a game page for a single-game backup or external import. The original Shortcuts and Launch Options controls remain in place. If Hydra has no executable path for that game, choose its executable to enable shortcut creation.

Choose a backup destination and the number of versions to retain. Automatic backups run after a game closes while Hydra remains open. If a save is not detected, add its folder in Backup's Games section.

External restore accepts a ZIP, manifest, game folder or backup collection. The scanner selects the newest complete backup for that exact game. A matching title alone is not enough. To choose an older version, select its snapshot folder directly. Restore checks integrity, asks for confirmation and creates a safety copy before replacing files. Close the game first.

### Google Drive

Connect your own Google account in Backup → Google Drive to upload backup ZIPs directly. You can upload manually or enable uploads for new backups. A local copy remains if an upload fails.

The project OAuth client needs an enabled Drive API and a consent configuration that permits your account. If Google reports that the API is disabled, that setting must be fixed in Google Cloud; retrying the upload alone will not fix it. The Google Drive desktop app is not needed.

This release uploads to Drive. To restore a cloud copy, download its ZIP from Drive and import it through Recovery points.

## Game Notes

Open the **Notes** button beside Play. Each game has its own text and links in an independent, resizable window.

**Read** turns web addresses into clickable links. **Edit** returns to the text editor. **Always on top** keeps the note above ordinary windows. The default shortcut, **Ctrl+Alt+Shift+N**, restores and focuses the last open note; change it under Game Notes in Plugins. Exclusive fullscreen games may cover the window; borderless mode is more reliable.

When first enabled, Notes asks for a storage folder. It saves to `Hydra-Nexus-Notes.json`. Use **Export notes** to keep a portable copy and **Restore Notes export** to merge it later. Matching notes are replaced during restore, with a safety copy made first. Changing folders copies your notes and leaves the old file intact.

New image attachments have been removed. Images already stored in earlier notes remain readable and exportable. Text is limited to 262,144 characters per game; the complete collection is limited to 64 MB. Exports are not encrypted.

## Game Tabs

Right-click a game in **Catalogue** or **Library**, then choose **Open in New Tab**. The option is added to Hydra’s existing context menu; its other commands remain available. The tab bar lets you switch between game pages and return to your catalogue search.

Tabs remember routes, catalogue filters and scroll position. Previously loaded catalogue results may need to load again before the old position can be restored. Scrolling or choosing another tab cancels that restoration. Up to 16 tabs are kept in the current Hydra window; opening a tab does not start another Hydra process. Tabs are kept during Low Resource Mode suspension, but are not a saved workspace across a full application restart.

## Play Activity

The game page shows an exact **Last played** date and time. Click the small graph beside playtime to open **Daily activity** or **Sessions**. Use **Back to game** or Escape to return.

Nexus records sessions while Hydra is running. Existing Hydra total playtime is displayed separately. Detailed history starts when tracking is enabled; it cannot reconstruct older sessions from the existing total.

## Steam launch settings

Open the **Steam** button beside game actions. Choose a launch mode and, for Steam modes, an account already saved in Steam:

| Mode | Behavior |
| --- | --- |
| Default / standalone | Launches normally and leaves Steam unchanged. |
| Steam online | Switches to the selected saved Steam account before launch. |
| Steam offline | Uses the selected saved Steam account in offline mode before launch. |

Select **Save settings** to keep the choice for that game. **Copy executable path** copies the detected game executable when available.

**Hide Steam login usernames** is optional. It hides login names in Nexus account lists, badges and messages while keeping display names visible. The saved metadata stays local so switching can still work. Nexus does not ask for your Steam password. Close running games before changing the plugin.

## Nexus Mods

The orange Nexus Mods logo appears on library game pages. Clicking it opens the game's mods page when a unique match is known. Edition suffixes are removed for matching: **Control Ultimate Edition** maps to **Control**, while **Control Resonant** remains separate. Unsupported or ambiguous games open a search using the base title.

Basic links do not need a key. An optional API key reads the online game catalogue to expand matching; it does not install mods or manage downloads.

For personal testing, sign in at [Nexus Mods API Keys](https://www.nexusmods.com/settings/api-keys), generate a personal key, then paste it under **Optional API catalogue matching** and select **Validate & save**. A failed validation leaves an existing key in place. Saved keys use Windows encryption and are excluded from exports.

Nexus Mods requires public integrations to register an application under its [API acceptable use policy](https://help.nexusmods.com/article/114-api-acceptable-use-policy). The personal-key option is for personal testing; the built-in links remain available without it.

## PC Compatibility

Enable the plugin, scan your PC or enter its specifications, then review and confirm them. The monitor icon appears on game covers, including games outside your library.

The check fetches published minimum requirements and compares CPU, GPU and RAM. Supported models use dated CPU Mark/single-thread and G3D Mark references. Required SSD type and stated Windows version are checked separately. A source button opens the benchmark page for a rated component.

The result distinguishes below-minimum components, borderline comparisons and models without a comparable rating. Unknown results do not mean you need to re-enter a complete PC profile. Free space, VRAM, drivers and game-specific features can still affect playability. The check estimates minimum suitability; it is not an FPS prediction or a guarantee that a game will run.

## Low Resource Mode

This mode pauses custom background video, animations and expensive blur effects while Hydra is open. It also collects unused renderer objects when possible.

After 30 seconds minimized or in the tray, an idle interface can be unloaded and restored when you return. Main-process downloads, game tracking and backup work continue. Open dialogs, pending requests, focused inputs and active backup operations prevent suspension. Restore brings back your route, game tabs and Nexus view. Memory savings depend on Hydra, your theme and the current page; there is no fixed reduction.

## Custom Backgrounds

Open **Themes → Choose image or video**. Nexus copies the file into its own media folder and replaces the active theme's backdrop after the media has loaded. Theme controls, colors and layout remain in use.

Adjust **Darkness** and **Blur**, or choose **Reset background** to return to the theme's original background. Images and H.264 MP4 playback were tested. Other video codecs depend on Electron and Windows support. If a file cannot be decoded, the theme background stays available and an error is shown. Low Resource Mode pauses custom video and disables blur.

## Updater

**Check for updates** reads the latest GitHub release. Automatic checks run after startup and every six hours when enabled. An **Update / Later** notice appears when a newer version is found. Turn off **Check for updates automatically** to keep manual checks only.

The installer download is checked against the release's SHA-256 checksum and version. **Install & restart Hydra** asks for confirmation, closes Hydra normally, runs the hidden installer and reopens Hydra once. Running games and active backup operations block restart. **Choose local update** accepts a Nexus BAT you downloaded yourself.

The repository link is always available. Checksums detect changed downloads; they are not a publisher signature. Read [troubleshooting](troubleshooting.md) if installation does not finish.
