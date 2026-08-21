BridgeSpace bug: on the MCP Servers page, a button has unreadable text (likely contrast / same-color text-on-bg).

Steps:
  1. Locate the MCP Servers page component in the BridgeSpace Tauri app.
  2. Identify the offending button and the exact CSS/Tailwind class causing the contrast issue.
  3. Fix using the design tokens already defined in the project — do not introduce new colors.
  4. Verify both light and dark modes.
  5. Screenshot before/after.

Done = button readable in both themes + before/after screenshots posted + no other styles regressed.