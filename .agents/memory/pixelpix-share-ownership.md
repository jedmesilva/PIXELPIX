---
name: PIXELPIX share ownership
description: The ownership rule for the public pixel share action.
---

The pixel detail modal must show the share action only when the current user has evidence of ownership: a successful reveal completed in the current browser, or a certificate visualization link carrying `from=certificate`.

**Why:** A paid pixel is public, but sharing is an owner-facing action. Showing it to every visitor incorrectly implies that any visitor revealed the pixel.

**How to apply:** Do not infer ownership from the public `revealedBy` value alone. Keep the local reveal marker and the certificate-link condition when changing the modal or deep-link behavior.