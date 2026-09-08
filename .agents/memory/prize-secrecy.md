---
name: Prize secrecy
description: Security rule for hiding winning positions until payment confirmation.
---

Unrevealed winning positions must be visually and publicly indistinguishable from ordinary cells. Prize markers may only be persisted, returned by public cell endpoints, streamed through cell events, or rendered by the browser after the cell is paid and its reveal is committed.

**Why:** A persisted prize emoji on the public cell record exposed the location of every winning position before discovery.

**How to apply:** Keep winner selection in private tables, mask unrevealed cell visuals in every public response, and use the paid/revealed state—not the stored emoji—to decide whether the frontend renders a prize.