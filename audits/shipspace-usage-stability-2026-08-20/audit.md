# ShipSpace plan-usage stability audit

Date: 2026-08-20

## Scope

The `Plan usage` block at the bottom of ShipSpace's left sidebar, at the live 234px sidebar width. The audit covered provider detection, background refreshes, intermittent provider/API failure, row alignment, overflow, and the visible accessibility tree.

## Evidence

- User-reported state: `00-user-reference.png`
- First verified live state: `01-live-panel.jpg`
- Focused live crop: `02-live-panel-focused.png`
- Side-by-side comparison: `03-reference-vs-live.png`
- Later persistence capture: `04-persistent-panel.jpg`

## Root causes

1. The five-second foreground-process probe replaced its complete result every time. When an agent briefly ran a shell or tool process, the provider disappeared from the result and the panel unmounted. This caused the repeated in/out behavior.
2. The provider refresh effect depended on an array that could be recreated by unrelated workspace updates. That restarted refresh work even when the actual provider set had not changed.
3. A temporary failed refresh replaced good usage windows with an empty snapshot, collapsing a provider card. Claude was also polled every minute; the verified live run received HTTP 429, confirming that cadence was too aggressive.
4. Percentages without a reset time used different horizontal geometry from percentages with a countdown. Values therefore did not line up between Session, Weekly, and Fable rows.
5. The component hid its scrollbar and used 8.5–9.5px metadata text and an approximately 18px refresh target, creating readability and keyboard/pointer-target risks.

## Changes implemented

- Provider identity is now remembered per open terminal. Transient shell/tool activity cannot remove it; it is removed only when the pane closes or replaced when a different agent is detected.
- Provider and pane effects now depend on stable signatures, preventing irrelevant workspace state updates from restarting detection and refresh loops.
- Last-known usage windows survive transient errors and app/component remounts. Failed refreshes change the status signal but no longer collapse the card.
- Claude background polling was reduced from one minute to five minutes to avoid repetitive traffic and rate-limit churn. Manual refresh remains available.
- Usage labels, percentages, and reset countdowns now use fixed grid columns. Missing reset values reserve the same column with an em dash.
- Typography, card spacing, refresh-target size, visible overflow behavior, and contrast were tightened while preserving ShipSpace's existing colors, borders, radii, and provider ordering.
- Every meter now exposes a named `progressbar` with min, max, and current values. Status dots and reset text have accessible labels.

## Step health

1. Provider detection — healthy. Providers remain mounted across transient foreground-process changes, with regression coverage for shell/tool activity, provider switching, and pane closure.
2. Initial render — healthy. Cached last-known windows render immediately when available; otherwise the card holds a stable waiting/error state instead of appearing and disappearing.
3. Background refresh — healthy. Refresh work no longer visibly spins during routine polling, stale responses cannot overwrite newer requests, and transient errors preserve row geometry.
4. Rate-limited state — healthy with an external limitation. The live Claude endpoint returned HTTP 429; ShipSpace now keeps the card present and communicates the error without layout collapse. A fresh value still depends on Anthropic accepting a later request.
5. Narrow-sidebar layout — healthy. The live 234px sidebar keeps provider name, percentage, countdown, meter, status, and refresh control aligned without clipping.
6. Accessibility — improved, pending interaction testing. The live accessibility tree exposes named provider regions, refresh buttons, status text, reset labels, and progress values. Screenshots and the accessibility tree do not prove full keyboard, zoom, screen-reader, or contrast compliance.

## Verification

- Focused Vitest suites: 10/10 passed.
- TypeScript: passed with no errors.
- Vite production build: passed.
- Live Tauri capture: panel remained mounted across later foreground/UI changes.
- Existing non-blocking warnings remain for the parent Expo config lookup, stale Browserslist data, and bundle chunk size; none is caused by this fix.

Final result: passed.
