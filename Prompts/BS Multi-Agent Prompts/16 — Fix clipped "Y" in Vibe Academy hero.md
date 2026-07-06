Bug: on the Vibe Academy landing hero, the headline "Vibe Coding Is Here to Stay" has the descender of the "y" cut off at the bottom.

Likely causes (check in order):
  - line-height too tight
  - overflow: hidden on the container
  - fixed height instead of min-height
  - font baseline / line-clamp issue

Fix the actual cause, not by adding padding-bottom as a band-aid.

Deliverables: fix + before/after screenshots + one-line note on what was wrong.

Done = headline renders fully + screenshots + cause noted.