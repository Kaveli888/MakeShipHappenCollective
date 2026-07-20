# ShipShot Quick Access Design QA

## Evidence

- Source visual truth:
  - `/Users/jake/Library/Application Support/CleanShot/media/media_U4P37mgSTq/CleanShot 2026-07-19 at 14.02.18.png`
  - `/Users/jake/Library/Application Support/CleanShot/media/media_ukjtPqlMIV/CleanShot 2026-07-19 at 14.02.28.png`
  - `/Users/jake/Library/Application Support/CleanShot/media/media_wUYQ1ccsdp/CleanShot 2026-07-19 at 14.02.31.png`
- Native implementation screenshot: `/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/ShipShot/qa/quick-access-native-fixed-closed.png`
- Browser-rendered implementation screenshots:
  - `/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/ShipShot/qa/quick-access-fixed-closed.png`
  - `/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/ShipShot/qa/quick-access-fixed-actions.png`
- Full-view comparison: `/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/ShipShot/qa/quick-access-fixed-comparison.png`
- Viewports: native Quick Access 160 × 100 physical pixels in every state; browser QA surface 240 × 160 in both closed and action-visible states because 240 × 160 is the in-app Browser's minimum viewport.
- States: temporary screenshot ready to drag; same fixed card after click with Copy, Save, Discard, Pin, Annotate, and Desktop + ShipShot controls.

The full-view comparison is sufficient because the component itself is the focused region and all borders, radii, controls, labels, and image edges are legible at native size. No additional crop is needed.

## Findings

- No remaining P0, P1, or P2 visual or interaction findings.
- Typography: system UI text remains crisp and readable at the component's native size. Button hierarchy and short labels match the existing ShipShot treatment without wrapping or truncation.
- Spacing and layout: the native window and visible card share the same 160 × 100 bounds before hover, after hover, and after opening controls. Compact controls have balanced corner and center insets with no overlap.
- Colors and tokens: the translucent dark treatment, amber Save action, white secondary action, and semantic danger/pin controls remain consistent with ShipShot. The screenshot itself is dynamic content, so its colors correctly differ between captures.
- Image quality: the pending screenshot uses the original temporary PNG, fills the preview without a transparency halo, and is blurred only in the intentional expanded action state.
- Copy and content: Copy remains temporary. Save commits to ShipShot. Desktop export and a successful drag/drop now also commit the capture to ShipShot and dismiss the temporary window.
- Icons and accessibility: Lucide controls remain visually consistent; each icon-only action has an accessible name/title. The focused QA component shows no clipping or overlap.

## Comparison History

### Iteration 1 — blocked

- [P1] Overlay stayed on the display where it was created because placement depended on the window's current monitor.
- [P1] A padded transparent native window created the visible exterior gray rectangle and blocked clicks outside the card.
- [P1] Browser-only `mouseleave` handling could leave the expanded window active after switching apps.

### Fixes Made

- Resolve the active display from the real macOS cursor position and poll it while a pending capture exists.
- Move and re-anchor Quick Access at the bottom-left of whichever display currently contains the cursor.
- Set exact native window sizes of 160 × 100 collapsed and 296 × 200 expanded.
- Remove the root padding and exterior shadow so the visible card and native click hitbox have identical bounds.
- Add native collapse detection with pin-state awareness and synchronize that state back to React.

### Iteration 2 — passed

- Native capture completed with Screen Recording permission enabled.
- The collapsed native overlay rendered at exactly 160 × 100 with no exterior gray rectangle.
- Cursor movement moved the live native window from display 2 (`x=3462`) to display 1 (`x=22`) and back to display 2 (`x=3462`).
- The expanded component rendered at 296 × 200 with all six actions visible and no exterior frame.
- The Copy interaction returned `Copied • still temporary`, preserving the unsaved pending capture contract.
- Browser console errors checked: none.
- Build checks passed: TypeScript/Vite production build and Rust `cargo check`.
- Installed app signature verification passed for `/Applications/ShipShot.app`.

### Iteration 3 — blocked

- [P1] Hover changed the native window from 160 × 100 to 296 × 200 and back, making the drag target move under the pointer.
- [P1] The full-size invisible action layer intercepted pointer input as soon as actions appeared, preventing reliable drag initiation.
- [P1] A successful drop left the capture pending and did not add it to the ShipShot library.

### Fixes Made

- Keep the native Quick Access window fixed at 160 × 100 for both closed and action-visible states.
- Replace hover-to-open with click-to-open while preserving keyboard activation.
- Fit all six controls inside the same card footprint.
- Make the entire screenshot the drag target while controls are closed; when controls are open, only the visible buttons intercept input and the remaining screenshot gaps stay draggable.
- After the native drag plugin reports `Dropped`, call the existing ShipShot save pipeline. That moves the temporary source into the ShipShot library, emits the library update, hides Quick Access, and optionally sends it to Ship Memory.
- Apply the same drop-and-save contract to edited screenshots in the annotation editor.
- Change the Desktop buttons to save a Desktop copy and then commit the capture to ShipShot.

### Iteration 4 — passed

- Native capture rendered a 160 × 100 Quick Access window.
- Closed and action-visible browser states measured exactly the same 240 × 160 QA viewport; no layout resize occurred.
- Closed-state hit testing returned the screenshot preview at every sampled point, confirming hidden controls no longer block drag initiation.
- Open-state hit testing found all six visible buttons at their control locations and the screenshot preview in the gaps around them.
- The action state has no clipped labels, overlapping controls, or external hitbox.
- Browser console errors checked: none.
- TypeScript/Vite production build and Rust `cargo check` passed.
- The final `/Applications/ShipShot.app` is Developer ID signed and signature verification passed.

## Residual Test Gaps

- Physical drag-and-drop into every possible third-party application was not exhaustively tested. The native file-drag path is unchanged; its successful-drop callback now invokes the already-verified ShipShot save-and-hide command.
- Notarization is outside this local build. The installed app is Developer ID signed but not notarized for distribution.

## Implementation Checklist

- [x] Follow cursor between both active displays.
- [x] Keep bottom-left placement on the active display.
- [x] Remove exterior gray rectangle.
- [x] Match visible card and click hitbox dimensions.
- [x] Collapse reliably when the cursor leaves unless pinned.
- [x] Keep the card fixed at 160 × 100 in every native state.
- [x] Keep the screenshot fully draggable before controls are opened.
- [x] Preserve draggable gaps around visible controls.
- [x] Save successful drops to ShipShot and dismiss Quick Access.
- [x] Save Desktop-button exports to both Desktop and ShipShot.
- [x] Verify action hit targets and console output.

final result: passed
