---
name: Email client compatibility
description: PIXELPIX emails use a light, high-contrast fallback because Outlook/Hotmail may rewrite dark-mode backgrounds.
---

All user-facing PIXELPIX email templates must remain readable when Outlook or Hotmail strips, inverts, or rewrites background styles. Use solid inline backgrounds, explicit bgcolor attributes, dark text on a light fallback, and a light color-scheme declaration; do not rely on dark-only CSS.

**Why:** Outlook-family clients do not render email HTML like a browser and their dark-mode transformation can remove or alter backgrounds, leaving light text on a blank canvas.

**How to apply:** Route new certificate, redemption, and notification templates through the shared compatibility layer and verify both HTML and plain-text alternatives.