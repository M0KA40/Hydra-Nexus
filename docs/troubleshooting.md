# Troubleshooting

## Hydra opens twice

Exit Hydra completely, including the tray icon, then install the current Nexus release. This build serializes native main-window creation during theme redirects. Multiple child processes inside one Hydra group are normal for Electron; multiple independent main windows are not. If the issue remains, report the action that triggered it and both version numbers.

## A custom background stays black or fails to load

Use **Themes → Reset background**, then try a PNG image or an H.264 MP4 video. A file's extension does not identify its codec. Nexus checks decoding before replacing the theme backdrop. Inactive-video pausing is controlled in Themes.

## PC Compatibility has no result for a component

Publisher requirements or a comparable model rating may be unavailable. The result names the missing part. Your saved PC profile can still be complete. Check the model spelling and the published store requirements; do not change your PC specifications just to make the result turn green.

## Nexus Mods opens search

No unique game mapping was found. Edition suffixes are normalized, but the extension will not guess an unrelated game's page. The optional API catalogue can improve coverage; it is not required for built-in links.

## A save folder is missing

Launch the game and create a save first. If automatic detection still misses it, add the actual save folder in Backup → Games. Installation files and library entries alone are not save data.

## Drive copies are paused or files are not online

Start Google Drive for desktop, sign in, and confirm the selected folder is inside My Drive or a folder configured to sync. Drive letters can change; choose the folder again if the old path is unavailable. A normal local folder will not upload unless you configured Google Drive to sync it.

Nexus stops after 3 failed automatic copies, at least five minutes apart. The counter survives restarting Hydra. Fix the problem, then use **Copy latest backups** or **Reset automatic attempts**. Your local recovery points stay at their existing backup destination.

After a successful copy, check Google's tray icon for paused syncing, cloud quota or sign-in errors. Nexus reports local copies; it cannot confirm cloud upload completion. Do not clear Google's cache while files are waiting to upload. [Download Google Drive for desktop](https://www.google.com/drive/download/).


## An update is waiting or did not install

Exit games and let backup/restore work finish. Read `%APPDATA%\Hydra\Nexus\updates\installation-status.txt`. Do not reopen Hydra manually while the helper is installing. If the helper times out, close Hydra completely and run the downloaded BAT yourself. A checksum or version mismatch is rejected before installation.

## Notes will not close

The window stays open if its last save fails. Check that the selected folder is writable and has free space. Copy the visible text before changing anything. Do not overwrite a damaged Notes file with an empty collection; preserve it and report the problem with private content removed.

## Reporting a bug

Include your Hydra and Nexus versions, Windows version, steps to reproduce, expected result and what happened instead. Mention the installed theme when relevant. Add only the relevant error text. Remove usernames, save contents, API keys, OAuth files and tokens before sharing logs.
