'use strict';
module.exports={
  "pageCleaner": {
    "location": "Settings → Hydra Nexus → Plugins → Game Page Layout.",
    "steps": [
      "Enable Game Page Layout, then choose visibility or Arrange sections in Plugin settings.",
      "Hide for library games follows your current library. Hide for all games also applies to catalogue game pages.",
      "Choose Show to restore a section. Disabling the plugin restores every section and keeps your saved choices."
    ]
  },
  "invisible": {
    "location": "Account menu → below Friends → Invisible Mode.",
    "images": [
      {
        "src": "./assets/nexus-guide-invisible.webp",
        "caption": "Invisible Mode"
      }
    ],
    "steps": [
      "Enabling this plugin also turns Invisible Mode on. Use the account-menu control to turn privacy on or off afterward.",
      "Playtime and achievements keep syncing to your profile while Invisible Mode is on. Turning it off restores the native online connection.",
      "Presence may take time to update. Game notifications depend on Hydra servers."
    ]
  },
  "steam": {
    "location": "Library → game page → Steam button beside Play.",
    "images": [
      {
        "src": "./assets/nexus-guide-steam.webp",
        "caption": "Steam launch settings"
      }
    ],
    "steps": [
      "Games spread across several Steam accounts? Assign a saved account to each game. Hydra switches Steam before launching it; this also supports shared accounts.",
      "Default / standalone: launch normally without asking Nexus to start or switch Steam. An already running Steam session is left unchanged.",
      "Steam online: select a saved personal account and launch with Steam online.",
      "Steam offline: select a saved shared account and force Steam offline before launch.",
      "Turn off Steam → Settings → Interface → Ask which account to use each time Steam starts. Select the account and mode in Hydra, then save the game settings."
    ]
  },
  "activity": {
    "location": "Sidebar → Play activity. Per-game history: graph beside the game’s playtime.",
    "images": [
      {
        "src": "./assets/nexus-guide-activity.webp",
        "caption": "Play Activity"
      }
    ],
    "steps": [
      "Review each game’s recorded sessions, playtime and last played date. Weekly and monthly recaps show time played, active days, games and available dated achievements.",
      "Detailed history begins when Nexus tracks your play. Existing Hydra lifetime totals are kept, but cannot reconstruct earlier sessions. Recap notifications are optional.",
      "Track local play history and view weekly or monthly recaps. Disable to hide Play Activity and stop its tracking and notifications."
    ]
  },
  "tabs": {
    "location": "Catalogue or Library → right-click a game → Open in New Tab.",
    "images": [
      {
        "src": "./assets/nexus-guide-tabs.webp",
        "caption": "Game Tabs"
      }
    ],
    "steps": [
      "Right-click a game in Catalogue or Library and choose Open in New Tab. Your Catalogue tab keeps its search, filters and scroll position while you explore games. Tabs use the existing Hydra window.",
      "Switch between the tab bar’s game pages while keeping your place. Close a tab with its × button. Tabs belong to the current window and are not restored after a full restart."
    ]
  },
  "extractPath": {
    "location": "Download settings → enable automatic extraction → Extract path (Hydra Nexus).",
    "images": [
      {
        "src": "./assets/nexus-guide-extract.webp",
        "caption": "Extract path (Hydra Nexus)"
      }
    ],
    "steps": [
      "Download archives to one drive and extract the game to another. In Download settings, enable automatic extraction and choose the Extract path. A game folder is created inside that location.",
      "Choose where downloaded archives are extracted. Your last used folder is remembered. Disable to use Hydra’s original extraction location."
    ]
  },
  "storage": {
    "location": "Settings → below Big Picture → Game Storage Manager.",
    "images": [
      {
        "src": "./assets/nexus-guide-storage.webp",
        "caption": "Game Storage Manager"
      }
    ],
    "steps": [
      "View installed games by drive, measured folder sizes and free space. Search or sort by size, name or last played; filter games you have not played for a while.",
      "Select one or more games, choose a destination and review the move. Nexus verifies copied files before updating Hydra’s paths and removing the source. External launcher registrations and shortcuts are not rewritten.",
      "Refresh recalculates known game folders. Confirm uncertain installation folders before moving them; incomplete measurements are marked clearly."
    ]
  },
  "downloadFinish": {
    "location": "Downloads → beside Cancel → Download Finish Actions.",
    "images": [
      {
        "src": "./assets/nexus-guide-finish.webp",
        "caption": "Download Finish Actions"
      }
    ],
    "steps": [
      "Enable this plugin with Enable & restart Hydra.",
      "Choose a notification, Sleep or Shutdown after the download queue and enabled extractions finish. Power actions have 60 seconds to cancel.",
      "Choose an action for the current queue and apply it. New work interrupts the countdown. Cancel in the dialog; closing or restarting Hydra cancels the armed action."
    ]
  },
  "mods": {
    "location": "Library → game page → Nexus Mods logo beside Play.",
    "steps": [
      "The Nexus Mods logo appears beside Play for library games. Verified catalogue matches open the game’s mods page; unavailable or ambiguous matches open game search.",
      "Optional: basic game links work without a key. A key reads the Nexus Mods game catalogue to improve matching; it does not install mods or manage your downloads. For personal testing: sign in to Nexus Mods, open API Keys below, generate a personal key, then paste it here and select Validate & save. Nexus Mods requires public integrations to register their application separately. Your key is encrypted with Windows and is never exported."
    ]
  },
  "notes": {
    "location": "Game page → Notes icon beside Play.",
    "steps": [
      "Keep multiple titled notes for each game. Edit inside Hydra or open a separate window for Always on top.",
      "Read shows Markdown headings, lists, links, code and formatting. Older notes are kept as Main note.",
      "The shortcut focuses your last open note. Always on top works with desktop and borderless games; exclusive fullscreen can cover other windows."
    ]
  },
  "hardware": {
    "location": "Game cover → monitor icon in the upper corner.",
    "steps": [
      "Find the monitor icon in a game cover’s upper corner, including games outside your library. Review Windows-detected or manual specifications, then compare them with published minimum requirements.",
      "Requirements are fetched automatically. Supported CPU/GPU models use dated published benchmark references; RAM and storage type are checked separately. Unrated models are shown clearly. This estimates minimum suitability, not FPS."
    ]
  }
};
