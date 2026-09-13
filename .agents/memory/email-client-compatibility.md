---
name: Email client compatibility
description: PIXELPIX emails use a light, high-contrast fallback because Outlook/Hotmail may rewrite dark-mode backgrounds.
---

All user-facing PIXELPIX email templates must remain readable when Outlook or Hotmail strips, inverts, or rewrites background styles. Use an explicitly dark canvas matching the PIXELPIX visual language, solid inline backgrounds, explicit bgcolor attributes, and Outlook dark-mode selectors; do not globally rewrite the canvas to a light fallback.

**Why:** Outlook-family clients preserve explicit dark canvases from well-formed transactional emails, while a globally converted light canvas can be displayed as an unrelated gray block in a dark mailbox.

**How to apply:** Route new certificate, redemption, and notification templates through the shared compatibility layer, keep the outer body/table backgrounds explicitly black with `bgcolor` fallbacks, include `data-ogsc`/`data-ogsb` selectors for the outer canvas and card, and verify both HTML and plain-text alternatives.