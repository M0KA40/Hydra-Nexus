> Release 1.2.1 builds on the tested experimental 1.2.01. It also keeps the bundled Invisible Mode announcement at the top of the installed-release popup for 1.2.1, followed by the original 1.2.0 notes and the appended 1.2.1 fixes. The historical experimental test results below remain scoped to that build; final publication checks are recorded separately.

# 1.2.01 theme compatibility

Local testing candidate, version 1.2.01, internal revision 1. No publication or live installation has been performed. This work builds on the completed 1.2.0 revision-10 repair copy; its source and artifacts are preserved separately.

## Changes

Nexus resolves an opaque surface from the active native sidebar and its ancestor background layers. Text is checked against that surface; input fields and dropdown options receive explicit paired foreground/background colors and the corresponding browser color scheme. Owned button text is corrected when its native themed background would make it unreadable. Color corrections apply immediately without fading through unreadable intermediate text colors. This affects Nexus-owned surfaces and controls, preserving the native application's theme.

Steam, PC Compatibility, Nexus settings, Backup controls and floating notices use the shared rendering helper. The helper adds no polling loop or body observer. Existing native commit and language events update the surfaces. Native select elements remain in place with their keyboard and accessibility behavior.

Backup is a single native sidebar button rather than two competing buttons in one row. Its label and icon remain visible under positional theme rules. A click opens settings; holding for three seconds triggers backup; moving away or releasing early cancels the hold. The native sidebar items and their handlers are retained.

Update checks and installation show translated progress labels and a busy indicator while duplicate actions remain disabled. Pending controls keep full opacity and readable text instead of fading. Nexus settings text also resolves its foreground against the actual content panel when sidebar and content themes differ.

## Acceptance

The dedicated browser suite checks eight theme stress profiles and eight languages: dark, light, translucent glass, a teal positional sidebar, light-sidebar/dark-content, dark-sidebar/light-content, global style overrides and fully transparent surfaces. It checks dropdown and action-button contrast, visible Backup text/icon, a single sidebar button, original native handlers, selected Steam settings, a narrow Arabic dialog, a live theme change and fields in PC Compatibility/Backup. These are authored representative profiles, not a claim that every third-party theme has been downloaded or tested.

The same acceptance fails against the preserved revision-10 source and passes against this candidate. The target text contrast in measured solid field/option/button states is at least 4.5:1. Gradients, images and deliberately hostile third-party rules can need further theme-specific review.

Final source, installer and browser results are recorded in the private Desktop delivery summary after all checks complete. All nine browser suites pass: the seven existing suites and two added theme/updater suites. The dedicated theme matrix passes all 64 theme/language scenarios. The updater suite measures 432 states, including page headings, pending/completed check and install buttons, notification entry and the native confirmation dialog. All 33 default suites pass on Node 24.22.1 and on Node 22.23.4 from an extracted source ZIP; rebuilding that ZIP reproduces the installer and bridge byte for byte. Eight locale catalogs retain 569 messages each.

## Scope

Previously completed repairs remain included. The twelve findings from the separate second audit are deferred by owner instruction; this candidate does not claim to fix them. No real Steam account switch, game process, user-save restore, live Hydra installation or server visibility test is performed. Do not present fixture acceptance as live application verification.

## Experimental-to-final updater ordering

The owner requested experimental label 1.2.01 and final label 1.2.1. These are not interchangeable strings: the final canonical label sorts after its numerically equivalent leading-zero experimental label. Standard numeric version ordering still applies, so 1.2.0 < 1.2.01 < 1.2.1 < 1.2.2. A final installation rejects the older experimental payload. The final release has not been published by this task.
