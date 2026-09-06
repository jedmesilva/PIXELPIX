---
name: PIXELPIX header behavior
description: The reliable interaction pattern for the large and compact PIXELPIX header states.
---

PIXELPIX should represent the large and compact header states with one sticky header element that changes its content in place. Avoid rendering a separate fixed compact layer over the scrolling large header.

**Why:** Independent fixed and flow headers can temporarily show both states on desktop while scroll measurements and React rendering catch up, producing an inconsistent visual state.

**How to apply:** Drive the single header's compact state from the scroll container's scroll position. Keep the header itself sticky at the scroll area's top so there is never a frame where both header variants can be visible.