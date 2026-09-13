---
name: Public application URL
description: Public links in certificate and redemption emails must come from explicit deployment configuration.
---

Certificate and redemption emails must use the configured `PUBLIC_APP_URL`; production must not silently fall back to a guessed or historical domain.

**Why:** A fallback domain produced valid-looking but unusable links when the real public frontend domain differed, and the failure was only discovered after delivery.

**How to apply:** Set `PUBLIC_APP_URL` in the API deployment environment before sending certificates, validate it as an absolute HTTP(S) URL, and regenerate previously sent links after correcting it.