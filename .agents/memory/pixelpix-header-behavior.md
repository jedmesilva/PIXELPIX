---
name: PIXELPIX header behavior
description: The reliable interaction pattern for the large and compact PIXELPIX header states.
---

PIXELPIX should keep the large value/description/remaining block in normal scroll flow and use one sticky top bar for the PIXELPIX identity plus the remaining badge after the large block has passed.

**Why:** A fixed duplicate header and a scrolling large header can temporarily show both states on desktop. A sticky bar with a sentinel gives the compact state a stable, content-relative trigger.

**How to apply:** Place a sentinel after the large information block and activate the badge when the sentinel passes behind the sticky bar. Do not collapse the large block when compact mode activates; changing its height would move the sentinel back into view and cause flicker.