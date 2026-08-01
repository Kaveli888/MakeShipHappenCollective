# ShipShot Full Vertical Stack Design QA

- Source visual truth: `/Users/jake/Library/Application Support/CleanShot/media/media_M26U6IZK4l/CleanShot 2026-07-23 at 21.34.05.png`
- Source pixels: 539 × 573; relevant widget crop: 200 × 286
- Implementation screenshot: `/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/ShipShot/design-qa-full-stack.png`
- Implementation CSS size for four captures: 200 × 552 at device scale 1
- Maximum stack: ten full 200 × 125 capture cards in a 200 × 1350 native window
- State: every temporary screenshot is a complete, individually actionable card

## Full-view comparison

The source shows the reported problem: four 200 × 125 cards were rendered while the native window only reserved height for two, cutting the older cards out of view. The implementation now sizes the native floating window from the real pending count, preserving the original 200 × 125 card size and an 8-pixel vertical gap for every capture.

## Focused-region comparison

Delete, Edit, and Save As fit inside each 200 × 125 card. The card keeps the same dimensions on hover and keyboard focus; opening controls does not enlarge, overlap, or shift the preview.

## Required fidelity surfaces

- Fonts and typography: Existing ShipShot small-control typography is preserved. The compact handle remains legible without increasing the widget.
- Spacing and layout rhythm: Passed. Cards use a consistent 8-pixel vertical gap, 14-pixel radius, and a 20-pixel move handle.
- Colors and visual tokens: Passed. Existing translucent charcoal, white control, and amber Save As styling is preserved.
- Image quality and asset fidelity: Passed. Real capture previews use their original image data with `object-fit: contain`, so the complete screenshot stays visible instead of being cropped.
- Copy and content: Passed. `Drag anywhere`, capture count, Delete, Edit, and Save As remain unchanged.

## Interaction verification

- Every screenshot remains completely visible as its own card.
- Captures remain in chronological stack order.
- Hover, active selection, and keyboard focus expose the controls.
- Opening controls does not resize the card.
- The eleventh capture is blocked until one of the ten temporary captures is saved or deleted.
- Four-card browser verification measured every card at exactly 200 × 125 and the complete root at 200 × 552.
- Browser console warnings and errors: none.

## Comparison history

1. Initial source review identified a P1 native-window sizing mismatch.
2. A compact overlapping deck was tested and rejected because the user needs complete previews.
3. The original full-card layout was restored.
4. Native window height now grows with the pending count, up to a hard ten-capture limit.

## Findings

No remaining P0, P1, or P2 visual findings.

## Follow-up polish

- P3: Screenshots with a different aspect ratio use the card's charcoal background as natural letterboxing so no image content is cut off.

final result: passed
