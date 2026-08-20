---
name: Prize value semantics
description: Meaning of planned and distributed prize values in PIXELPIX operations.
---

The planned prize value is the nominal value assigned to the prize tier. The distributed prize value is the amount released when a winning position is found, after applying the available-cash and safety-margin rules; it can differ from the nominal amount.

**Why:** PIXELPIX calculates each payout dynamically at discovery time to protect the cash reserve, so operational views must not present the tier nominal value as the amount actually released.

**How to apply:** In admin tables and reports, label both values explicitly as planned/nominal and distributed/released. Leave distributed value empty for winning positions that have not yet been claimed.