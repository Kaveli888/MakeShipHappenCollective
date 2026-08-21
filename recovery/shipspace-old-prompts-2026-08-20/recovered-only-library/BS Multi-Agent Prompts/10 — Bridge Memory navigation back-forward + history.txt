Feature: add browser-style navigation to the Bridge Memory screen.

Requirements:
  - Back/forward buttons on the MD file viewer.
  - Back/forward buttons on the graph page.
  - Maintain a per-session history stack of visited files.
  - Forward stack clears on new navigation (standard browser behavior).
  - Keyboard shortcuts: Cmd+[ / Cmd+] (Mac), Alt+Left / Alt+Right (Win).
  - Disabled state when stack is empty in that direction.
  - Hover tooltip showing the file you'll navigate to.

UI quality bar: match the polish of the existing BridgeSpace browser. Animate transitions. Use existing design tokens.

Deliverables:
  - Implementation
  - Before/after screenshots
  - One-paragraph note on state management approach (Zustand/Context/etc — match what's used elsewhere)

Done = working back/forward on both screens + screenshots + state approach documented.