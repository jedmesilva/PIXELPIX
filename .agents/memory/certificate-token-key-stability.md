---
name: Certificate token key stability
description: Operational constraint for recovering certificate delivery after encryption-key changes.
---

Existing certificate rows may have been encrypted with a previous certificate-token key. When the current key differs, delivery retries fail before the provider call because the token cannot be decrypted.

**Why:** Rotating an unsent row automatically could invalidate a token that was already delivered even though the delivery timestamp was not persisted.

**How to apply:** Keep `CERTIFICATE_TOKEN_SECRET` stable across deployments, or restore the key used to issue the affected rows before retrying delivery. Only perform a deliberate token migration after confirming which certificates are safe to rotate.