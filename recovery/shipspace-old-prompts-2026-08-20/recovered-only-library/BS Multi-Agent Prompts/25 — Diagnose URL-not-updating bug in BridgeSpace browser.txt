Bug: in the BridgeSpace Tauri browser, navigating between pages doesn't update the address bar. Side effect: when the sidebar is adjusted, state refreshes and the user gets redirected to the original URL.

This is a diagnosis + plan task. Do NOT fix yet.

Investigate:
  1. How is the browser component implemented (webview wrapper / iframe / Tauri WebviewWindow)?
  2. Where is the URL state stored, and what writes to it?
  3. What event should fire on in-page navigation (popstate, did-navigate, location-changed) and is it being subscribed to?
  4. Why does sidebar resize trigger a state refresh? Is it a key change forcing remount? A parent re-render?
  5. What's the relationship between URL state and the redirect-to-original behavior?

Output a structured plan:
  - Root cause hypothesis (1-3 candidates ranked by likelihood)
  - Verification step for each
  - Proposed fix per cause
  - Risk assessment
  - Suggested fix order

Done = diagnosis + ranked hypotheses + fix plan + waiting on my go-ahead.