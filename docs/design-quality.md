# Hydra Nexus interface quality contract

Owner requirement, 2026-10-27. Applies to every future Nexus page, window, dialog, plugin and interaction, including maintenance changes.

- Deliver a polished interface with a clear hierarchy, restrained spacing, readable labels, purposeful grouping, responsive controls and keyboard access. Reuse Hydra's native components and theme geometry. A temporary or minimally styled implementation is not delivery quality.
- Motion must be deliberate and smooth: communicate state changes without flashing, rebuilding unrelated controls or moving the user's focus. Preserve DOM identity, scroll, selection, drafts and native state across saves. Update only changed values; do not recreate a whole settings surface for one checkbox.
- Custom animations must work when Windows animations are disabled. Do not gate Nexus motion on Windows ClientAreaAnimation or operating-system motion preferences. Explicit Nexus controls may govern their own motion. Never fake operation progress: an animated activity indicator and actual operation stages serve different purposes.
- Preserve readable light, dark, transparent and community themes, all nine languages, Arabic RTL and long translations. Use flexible inner layouts; never force native outer geometry to fit a mockup.
- Review the actual rendered interface and its transitions. For page changes, follow page-layout.md and compare native Settings/header/content geometry at 1200×860, 1024×600, 1280×720 and 1920×1080. Verify focus, navigation and exact restoration, not just screenshots or overflow.

Game Page Cleanup has two layout behaviors by owner request: hidden middle sections keep their geometry; hidden sidebar sections collapse so remaining sidebar sections move up. The sidebar column remains native even if all its sections are hidden.
