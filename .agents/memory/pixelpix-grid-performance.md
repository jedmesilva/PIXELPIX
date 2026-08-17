---
name: PIXELPIX grid performance
description: Durable performance constraints for the public million-cell grid.
---

The public grid should render the deterministic appearance of available cells locally and use the API only for occupied or special cells. Range requests should stay sparse and cover large prefetched chunks, while scroll state should not cause a React render for every native scroll event.

**Why:** Sending and painting every cell in each small range made first paint slow, caused repeated loading states while scrolling, and increased interaction latency.

**How to apply:** Preserve the sparse range contract and the separation between visible data state and background prefetching when changing the grid or its endpoint.