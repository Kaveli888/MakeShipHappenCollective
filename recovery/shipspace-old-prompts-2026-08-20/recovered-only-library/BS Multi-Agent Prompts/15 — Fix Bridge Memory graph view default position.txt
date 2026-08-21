Bug: when a user opens the graph view, the graph is not centered or zoomed correctly. It needs to open already framed on the content.

Fix:
  - On graph mount, fit the viewport to the bounding box of all visible nodes.
  - Add ~10% padding around the bounding box.
  - If only 1 node, center on it at a reasonable default zoom (not maxed out).
  - Animate the initial framing in ~300ms for polish.
  - Persist last user pan/zoom per session, but always frame fresh on first open.

Deliverables: fix + before/after screenshots + brief note on which library API you used (d3-zoom / react-flow fitView / etc).

Done = graph opens framed + before/after screenshots posted.